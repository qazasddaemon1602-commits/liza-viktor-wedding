alter table public.bunker_guest_profiles
  add column ability_tags text[] not null default '{}'::text[],
  add constraint bunker_guest_profiles_ability_tags_valid check (
    ability_tags <@ array[
      'technical', 'medical', 'communication', 'bunker_knowledge', 'analytical'
    ]::text[]
  );

alter table public.bunker_mission_templates
  rename column carriage_number to variant_index;

create table public.bunker_game_runs (
  run_nonce uuid primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  wagon_count integer not null check (wagon_count between 2 and 5),
  guest_count integer not null check (guest_count >= 0),
  plan jsonb not null check (jsonb_typeof(plan) = 'object'),
  created_at timestamptz not null default now(),
  unique (event_id, run_nonce)
);

create index bunker_game_runs_event_idx
  on public.bunker_game_runs(event_id, created_at desc);

alter table public.bunker_game_runs enable row level security;
revoke all on table public.bunker_game_runs from public, anon, authenticated;

create or replace function public._bunker_default_ability_tags()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tags constant text[] := array[
    'technical', 'medical', 'communication', 'bunker_knowledge', 'analytical'
  ];
  v_index integer;
begin
  if cardinality(new.ability_tags) = 0 then
    v_index := 1 + mod(
      hashtext(new.run_nonce::text || ':' || new.guest_id::text)::bigint + 2147483648,
      cardinality(v_tags)
    )::integer;
    new.ability_tags := array[v_tags[v_index]];
  end if;
  return new;
end;
$$;

create trigger bunker_guest_profiles_default_ability_tags
before insert on public.bunker_guest_profiles
for each row execute function public._bunker_default_ability_tags();

create or replace function public._balance_bunker_ability_tags(
  p_event_id uuid,
  p_run_nonce uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tags constant text[] := array[
    'technical', 'medical', 'communication', 'bunker_knowledge', 'analytical'
  ];
  v_guest_ids uuid[];
  v_guest_count integer;
  v_tag text;
  v_ordinal integer;
  v_guest_id uuid;
begin
  select array_agg(p.guest_id order by md5(p_run_nonce::text || ':' || p.guest_id::text))
  into v_guest_ids
  from public.bunker_guest_profiles p
  where p.event_id = p_event_id and p.run_nonce = p_run_nonce;

  v_guest_count := coalesce(cardinality(v_guest_ids), 0);
  if v_guest_count = 0 then
    return;
  end if;

  update public.bunker_guest_profiles p
  set ability_tags = array[
    v_tags[1 + mod(
      hashtext(p_run_nonce::text || ':' || p.guest_id::text)::bigint + 2147483648,
      cardinality(v_tags)
    )::integer]
  ]
  where p.event_id = p_event_id and p.run_nonce = p_run_nonce;

  for v_tag, v_ordinal in
    select tag, ordinal::integer
    from unnest(v_tags) with ordinality as required(tag, ordinal)
  loop
    v_guest_id := v_guest_ids[1 + mod(v_ordinal - 1, v_guest_count)];
    update public.bunker_guest_profiles
    set ability_tags = case
      when v_tag = any(ability_tags) then ability_tags
      else array_append(ability_tags, v_tag)
    end
    where event_id = p_event_id
      and run_nonce = p_run_nonce
      and guest_id = v_guest_id;
  end loop;
end;
$$;

create or replace function public._create_bunker_game_plan(
  p_event_id uuid,
  p_run_nonce uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wagons uuid[];
  v_wagon_count integer;
  v_guest_count integer;
  v_mission_01 jsonb;
  v_mission_04 jsonb;
  v_mission_06 jsonb;
  v_final jsonb;
  v_plan jsonb;
begin
  select array_agg(c.id order by c.sort_order, c.number, c.id)
  into v_wagons
  from public.carriages c
  where c.event_id = p_event_id and c.enabled;

  v_wagon_count := coalesce(cardinality(v_wagons), 0);
  if v_wagon_count not between 2 and 5 then
    raise exception 'Bunker requires between two and five active wagons' using errcode = '55000';
  end if;

  select count(*)::integer into v_guest_count
  from public.guests g where g.event_id = p_event_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'wagonId', wagon.id,
    'wagonSize', wagon.guest_count,
    'exclusionCount', case
      when wagon.guest_count = 0 then 0
      when wagon.guest_count >= 10 then 3
      when wagon.guest_count >= 7 then 2
      else 1
    end
  ) order by wagon.ordinal), '[]'::jsonb)
  into v_mission_01
  from (
    select
      c.id,
      row_number() over (order by c.sort_order, c.number, c.id) as ordinal,
      count(g.id)::integer as guest_count
    from public.carriages c
    left join public.guests g on g.carriage_id = c.id and g.event_id = p_event_id
    where c.event_id = p_event_id and c.enabled
    group by c.id, c.sort_order, c.number
  ) wagon;

  v_mission_04 := case v_wagon_count
    when 2 then jsonb_build_array(jsonb_build_array(v_wagons[1], v_wagons[2]))
    when 3 then jsonb_build_array(jsonb_build_array(v_wagons[1], v_wagons[2], v_wagons[3]))
    when 4 then jsonb_build_array(
      jsonb_build_array(v_wagons[1], v_wagons[3]),
      jsonb_build_array(v_wagons[2], v_wagons[4])
    )
    when 5 then jsonb_build_array(
      jsonb_build_array(v_wagons[1], v_wagons[2]),
      jsonb_build_array(v_wagons[3], v_wagons[4], v_wagons[5])
    )
  end;

  select jsonb_agg(jsonb_build_object(
    'wagonId', wagon_id,
    'fragmentIndex', ordinal,
    'totalFragments', v_wagon_count,
    'requiredWagonIds', to_jsonb(array_remove(v_wagons, wagon_id))
  ) order by ordinal)
  into v_mission_06
  from unnest(v_wagons) with ordinality as active(wagon_id, ordinal);

  if v_wagon_count = 2 then
    v_final := jsonb_build_array(
      jsonb_build_object('wagonId', v_wagons[1], 'parameter', 'sector', 'part', 1, 'totalParts', 1),
      jsonb_build_object('wagonId', v_wagons[1], 'parameter', 'coordinates', 'part', 1, 'totalParts', 2),
      jsonb_build_object('wagonId', v_wagons[1], 'parameter', 'code', 'part', 1, 'totalParts', 1),
      jsonb_build_object('wagonId', v_wagons[2], 'parameter', 'coordinates', 'part', 2, 'totalParts', 2),
      jsonb_build_object('wagonId', v_wagons[2], 'parameter', 'gateway_time', 'part', 1, 'totalParts', 1),
      jsonb_build_object('wagonId', v_wagons[2], 'parameter', 'password', 'part', 1, 'totalParts', 1)
    );
  elsif v_wagon_count = 3 then
    v_final := jsonb_build_array(
      jsonb_build_object('wagonId', v_wagons[1], 'parameter', 'coordinates', 'part', 1, 'totalParts', 2),
      jsonb_build_object('wagonId', v_wagons[1], 'parameter', 'code', 'part', 1, 'totalParts', 2),
      jsonb_build_object('wagonId', v_wagons[2], 'parameter', 'sector', 'part', 1, 'totalParts', 1),
      jsonb_build_object('wagonId', v_wagons[2], 'parameter', 'gateway_time', 'part', 1, 'totalParts', 1),
      jsonb_build_object('wagonId', v_wagons[3], 'parameter', 'coordinates', 'part', 2, 'totalParts', 2),
      jsonb_build_object('wagonId', v_wagons[3], 'parameter', 'code', 'part', 2, 'totalParts', 2),
      jsonb_build_object('wagonId', v_wagons[3], 'parameter', 'password', 'part', 1, 'totalParts', 1)
    );
  else
    select jsonb_agg(jsonb_build_object(
      'wagonId', v_wagons[1 + mod(unit.ordinal - 1, v_wagon_count)],
      'parameter', unit.parameter,
      'part', unit.part,
      'totalParts', unit.total_parts
    ) order by unit.ordinal)
    into v_final
    from (values
      ('coordinates', 1, 2, 1),
      ('sector', 1, 1, 2),
      ('code', 1, 2, 3),
      ('gateway_time', 1, 1, 4),
      ('password', 1, 1, 5),
      ('coordinates', 2, 2, 6),
      ('code', 2, 2, 7)
    ) as unit(parameter, part, total_parts, ordinal);
  end if;

  v_plan := jsonb_build_object(
    'wagonCount', v_wagon_count,
    'guestCount', v_guest_count,
    'activeWagonIds', to_jsonb(v_wagons),
    'mission01', v_mission_01,
    'mission04', jsonb_build_object('groups', v_mission_04),
    'mission06', v_mission_06,
    'final', v_final
  );

  insert into public.bunker_game_runs(run_nonce, event_id, wagon_count, guest_count, plan)
  values (p_run_nonce, p_event_id, v_wagon_count, v_guest_count, v_plan)
  on conflict (run_nonce) do update
  set wagon_count = excluded.wagon_count,
      guest_count = excluded.guest_count,
      plan = excluded.plan;

  return v_plan;
end;
$$;

create or replace function public._ensure_bunker_team_progress(
  p_event_id uuid,
  p_run_nonce uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.bunker_team_progress(
    event_id, run_nonce, carriage_id, stage, mission_template_id, reward_fragment
  )
  select
    p_event_id,
    p_run_nonce,
    active.carriage_id,
    template.stage,
    template.id,
    case when template.stage = 'mission_b'
      then lpad((10 + floor(random() * 90)::integer)::text, 2, '0')
      else null
    end
  from (
    select
      c.id as carriage_id,
      row_number() over (order by c.sort_order, c.number, c.id) as ordinal
    from public.carriages c
    where c.event_id = p_event_id and c.enabled
  ) active
  cross join (values ('mission_a'), ('mission_b')) as stages(stage)
  join public.bunker_mission_templates template
    on template.stage = stages.stage
   and template.variant_index = 1 + mod(active.ordinal - 1, 5)
  on conflict (run_nonce, carriage_id, stage) do nothing;
end;
$$;

create or replace function public.owner_begin_bunker_quest(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state public.bunker_state%rowtype;
  v_guest record;
  v_started timestamptz := clock_timestamp();
begin
  perform public._require_bunker_owner(p_event_id);

  select b.* into v_state
  from public.bunker_state b
  where b.event_id = p_event_id
  for update;

  if v_state.event_id is null or v_state.status <> 'active' or v_state.run_nonce is null then
    raise exception 'bunker emergency must be active first' using errcode = '55000';
  end if;
  if v_state.phase not in ('emergency', 'dossier_1') then
    raise exception 'bunker quest already advanced' using errcode = '55000';
  end if;

  perform public._create_bunker_game_plan(p_event_id, v_state.run_nonce);
  perform public._ensure_bunker_team_progress(p_event_id, v_state.run_nonce);

  for v_guest in select g.id from public.guests g where g.event_id = p_event_id loop
    perform public._ensure_bunker_guest_profile(p_event_id, v_state.run_nonce, v_guest.id);
  end loop;
  perform public._balance_bunker_ability_tags(p_event_id, v_state.run_nonce);

  update public.bunker_state
  set phase = 'dossier_1', phase_started_at = v_started, updated_at = now()
  where event_id = p_event_id;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    p_event_id,
    auth.uid(),
    'bunker_quest_started',
    jsonb_build_object('phase', 'dossier_1', 'runNonce', v_state.run_nonce)
  );

  return public.owner_get_bunker_quest(p_event_id);
end;
$$;

create or replace function public.submit_guest_bunker_final_code(
  p_event_slug text,
  p_device_key text,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_event_id uuid;
  v_guest_id uuid;
  v_state public.bunker_state%rowtype;
  v_expected text;
  v_required_count integer := 0;
  v_completed_count integer := 0;
  v_submitted text := regexp_replace(coalesce(p_code, ''), '[^0-9]', '', 'g');
  v_correct boolean := false;
begin
  select e.id into v_event_id from public.events e
  where e.slug = public._normalize_spaces(p_event_slug);
  v_guest_id := public._bunker_guest_id(p_event_slug, p_device_key);
  if v_event_id is null or v_guest_id is null then
    raise exception 'guest access required' using errcode = '42501';
  end if;

  select b.* into v_state from public.bunker_state b
  where b.event_id = v_event_id for update;
  if v_state.event_id is null or v_state.status <> 'active' or v_state.phase not in ('final', 'completed') then
    raise exception 'bunker final access is not active' using errcode = '55000';
  end if;
  if v_state.unlocked_at is not null then
    return jsonb_build_object('status', 'unlocked', 'unlocked', true);
  end if;

  select count(*)::integer into v_required_count
  from public.carriages c where c.event_id = v_event_id and c.enabled;

  select count(*)::integer, string_agg(p.reward_fragment, '' order by c.sort_order, c.number, c.id)
  into v_completed_count, v_expected
  from public.bunker_team_progress p
  join public.carriages c on c.id = p.carriage_id
  where p.event_id = v_event_id
    and p.run_nonce = v_state.run_nonce
    and p.stage = 'mission_b'
    and p.completed_at is not null;

  if v_completed_count < v_required_count or v_expected is null then
    return jsonb_build_object('status', 'not_ready', 'unlocked', false);
  end if;

  v_correct := v_submitted = v_expected;
  insert into public.bunker_final_attempts(event_id, run_nonce, guest_id, submitted_code_hash, correct)
  values (
    v_event_id, v_state.run_nonce, v_guest_id,
    encode(extensions.digest(v_submitted, 'sha256'), 'hex'), v_correct
  );
  if not v_correct then
    return jsonb_build_object('status', 'incorrect', 'unlocked', false);
  end if;

  update public.bunker_state
  set unlocked_at = coalesce(unlocked_at, clock_timestamp()), updated_at = now()
  where event_id = v_event_id;
  return jsonb_build_object('status', 'unlocked', 'unlocked', true);
end;
$$;

create or replace function public._clear_bunker_game_run_on_reset()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.run_nonce is not null and new.run_nonce is null then
    delete from public.bunker_game_runs where event_id = old.event_id;
  end if;
  return new;
end;
$$;

create trigger bunker_state_clear_game_run_on_reset
after update of run_nonce on public.bunker_state
for each row execute function public._clear_bunker_game_run_on_reset();

alter function public.get_guest_bunker_state(text, text)
  rename to _get_guest_bunker_state_before_adaptive_plan;

revoke all on function public._get_guest_bunker_state_before_adaptive_plan(text, text)
  from public, anon, authenticated;

create or replace function public.get_guest_bunker_state(
  p_event_slug text,
  p_device_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_event_id uuid;
  v_guest_id uuid;
  v_run_nonce uuid;
  v_ability_tags text[] := '{}'::text[];
begin
  v_result := public._get_guest_bunker_state_before_adaptive_plan(p_event_slug, p_device_key);
  if v_result->>'status' <> 'active' or v_result->'dossier' = 'null'::jsonb then
    return v_result;
  end if;

  select e.id into v_event_id
  from public.events e where e.slug = public._normalize_spaces(p_event_slug);
  v_guest_id := public._bunker_guest_id(p_event_slug, p_device_key);
  select b.run_nonce into v_run_nonce
  from public.bunker_state b where b.event_id = v_event_id;

  select p.ability_tags into v_ability_tags
  from public.bunker_guest_profiles p
  where p.event_id = v_event_id
    and p.run_nonce = v_run_nonce
    and p.guest_id = v_guest_id;

  return jsonb_set(
    v_result,
    '{dossier,abilityTags}',
    to_jsonb(coalesce(v_ability_tags, '{}'::text[])),
    true
  );
end;
$$;

revoke all on function public.get_guest_bunker_state(text, text) from public;
grant execute on function public.get_guest_bunker_state(text, text) to anon, authenticated;

revoke all on function public._bunker_default_ability_tags() from public, anon, authenticated;
revoke all on function public._balance_bunker_ability_tags(uuid, uuid) from public, anon, authenticated;
revoke all on function public._create_bunker_game_plan(uuid, uuid) from public, anon, authenticated;
revoke all on function public._clear_bunker_game_run_on_reset() from public, anon, authenticated;
