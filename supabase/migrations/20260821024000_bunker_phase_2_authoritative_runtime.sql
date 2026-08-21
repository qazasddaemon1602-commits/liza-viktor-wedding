-- Forward-only Phase 2 completion. The original Phase 2 migration is already
-- committed and may have been applied, so runtime contracts are replaced here.

create or replace function public._bunker_current_mission(
  p_run_nonce uuid,
  p_state text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plan jsonb;
  v_mission_plan jsonb;
begin
  if p_state not in (
    'MISSION_01', 'MISSION_02', 'MISSION_03', 'MISSION_04',
    'MISSION_05', 'MISSION_06', 'FINAL_30'
  ) then
    return null;
  end if;

  select run.plan into v_plan
  from public.bunker_game_runs run
  where run.run_nonce = p_run_nonce;

  if v_plan is null then
    raise exception 'Bunker run plan is missing' using errcode = '55000';
  end if;

  v_mission_plan := case p_state
    when 'MISSION_01' then v_plan->'mission01'
    when 'MISSION_04' then v_plan->'mission04'
    when 'MISSION_06' then v_plan->'mission06'
    when 'FINAL_30' then v_plan->'final'
    else null
  end;

  return jsonb_build_object(
    'id', lower(p_state),
    'state', p_state,
    'plan', v_mission_plan
  );
end;
$$;

create or replace function public._refresh_bunker_run_guest_plan(
  p_event_id uuid,
  p_run_nonce uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plan jsonb;
  v_guest_count integer;
  v_mission_01 jsonb;
begin
  select run.plan into v_plan
  from public.bunker_game_runs run
  where run.event_id = p_event_id and run.run_nonce = p_run_nonce
  for update;

  if v_plan is null then
    raise exception 'Bunker run plan is missing' using errcode = '55000';
  end if;
  if jsonb_typeof(v_plan->'activeWagonIds') <> 'array' then
    raise exception 'Bunker active wagon plan is missing' using errcode = '55000';
  end if;

  select count(*)::integer into v_guest_count
  from public.guests guest
  where guest.event_id = p_event_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'wagonId', active.wagon_id,
    'wagonSize', sizing.wagon_size,
    'exclusionCount', case
      when sizing.wagon_size = 0 then 0
      when sizing.wagon_size >= 10 then 3
      when sizing.wagon_size >= 7 then 2
      else 1
    end
  ) order by active.ordinal), '[]'::jsonb)
  into v_mission_01
  from (
    select value::uuid as wagon_id, ordinal
    from jsonb_array_elements_text(v_plan->'activeWagonIds')
      with ordinality as planned(value, ordinal)
  ) active
  cross join lateral (
    select count(*)::integer as wagon_size
    from public.guests guest
    where guest.event_id = p_event_id
      and guest.carriage_id = active.wagon_id
  ) sizing;

  update public.bunker_game_runs run
  set guest_count = v_guest_count,
      plan = jsonb_set(
        jsonb_set(v_plan, '{guestCount}', to_jsonb(v_guest_count), true),
        '{mission01}', v_mission_01, true
      )
  where run.event_id = p_event_id and run.run_nonce = p_run_nonce;
end;
$$;

create or replace function public._bunker_run_guest_plan_is_stale(
  p_event_id uuid,
  p_run_nonce uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((
    select run.guest_count <> counts.guest_count
      or coalesce((run.plan->>'guestCount')::integer, -1) <> counts.guest_count
      or mission_01.planned_guest_count <> counts.guest_count
    from public.bunker_game_runs run
    cross join lateral (
      select count(*)::integer as guest_count
      from public.guests guest
      where guest.event_id = p_event_id
    ) counts
    cross join lateral (
      select coalesce(sum((mission.value->>'wagonSize')::integer), 0)::integer
        as planned_guest_count
      from jsonb_array_elements(
        coalesce(run.plan->'mission01', '[]'::jsonb)
      ) mission(value)
    ) mission_01
    where run.event_id = p_event_id and run.run_nonce = p_run_nonce
  ), false);
$$;

do $$
declare
  v_run record;
begin
  for v_run in
    select state.event_id, state.run_nonce
    from public.bunker_state state
    where state.run_nonce is not null
      and state.global_game_state not in ('LOBBY', 'FINISHED')
      and public._bunker_run_guest_plan_is_stale(
        state.event_id,
        state.run_nonce
      )
  loop
    perform public._refresh_bunker_run_guest_plan(
      v_run.event_id,
      v_run.run_nonce
    );
  end loop;
end;
$$;

create or replace function public._bunker_character_matches_category(
  p_profile_key text,
  p_category text
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((
    select case p_category
      when 'technical' then profile.key in (
        'power_engineer', 'electrician', 'mechanic', 'military_engineer'
      )
      when 'medical' then 'medicine' = any(profile.tags)
      when 'information' then profile.key in (
        'cybersecurity_specialist', 'programmer', 'student'
      )
      when 'communication' then 'communication' = any(profile.tags)
      when 'bunker' then profile.special_ability = 'bunker_knowledge'
        or 'bunker' = any(profile.tags)
      when 'navigation' then profile.key in (
        'geologist', 'cartographer', 'train_driver', 'driver'
      )
      when 'analytical' then 'analysis' = any(profile.tags)
      else false
    end
    from public.bunker_character_profiles profile
    where profile.key = p_profile_key and profile.enabled
  ), false);
$$;

create or replace function public.owner_distribute_bunker_characters(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.bunker_state%rowtype;
  v_guest_count integer;
  v_wagon_count integer;
  v_assigned_count integer;
  v_technical_target integer := 1;
  v_medical_target integer := 1;
  v_communication_target integer := 1;
  v_analytical_target integer := 0;
  v_profile_keys text[] := array[]::text[];
  v_selected_keys text[];
  v_profile_key text;
  v_guest record;
  v_category record;
begin
  perform public._require_bunker_owner(p_event_id);

  select state.* into v_state
  from public.bunker_state state where state.event_id = p_event_id
  for update;
  if v_state.run_nonce is null
    or v_state.global_game_state not in ('LOBBY', 'CHARACTERS_READY') then
    raise exception 'Bunker game must be prepared before character distribution'
      using errcode = '55000';
  end if;

  select count(*)::integer into v_guest_count
  from public.guests guest where guest.event_id = p_event_id;
  select count(*)::integer into v_wagon_count
  from public.carriages carriage
  where carriage.event_id = p_event_id and carriage.enabled;

  if v_guest_count between 15 and 20 then
    v_technical_target := 2;
    v_medical_target := case when v_guest_count >= 18 then 2 else 1 end;
    v_communication_target := 2;
    v_analytical_target := 2;
  end if;

  for v_category in
    select category, target_count
    from (values
      ('technical'::text, v_technical_target),
      ('medical'::text, v_medical_target),
      ('information'::text, 1),
      ('communication'::text, v_communication_target),
      ('bunker'::text, 1),
      ('navigation'::text, 1),
      ('analytical'::text, v_analytical_target)
    ) categories(category, target_count)
  loop
    select coalesce(
      array_agg(candidate.key order by candidate.order_key),
      array[]::text[]
    )
    into v_selected_keys
    from (
      select profile.key,
        md5(
          v_state.run_nonce::text || ':' || v_category.category || ':' || profile.key
        ) as order_key
      from public.bunker_character_profiles profile
      where public._bunker_character_matches_category(
          profile.key,
          v_category.category
        )
        and not (profile.key = any(v_profile_keys))
      order by order_key
      limit v_category.target_count
    ) candidate;

    if cardinality(v_selected_keys) <> v_category.target_count then
      raise exception 'character pool cannot cover %', v_category.category
        using errcode = '55000';
    end if;
    v_profile_keys := v_profile_keys || v_selected_keys;
  end loop;

  select v_profile_keys || coalesce(
    array_agg(candidate.key order by candidate.order_key),
    array[]::text[]
  )
  into v_profile_keys
  from (
    select profile.key,
      md5(v_state.run_nonce::text || ':random:' || profile.key) as order_key
    from public.bunker_character_profiles profile
    where profile.enabled and not (profile.key = any(v_profile_keys))
  ) candidate;

  if cardinality(v_profile_keys) < 6 then
    raise exception 'character pool cannot cover mandatory abilities'
      using errcode = '55000';
  end if;

  for v_guest in
    select guest.id,
      row_number() over (
        order by md5(v_state.run_nonce::text || ':guest:' || guest.id::text)
      ) as ordinal
    from public.guests guest
    where guest.event_id = p_event_id
  loop
    v_profile_key := v_profile_keys[
      1 + mod(v_guest.ordinal - 1, cardinality(v_profile_keys))::integer
    ];

    insert into public.bunker_guest_profiles(
      event_id, run_nonce, guest_id,
      profession, profile, health, hobby, baggage, hidden_fact, ability_tags,
      character_profile_key, visible_skill, special_ability, ability_description,
      character_status, hidden_trait_revealed, ability_uses_remaining,
      joined_late, assigned_at
    )
    select
      p_event_id, v_state.run_nonce, v_guest.id,
      profile.profession, 'ПАССАЖИР СОСТАВА', profile.health,
      profile.visible_skill, 'НЕТ ДАННЫХ', profile.hidden_trait, profile.tags,
      profile.key, profile.visible_skill, profile.special_ability,
      profile.ability_description, 'active', false, profile.max_uses, false, now()
    from public.bunker_character_profiles profile
    where profile.key = v_profile_key
    on conflict (run_nonce, guest_id) do nothing;
  end loop;

  select count(*)::integer into v_assigned_count
  from public.bunker_guest_profiles profile
  where profile.event_id = p_event_id and profile.run_nonce = v_state.run_nonce;

  update public.bunker_state
  set global_game_state = 'CHARACTERS_READY', updated_at = now()
  where event_id = p_event_id;

  if not exists (
    select 1 from public.bunker_game_events game_event
    where game_event.run_nonce = v_state.run_nonce
      and game_event.event_type = 'characters_distributed'
  ) then
    insert into public.bunker_game_events(
      event_id, run_nonce, event_type, actor_type, payload
    ) values (
      p_event_id, v_state.run_nonce, 'characters_distributed', 'owner',
      jsonb_build_object(
        'assignedCount', v_assigned_count,
        'wagonCount', v_wagon_count
      )
    );
  end if;

  return jsonb_build_object(
    'status', 'characters_ready',
    'runNonce', v_state.run_nonce,
    'globalGameState', 'CHARACTERS_READY',
    'assignedCount', v_assigned_count,
    'wagonCount', v_wagon_count
  );
end;
$$;

create or replace function public._ensure_late_bunker_guest(
  p_event_id uuid,
  p_run_nonce uuid,
  p_guest_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_guest public.guests%rowtype;
  v_profile public.bunker_character_profiles%rowtype;
  v_inserted boolean := false;
begin
  if exists (
    select 1 from public.bunker_guest_profiles assigned
    where assigned.event_id = p_event_id
      and assigned.run_nonce = p_run_nonce
      and assigned.guest_id = p_guest_id
  ) then
    return false;
  end if;

  select guest.* into v_guest
  from public.guests guest
  where guest.id = p_guest_id and guest.event_id = p_event_id;
  if v_guest.id is null then
    raise exception 'registered Bunker guest required' using errcode = '42501';
  end if;

  select candidate.* into v_profile
  from public.bunker_character_profiles candidate
  left join lateral (
    select count(*)::integer as usage_count
    from public.bunker_guest_profiles assigned
    where assigned.run_nonce = p_run_nonce
      and assigned.character_profile_key = candidate.key
  ) usage on true
  where candidate.enabled
  order by usage.usage_count,
    md5(p_run_nonce::text || ':late:' || p_guest_id::text || ':' || candidate.key)
  limit 1;

  if v_profile.key is null then
    raise exception 'enabled Bunker character profile required' using errcode = '55000';
  end if;

  insert into public.bunker_guest_profiles(
    event_id, run_nonce, guest_id,
    profession, profile, health, hobby, baggage, hidden_fact, ability_tags,
    character_profile_key, visible_skill, special_ability, ability_description,
    character_status, hidden_trait_revealed, ability_uses_remaining,
    joined_late, assigned_at
  ) values (
    p_event_id, p_run_nonce, p_guest_id,
    v_profile.profession, 'ПАССАЖИР СОСТАВА', v_profile.health,
    v_profile.visible_skill, 'НЕТ ДАННЫХ', v_profile.hidden_trait, v_profile.tags,
    v_profile.key, v_profile.visible_skill, v_profile.special_ability,
    v_profile.ability_description, 'active', false, v_profile.max_uses,
    true, now()
  )
  on conflict (run_nonce, guest_id) do nothing
  returning true into v_inserted;

  if coalesce(v_inserted, false) then
    perform public._refresh_bunker_run_guest_plan(p_event_id, p_run_nonce);

    insert into public.bunker_game_events(
      event_id, run_nonce, carriage_id, guest_id,
      event_type, actor_type, payload
    ) values (
      p_event_id, p_run_nonce, v_guest.carriage_id, p_guest_id,
      'late_guest_joined', 'system',
      jsonb_build_object('characterProfileKey', v_profile.key)
    );
    return true;
  end if;

  return false;
end;
$$;

create or replace function public._assign_late_bunker_guest()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.bunker_state%rowtype;
begin
  select state.* into v_state
  from public.bunker_state state
  where state.event_id = new.event_id
  for update;

  if v_state.run_nonce is null
    or v_state.global_game_state in ('LOBBY', 'FINISHED') then
    return new;
  end if;

  perform public._ensure_late_bunker_guest(
    new.event_id,
    v_state.run_nonce,
    new.id
  );
  return new;
end;
$$;

create or replace function public.owner_get_bunker_control(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.bunker_state%rowtype;
  v_now timestamptz := clock_timestamp();
  v_remaining integer := 0;
  v_active boolean := false;
begin
  perform public._require_bunker_owner(p_event_id);

  select state.* into v_state
  from public.bunker_state state
  where state.event_id = p_event_id;

  if v_state.event_id is null then
    return jsonb_build_object(
      'status', 'idle',
      'durationSeconds', 1800,
      'soundEnabled', true,
      'serverNow', v_now
    );
  end if;

  v_active := v_state.status = 'active' and v_state.started_at is not null;
  if v_active then
    v_remaining := greatest(
      0,
      v_state.duration_seconds
        - floor(extract(epoch from (v_now - v_state.started_at)))::integer
    );
  end if;

  return jsonb_build_object(
    'status', case when v_active then 'active' else 'idle' end,
    'startedAt', case when v_active then v_state.started_at else null end,
    'durationSeconds', v_state.duration_seconds,
    'remainingSeconds', v_remaining,
    'soundEnabled', v_state.sound_enabled,
    'runNonce', v_state.run_nonce,
    'globalGameState', v_state.global_game_state,
    'currentMission', public._bunker_current_mission(
      v_state.run_nonce,
      v_state.global_game_state
    ),
    'serverNow', v_now
  );
end;
$$;

create or replace function public.owner_advance_bunker_game_state(
  p_event_id uuid,
  p_next_state text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.bunker_state%rowtype;
  v_expected_state text;
  v_previous_state text;
  v_current_mission jsonb;
begin
  perform public._require_bunker_owner(p_event_id);

  select state.* into v_state
  from public.bunker_state state
  where state.event_id = p_event_id
  for update;

  if v_state.event_id is null or v_state.run_nonce is null then
    raise exception 'Bunker game must be prepared before advancing' using errcode = '55000';
  end if;
  if v_state.status <> 'active' then
    raise exception 'Bunker emergency must be active before advancing' using errcode = '55000';
  end if;

  v_previous_state := v_state.global_game_state;
  if p_next_state is null then
    raise exception 'invalid Bunker global state transition: % -> <NULL>',
      v_previous_state using errcode = '22023';
  end if;
  if p_next_state = v_previous_state then
    return jsonb_build_object(
      'status', 'transitioned',
      'runNonce', v_state.run_nonce,
      'previousState', v_previous_state,
      'globalGameState', v_previous_state,
      'changed', false,
      'currentMission', public._bunker_current_mission(
        v_state.run_nonce, v_previous_state
      )
    );
  end if;

  v_expected_state := case v_previous_state
    when 'CHARACTERS_READY' then 'MISSION_01'
    when 'MISSION_01' then 'BREAK'
    when 'BREAK' then 'MISSION_02'
    when 'MISSION_02' then 'MISSION_03'
    when 'MISSION_03' then 'MISSION_04'
    when 'MISSION_04' then 'MISSION_05'
    when 'MISSION_05' then 'MISSION_06'
    when 'MISSION_06' then 'STORY_BUNKER'
    when 'STORY_BUNKER' then 'BREAK_BEFORE_FINAL'
    when 'BREAK_BEFORE_FINAL' then 'FINAL_30'
    when 'FINAL_30' then 'BUNKER_OPEN'
    when 'BUNKER_OPEN' then 'FINISHED'
    else null
  end;

  if v_expected_state is null or p_next_state <> v_expected_state then
    raise exception 'invalid Bunker global state transition: % -> %',
      v_previous_state, p_next_state using errcode = '22023';
  end if;

  update public.bunker_state
  set global_game_state = p_next_state,
      final_started_at = case
        when p_next_state = 'FINAL_30' then coalesce(final_started_at, clock_timestamp())
        else final_started_at
      end,
      bunker_revealed = case
        when p_next_state in ('BUNKER_OPEN', 'FINISHED') then true
        else bunker_revealed
      end,
      updated_at = now()
  where event_id = p_event_id;

  v_current_mission := public._bunker_current_mission(
    v_state.run_nonce,
    p_next_state
  );

  insert into public.bunker_game_events(
    event_id, run_nonce, event_type, actor_type, payload
  ) values (
    p_event_id, v_state.run_nonce, 'global_state_transition', 'owner',
    jsonb_build_object(
      'previousState', v_previous_state,
      'globalGameState', p_next_state
    )
  );

  return jsonb_build_object(
    'status', 'transitioned',
    'runNonce', v_state.run_nonce,
    'previousState', v_previous_state,
    'globalGameState', p_next_state,
    'changed', true,
    'currentMission', v_current_mission
  );
end;
$$;

create or replace function public.owner_get_bunker_characters(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.bunker_state%rowtype;
  v_characters jsonb := '[]'::jsonb;
  v_now timestamptz := clock_timestamp();
begin
  perform public._require_bunker_owner(p_event_id);

  select state.* into v_state
  from public.bunker_state state
  where state.event_id = p_event_id;

  if v_state.run_nonce is null or v_state.global_game_state = 'LOBBY' then
    return jsonb_build_object(
      'status', 'idle', 'characters', '[]'::jsonb, 'serverNow', v_now
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'guestId', guest.id,
    'realName', guest.first_name || ' ' || guest.last_name,
    'wagon', jsonb_build_object(
      'id', carriage.id,
      'number', carriage.number,
      'label', carriage.label
    ),
    'profession', profile.profession,
    'characterStatus', profile.character_status,
    'joinedLate', profile.joined_late
  ) order by carriage.sort_order, guest.registered_at, guest.id), '[]'::jsonb)
  into v_characters
  from public.bunker_guest_profiles profile
  join public.guests guest
    on guest.id = profile.guest_id and guest.event_id = p_event_id
  join public.carriages carriage on carriage.id = guest.carriage_id
  where profile.event_id = p_event_id
    and profile.run_nonce = v_state.run_nonce;

  return jsonb_build_object(
    'status', 'active',
    'runNonce', v_state.run_nonce,
    'characters', v_characters,
    'serverNow', v_now
  );
end;
$$;

create or replace function public.owner_set_bunker_character_status(
  p_event_id uuid,
  p_guest_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.bunker_state%rowtype;
  v_profile public.bunker_guest_profiles%rowtype;
  v_changed boolean;
begin
  perform public._require_bunker_owner(p_event_id);
  if p_status is null or p_status not in ('active', 'saved', 'excluded') then
    raise exception 'invalid Bunker character status' using errcode = '22023';
  end if;

  select state.* into v_state
  from public.bunker_state state
  where state.event_id = p_event_id
  for update;
  if v_state.run_nonce is null or v_state.global_game_state = 'LOBBY' then
    raise exception 'Bunker characters are not ready' using errcode = '55000';
  end if;

  select profile.* into v_profile
  from public.bunker_guest_profiles profile
  join public.guests guest
    on guest.id = profile.guest_id and guest.event_id = p_event_id
  where profile.event_id = p_event_id
    and profile.run_nonce = v_state.run_nonce
    and profile.guest_id = p_guest_id
  for update of profile;
  if v_profile.guest_id is null then
    raise exception 'Bunker character not found for current run' using errcode = 'P0002';
  end if;

  v_changed := v_profile.character_status <> p_status;
  if v_changed then
    update public.bunker_guest_profiles
    set character_status = p_status
    where event_id = p_event_id
      and run_nonce = v_state.run_nonce
      and guest_id = p_guest_id;

    insert into public.bunker_game_events(
      event_id, run_nonce, carriage_id, guest_id,
      event_type, actor_type, payload
    )
    select
      p_event_id, v_state.run_nonce, guest.carriage_id, p_guest_id,
      'character_status_changed', 'owner',
      jsonb_build_object(
        'previousStatus', v_profile.character_status,
        'characterStatus', p_status
      )
    from public.guests guest
    where guest.id = p_guest_id and guest.event_id = p_event_id;
  end if;

  return jsonb_build_object(
    'status', 'updated',
    'guestId', p_guest_id,
    'characterStatus', p_status,
    'changed', v_changed
  );
end;
$$;

create or replace function public.get_guest_bunker_runtime(
  p_event_slug text,
  p_device_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_guest public.guests%rowtype;
  v_wagon public.carriages%rowtype;
  v_state public.bunker_state%rowtype;
  v_character public.bunker_guest_profiles%rowtype;
  v_wagon_state public.bunker_wagon_state%rowtype;
  v_passengers jsonb := '[]'::jsonb;
  v_inventory jsonb := '[]'::jsonb;
  v_archive jsonb := '[]'::jsonb;
  v_now timestamptz := clock_timestamp();
begin
  select event.id into v_event_id
  from public.events event
  where event.slug = public._normalize_spaces(p_event_slug);
  if v_event_id is null then
    return jsonb_build_object('status', 'not_found', 'serverNow', v_now);
  end if;

  select guest.* into v_guest
  from public.guests guest
  where guest.id = public._bunker_guest_id(p_event_slug, p_device_key)
    and guest.event_id = v_event_id;
  if v_guest.id is null then
    return jsonb_build_object('status', 'guest_not_found', 'serverNow', v_now);
  end if;

  select state.* into v_state
  from public.bunker_state state
  where state.event_id = v_event_id;
  if v_state.run_nonce is null or v_state.global_game_state = 'LOBBY' then
    return jsonb_build_object('status', 'idle', 'serverNow', v_now);
  end if;

  if not exists (
    select 1 from public.bunker_guest_profiles assigned
    where assigned.event_id = v_event_id
      and assigned.run_nonce = v_state.run_nonce
      and assigned.guest_id = v_guest.id
  ) then
    -- Only a missing late profile serializes on the event state. Normal
    -- guest polling stays read-only and does not contend on one shared row.
    select state.* into v_state
    from public.bunker_state state
    where state.event_id = v_event_id
    for update;
    if v_state.run_nonce is null or v_state.global_game_state = 'LOBBY' then
      return jsonb_build_object('status', 'idle', 'serverNow', v_now);
    end if;
    perform public._ensure_late_bunker_guest(
      v_event_id,
      v_state.run_nonce,
      v_guest.id
    );
  elsif public._bunker_run_guest_plan_is_stale(
    v_event_id,
    v_state.run_nonce
  ) then
    -- A profile may predate this forward migration while its frozen plan still
    -- reflects the old guest count. Repair that run once without assigning a
    -- second character or changing any non-guest-sized mission decisions.
    perform public._refresh_bunker_run_guest_plan(
      v_event_id,
      v_state.run_nonce
    );
  end if;

  select carriage.* into v_wagon
  from public.carriages carriage
  where carriage.id = v_guest.carriage_id and carriage.event_id = v_event_id;
  select profile.* into v_character
  from public.bunker_guest_profiles profile
  where profile.run_nonce = v_state.run_nonce and profile.guest_id = v_guest.id;
  select wagon_state.* into v_wagon_state
  from public.bunker_wagon_state wagon_state
  where wagon_state.run_nonce = v_state.run_nonce
    and wagon_state.carriage_id = v_guest.carriage_id;

  if v_character.guest_id is null or v_wagon_state.carriage_id is null then
    raise exception 'Bunker runtime is incomplete for registered guest' using errcode = '55000';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'guestId', team.guest_id,
    'realName', team.first_name || ' ' || upper(left(team.last_name, 1)) || '.',
    'profession', team.profession,
    'visibleSkill', team.visible_skill,
    'hiddenTrait', case when team.hidden_trait_revealed then team.hidden_fact else null end,
    'hiddenTraitRevealed', team.hidden_trait_revealed,
    'characterStatus', team.character_status
  ) order by team.registered_at, team.guest_id), '[]'::jsonb)
  into v_passengers
  from (
    select guest.id as guest_id, guest.first_name, guest.last_name, guest.registered_at,
      profile.profession, profile.visible_skill, profile.hidden_fact,
      profile.hidden_trait_revealed, profile.character_status
    from public.guests guest
    join public.bunker_guest_profiles profile
      on profile.guest_id = guest.id and profile.run_nonce = v_state.run_nonce
    where guest.event_id = v_event_id
      and guest.carriage_id = v_guest.carriage_id
  ) team;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', item.id, 'itemKey', item.item_key, 'quantity', item.quantity,
    'status', item.status, 'acquiredAt', item.acquired_at,
    'usedAt', item.used_at, 'transferredTo', item.transferred_to
  ) order by item.acquired_at, item.id), '[]'::jsonb)
  into v_inventory
  from public.bunker_inventory_lots item
  where item.run_nonce = v_state.run_nonce
    and item.carriage_id = v_guest.carriage_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', artifact.id, 'artifactKey', artifact.artifact_key,
    'contentType', artifact.content_type, 'content', artifact.content,
    'decryptionStatus', artifact.decryption_status,
    'acquiredAt', artifact.acquired_at, 'decodedAt', artifact.decoded_at,
    'scope', case when artifact.carriage_id is null then 'global' else 'wagon' end
  ) order by artifact.acquired_at, artifact.id), '[]'::jsonb)
  into v_archive
  from public.bunker_archive_entries artifact
  where artifact.run_nonce = v_state.run_nonce
    and (artifact.carriage_id is null or artifact.carriage_id = v_guest.carriage_id);

  return jsonb_build_object(
    'status', 'active', 'serverNow', v_now,
    'game', jsonb_build_object(
      'runNonce', v_state.run_nonce, 'state', v_state.global_game_state,
      'mode', v_state.game_mode, 'finalStartedAt', v_state.final_started_at,
      'finalDuration', v_state.final_duration,
      'bunkerRevealed', v_state.bunker_revealed
    ),
    'guest', jsonb_build_object(
      'id', v_guest.id,
      'realName', v_guest.first_name || ' ' || upper(left(v_guest.last_name, 1)) || '.',
      'joinedLate', v_character.joined_late
    ),
    'wagon', jsonb_build_object(
      'id', v_wagon.id, 'number', v_wagon.number, 'label', v_wagon.label
    ),
    'character', jsonb_build_object(
      'profession', v_character.profession, 'health', v_character.health,
      'visibleSkill', v_character.visible_skill,
      'hiddenTrait', case
        when v_character.hidden_trait_revealed then v_character.hidden_fact
        else null
      end,
      'hiddenTraitRevealed', v_character.hidden_trait_revealed,
      'specialAbility', v_character.special_ability,
      'abilityDescription', v_character.ability_description,
      'abilityUsesRemaining', v_character.ability_uses_remaining,
      'status', v_character.character_status
    ),
    'passengers', v_passengers,
    'inventory', v_inventory,
    'archive', v_archive,
    'wagonState', jsonb_build_object(
      'powerStatus', v_wagon_state.power_status,
      'communicationStatus', v_wagon_state.communication_status,
      'navigationStatus', v_wagon_state.navigation_status,
      'technicalDoorStatus', v_wagon_state.technical_door_status,
      'trackDamage', v_wagon_state.track_damage,
      'waterStatus', v_wagon_state.water_status,
      'routeChoice', v_wagon_state.route_choice,
      'routeBonus', v_wagon_state.route_bonus,
      'powerInstability', v_wagon_state.power_instability,
      'sector04Found', v_wagon_state.sector04_found,
      'coordinationBonus', v_wagon_state.coordination_bonus
    ),
    'currentMission', public._bunker_current_mission(
      v_state.run_nonce,
      v_state.global_game_state
    )
  );
end;
$$;

create or replace function public.get_bunker_screen_state(p_event_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_state public.bunker_state%rowtype;
  v_now timestamptz := clock_timestamp();
  v_remaining integer := 0;
  v_teams jsonb := '[]'::jsonb;
  v_character_counts jsonb := jsonb_build_object(
    'active', 0, 'saved', 0, 'excluded', 0
  );
begin
  select event.id into v_event_id
  from public.events event
  where event.slug = public._normalize_spaces(p_event_slug);

  if v_event_id is null then
    return jsonb_build_object('status', 'not_found', 'serverNow', v_now);
  end if;

  select state.* into v_state
  from public.bunker_state state
  where state.event_id = v_event_id;

  if v_state.event_id is null or v_state.status <> 'active' or v_state.started_at is null then
    return jsonb_build_object(
      'status', 'idle', 'teams', '[]'::jsonb,
      'characterCounts', v_character_counts, 'serverNow', v_now
    );
  end if;

  v_remaining := greatest(
    0,
    v_state.duration_seconds
      - floor(extract(epoch from (v_now - v_state.started_at)))::integer
  );

  if v_state.run_nonce is not null then
    select coalesce(jsonb_agg(team_row order by carriage_number), '[]'::jsonb)
    into v_teams
    from (
      select
        carriage.number as carriage_number,
        jsonb_build_object(
          'carriageNumber', carriage.number,
          'label', carriage.label,
          'missionAComplete', mission_a.completed_at is not null,
          'missionBComplete', mission_b.completed_at is not null
        ) as team_row
      from public.carriages carriage
      left join public.bunker_team_progress mission_a
        on mission_a.run_nonce = v_state.run_nonce
       and mission_a.carriage_id = carriage.id
       and mission_a.stage = 'mission_a'
      left join public.bunker_team_progress mission_b
        on mission_b.run_nonce = v_state.run_nonce
       and mission_b.carriage_id = carriage.id
       and mission_b.stage = 'mission_b'
      where carriage.event_id = v_event_id and carriage.enabled
    ) teams;

    select jsonb_build_object(
      'active', count(*) filter (where profile.character_status = 'active'),
      'saved', count(*) filter (where profile.character_status = 'saved'),
      'excluded', count(*) filter (where profile.character_status = 'excluded')
    )
    into v_character_counts
    from public.bunker_guest_profiles profile
    where profile.event_id = v_event_id
      and profile.run_nonce = v_state.run_nonce;
  end if;

  return jsonb_build_object(
    'status', 'active',
    'startedAt', v_state.started_at,
    'durationSeconds', v_state.duration_seconds,
    'remainingSeconds', v_remaining,
    'soundEnabled', v_state.sound_enabled,
    'phase', v_state.phase,
    'unlocked', v_state.unlocked_at is not null,
    'teams', v_teams,
    'characterCounts', v_character_counts,
    'globalGameState', v_state.global_game_state,
    'currentMission', public._bunker_current_mission(
      v_state.run_nonce,
      v_state.global_game_state
    ),
    'serverNow', v_now
  );
end;
$$;

revoke all on function public._bunker_current_mission(uuid, text)
  from public, anon, authenticated;
revoke all on function public._refresh_bunker_run_guest_plan(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public._bunker_run_guest_plan_is_stale(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public._bunker_character_matches_category(text, text)
  from public, anon, authenticated;
revoke all on function public._ensure_late_bunker_guest(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public._assign_late_bunker_guest()
  from public, anon, authenticated;
revoke all on function public.owner_advance_bunker_game_state(uuid, text)
  from public, anon, authenticated;
revoke all on function public.owner_get_bunker_control(uuid)
  from public, anon, authenticated;
revoke all on function public.owner_distribute_bunker_characters(uuid)
  from public, anon, authenticated;
revoke all on function public.owner_get_bunker_characters(uuid)
  from public, anon, authenticated;
revoke all on function public.owner_set_bunker_character_status(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_guest_bunker_runtime(text, text)
  from public, anon, authenticated;
revoke all on function public.get_bunker_screen_state(text)
  from public, anon, authenticated;

grant execute on function public.owner_advance_bunker_game_state(uuid, text)
  to authenticated;
grant execute on function public.owner_get_bunker_control(uuid)
  to authenticated;
grant execute on function public.owner_distribute_bunker_characters(uuid)
  to authenticated;
grant execute on function public.owner_get_bunker_characters(uuid)
  to authenticated;
grant execute on function public.owner_set_bunker_character_status(uuid, uuid, text)
  to authenticated;
grant execute on function public.get_guest_bunker_runtime(text, text)
  to anon, authenticated;
grant execute on function public.get_bunker_screen_state(text)
  to anon, authenticated;
