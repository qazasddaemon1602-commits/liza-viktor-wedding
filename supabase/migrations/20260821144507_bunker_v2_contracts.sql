-- Bunker V2 is forward-only. Existing contract_version=1 runs keep the
-- legacy state and RPC path until they finish or are reset.

alter table public.bunker_game_runs
  add column if not exists contract_version integer not null default 1,
  add column if not exists plan_version integer;

alter table public.bunker_character_profiles
  add column if not exists profile_version integer not null default 1
    check (profile_version > 0);

alter table public.bunker_guest_profiles
  add column if not exists profile_version integer not null default 1
    check (profile_version > 0);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bunker_game_runs_contract_version_check'
      and conrelid = 'public.bunker_game_runs'::regclass
  ) then
    alter table public.bunker_game_runs
      add constraint bunker_game_runs_contract_version_check
      check (contract_version in (1, 2));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'bunker_game_runs_plan_version_check'
      and conrelid = 'public.bunker_game_runs'::regclass
  ) then
    alter table public.bunker_game_runs
      add constraint bunker_game_runs_plan_version_check
      check (
        (contract_version = 1 and plan_version is null)
        or (contract_version = 2 and plan_version is not null and plan_version > 0)
      );
  end if;
end;
$$;

-- Preserve the callable legacy signatures while putting every V1 body behind
-- a contract-version gate. Renamed implementations are deliberately private.
alter function public._refresh_bunker_run_guest_plan(uuid, uuid)
  rename to _refresh_bunker_run_guest_plan_v1;
alter function public._bunker_run_guest_plan_is_stale(uuid, uuid)
  rename to _bunker_run_guest_plan_is_stale_v1;
alter function public._ensure_late_bunker_guest(uuid, uuid, uuid)
  rename to _ensure_late_bunker_guest_v1;
alter function public._create_bunker_game_plan(uuid, uuid)
  rename to _create_bunker_game_plan_v1;
alter function public.owner_distribute_bunker_characters(uuid)
  rename to _owner_distribute_bunker_characters_v1;

alter function public._refresh_bunker_run_guest_plan_v1(uuid, uuid)
  set search_path = '';
alter function public._bunker_run_guest_plan_is_stale_v1(uuid, uuid)
  set search_path = '';
alter function public._ensure_late_bunker_guest_v1(uuid, uuid, uuid)
  set search_path = '';
alter function public._create_bunker_game_plan_v1(uuid, uuid)
  set search_path = '';
alter function public._owner_distribute_bunker_characters_v1(uuid)
  set search_path = '';

create function public._refresh_bunker_run_guest_plan(
  p_event_id uuid,
  p_run_nonce uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_contract_version integer;
begin
  select run.contract_version into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = p_event_id and run.run_nonce = p_run_nonce
  for update;

  if not found then
    raise exception 'Bunker run plan is missing' using errcode = '55000';
  end if;
  if v_contract_version = 2 then
    raise exception 'Bunker V2 run plan is frozen' using errcode = '55000';
  end if;
  if v_contract_version is distinct from 1 then
    raise exception 'Bunker run contract is missing' using errcode = '55000';
  end if;

  perform public._refresh_bunker_run_guest_plan_v1(p_event_id, p_run_nonce);
end;
$$;

create function public._bunker_run_guest_plan_is_stale(
  p_event_id uuid,
  p_run_nonce uuid
)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_contract_version integer;
begin
  select run.contract_version into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = p_event_id and run.run_nonce = p_run_nonce;

  if v_contract_version = 2 then
    return false;
  end if;
  return public._bunker_run_guest_plan_is_stale_v1(p_event_id, p_run_nonce);
end;
$$;

create function public._ensure_late_bunker_guest(
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
  v_contract_version integer;
begin
  select run.contract_version into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = p_event_id and run.run_nonce = p_run_nonce
  for update;

  if v_contract_version = 2 then
    return false;
  end if;
  if v_contract_version is distinct from 1 then
    raise exception 'Bunker run contract is missing' using errcode = '55000';
  end if;
  return public._ensure_late_bunker_guest_v1(
    p_event_id, p_run_nonce, p_guest_id
  );
end;
$$;

create function public._create_bunker_game_plan(
  p_event_id uuid,
  p_run_nonce uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contract_version integer;
begin
  select run.contract_version into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = p_event_id and run.run_nonce = p_run_nonce
  for update;

  if v_contract_version = 2 then
    raise exception 'Bunker V2 run plan is frozen' using errcode = '55000';
  end if;
  return public._create_bunker_game_plan_v1(p_event_id, p_run_nonce);
end;
$$;

create function public.owner_distribute_bunker_characters(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.bunker_state%rowtype;
  v_contract_version integer;
begin
  perform public._require_bunker_owner(p_event_id);

  select state.* into v_state
  from public.bunker_state state
  where state.event_id = p_event_id
  for update;
  if v_state.event_id is null or v_state.run_nonce is null then
    raise exception 'Bunker game must be prepared before character distribution'
      using errcode = '55000';
  end if;

  select run.contract_version into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = p_event_id and run.run_nonce = v_state.run_nonce
  for update;
  if v_contract_version is distinct from 1 then
    raise exception 'legacy character distribution requires contract version 1'
      using errcode = '55000';
  end if;

  return public._owner_distribute_bunker_characters_v1(p_event_id);
end;
$$;

-- This trigger function must be replaced in place so the existing trigger OID
-- keeps pointing at the guarded body.
create or replace function public._assign_late_bunker_guest()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.bunker_state%rowtype;
  v_contract_version integer;
begin
  select state.* into v_state
  from public.bunker_state state
  where state.event_id = new.event_id
  for update;

  if v_state.run_nonce is null
    or v_state.global_game_state in ('LOBBY', 'FINISHED') then
    return new;
  end if;

  select run.contract_version into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = new.event_id and run.run_nonce = v_state.run_nonce;
  if v_contract_version = 2 then
    return new;
  end if;
  if v_contract_version is distinct from 1 then
    raise exception 'Bunker run contract is missing' using errcode = '55000';
  end if;

  perform public._ensure_late_bunker_guest(
    new.event_id, v_state.run_nonce, new.id
  );
  return new;
end;
$$;

revoke all on function public._refresh_bunker_run_guest_plan_v1(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public._bunker_run_guest_plan_is_stale_v1(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public._ensure_late_bunker_guest_v1(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public._create_bunker_game_plan_v1(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public._owner_distribute_bunker_characters_v1(uuid)
  from public, anon, authenticated;
revoke all on function public._refresh_bunker_run_guest_plan(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public._bunker_run_guest_plan_is_stale(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public._ensure_late_bunker_guest(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public._create_bunker_game_plan(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public._assign_late_bunker_guest()
  from public, anon, authenticated;
revoke all on function public.owner_distribute_bunker_characters(uuid)
  from public, anon, authenticated;
grant execute on function public.owner_distribute_bunker_characters(uuid)
  to authenticated;

create function public._bunker_v2_match_repeats(
  p_run_nonce uuid,
  p_base_assignments jsonb,
  p_repeat_guests jsonb
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_repeat_count integer;
  v_result jsonb;
begin
  if jsonb_typeof(p_base_assignments) <> 'array'
    or jsonb_typeof(p_repeat_guests) <> 'array' then
    raise exception 'repeat matching inputs must be arrays' using errcode = '22023';
  end if;

  v_repeat_count := jsonb_array_length(p_repeat_guests);
  if v_repeat_count = 0 then
    return '[]'::jsonb;
  end if;
  if v_repeat_count > 4 then
    raise exception 'at most four repeat assignments are supported'
      using errcode = '22023';
  end if;

  with recursive
  base as (
    select
      value->>'profileKey' as profile_key,
      (value->>'carriageId')::uuid as carriage_id,
      (value->>'ordinal')::integer as ordinal
    from jsonb_array_elements(p_base_assignments)
  ),
  repeat_guest as (
    select
      value->>'guestId' as guest_id,
      (value->>'carriageId')::uuid as carriage_id,
      (value->>'repeatIndex')::integer as repeat_index
    from jsonb_array_elements(p_repeat_guests)
  ),
  ranked_candidates as (
    select
      base.*,
      row_number() over (
        partition by base.carriage_id
        order by md5(
          p_run_nonce::text || ':candidate:' || base.profile_key
        ), base.ordinal
      ) as carriage_rank
    from base
  ),
  candidate as (
    select ranked.profile_key, ranked.carriage_id, ranked.ordinal
    from ranked_candidates ranked
    where ranked.carriage_rank <= v_repeat_count
  ),
  matching(step, used_keys, assignments, separated_count) as (
    select 0, array[]::text[], '[]'::jsonb, 0
    union all
    select
      matching.step + 1,
      matching.used_keys || candidate.profile_key,
      matching.assignments || jsonb_build_array(jsonb_build_object(
        'guestId', repeat_guest.guest_id,
        'profileKey', candidate.profile_key
      )),
      matching.separated_count
        + (candidate.carriage_id <> repeat_guest.carriage_id)::integer
    from matching
    join repeat_guest
      on repeat_guest.repeat_index = matching.step + 1
    join candidate
      on not candidate.profile_key = any(matching.used_keys)
  )
  select matching.assignments into v_result
  from matching
  where matching.step = v_repeat_count
  order by matching.separated_count desc,
    md5(p_run_nonce::text || ':matching:' || matching.assignments::text)
  limit 1;

  if v_result is null then
    raise exception 'character pool cannot produce distinct repeat assignments'
      using errcode = '55000';
  end if;
  return v_result;
end;
$$;

revoke all on function public._bunker_v2_match_repeats(uuid, jsonb, jsonb)
  from public, anon, authenticated;

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
  v_contract_version integer;
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

  select run.contract_version
  into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = p_event_id and run.run_nonce = v_state.run_nonce;

  if v_contract_version = 2 then
    raise exception 'Bunker V2 runs require owner_transition_bunker_v2'
      using errcode = '55000';
  end if;
  if v_contract_version is distinct from 1 then
    raise exception 'Bunker run contract is missing' using errcode = '55000';
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
  )
  values (
    p_event_id,
    v_state.run_nonce,
    'global_state_transition',
    'owner',
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

create or replace function public.owner_transition_bunker_v2(
  p_event_id uuid,
  p_next_state text,
  p_command_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_state public.bunker_state%rowtype;
  v_contract_version integer;
  v_current text;
  v_expected text;
  v_request_hash text;
  v_existing_receipt record;
  v_result jsonb;
  v_changed boolean;
  v_now timestamptz := clock_timestamp();
  v_instance_id uuid;
begin
  if p_command_id is null then
    raise exception 'Bunker V2 command id is required' using errcode = '22023';
  end if;
  if v_owner is null then
    raise exception 'owner access required' using errcode = '42501';
  end if;

  perform 1
  from public.events event
  where event.id = p_event_id and event.owner_user_id = v_owner;
  if not found then
    raise exception 'owner access required' using errcode = '42501';
  end if;

  select state.*
  into v_state
  from public.bunker_state state
  where state.event_id = p_event_id
  for update;
  if v_state.event_id is null or v_state.run_nonce is null then
    raise exception 'Bunker V2 run must be prepared before transition'
      using errcode = '55000';
  end if;

  -- Recheck ownership after serializing on bunker_state. This read must not
  -- lock events: guest registration holds an event FK key-share lock before
  -- its late-guest trigger reaches bunker_state.
  perform 1
  from public.events event
  where event.id = p_event_id and event.owner_user_id = v_owner;
  if not found then
    raise exception 'owner access required' using errcode = '42501';
  end if;

  select run.contract_version
  into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = p_event_id and run.run_nonce = v_state.run_nonce;
  if v_contract_version is distinct from 2 then
    raise exception 'owner_transition_bunker_v2 requires contract version 2'
      using errcode = '55000';
  end if;

  v_request_hash := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'commandType', 'owner_transition',
          'eventId', p_event_id,
          'nextState', p_next_state
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  select receipt.*
  into v_existing_receipt
  from public.bunker_command_receipts receipt
  where receipt.event_id = p_event_id
    and receipt.run_nonce = v_state.run_nonce
    and receipt.actor_kind = 'owner'
    and receipt.actor_id = v_owner
    and receipt.command_id = p_command_id;

  if v_existing_receipt.id is not null then
    if v_existing_receipt.request_hash <> v_request_hash then
      raise exception 'idempotency_conflict' using errcode = '55000';
    end if;
    return v_existing_receipt.result;
  end if;

  if p_next_state = 'STORY_BUNKER' then
    raise exception 'STORY_BUNKER is not a V2 state' using errcode = '55000';
  end if;
  if p_next_state is null or p_next_state not in (
    'LOBBY', 'CHARACTERS_READY', 'MISSION_01', 'BREAK', 'MISSION_02',
    'MISSION_03', 'MISSION_04', 'MISSION_05', 'MISSION_06',
    'UNKNOWN_PASSENGER', 'BREAK_BEFORE_FINAL', 'FINAL_30',
    'BUNKER_OPEN', 'FINISHED'
  ) then
    raise exception 'invalid Bunker V2 state' using errcode = '55000';
  end if;

  v_current := v_state.global_game_state;
  if v_current = 'STORY_BUNKER' then
    raise exception 'STORY_BUNKER is not a V2 state' using errcode = '55000';
  end if;

  v_expected := case v_current
    when 'LOBBY' then 'CHARACTERS_READY'
    when 'CHARACTERS_READY' then 'MISSION_01'
    when 'MISSION_01' then 'BREAK'
    when 'BREAK' then 'MISSION_02'
    when 'MISSION_02' then 'MISSION_03'
    when 'MISSION_03' then 'MISSION_04'
    when 'MISSION_04' then 'MISSION_05'
    when 'MISSION_05' then 'MISSION_06'
    when 'MISSION_06' then 'UNKNOWN_PASSENGER'
    when 'UNKNOWN_PASSENGER' then 'BREAK_BEFORE_FINAL'
    when 'BREAK_BEFORE_FINAL' then 'FINAL_30'
    when 'FINAL_30' then 'BUNKER_OPEN'
    when 'BUNKER_OPEN' then 'FINISHED'
    else null
  end;

  v_changed := p_next_state <> v_current;
  if v_changed and (v_expected is null or p_next_state <> v_expected) then
    raise exception 'invalid Bunker V2 state transition: % -> %',
      v_current, p_next_state using errcode = '55000';
  end if;

  if v_changed then
    update public.bunker_mission_instances instance
    set status = 'completed',
        started_at = coalesce(instance.started_at, v_now),
        completed_at = coalesce(instance.completed_at, v_now),
        outcome = coalesce(
          instance.outcome,
          jsonb_build_object('transitionedByOwner', true)
        )
    where instance.event_id = p_event_id
      and instance.run_nonce = v_state.run_nonce
      and instance.mission_code = v_current
      and instance.status in ('planned', 'active');

    update public.bunker_state
    set global_game_state = p_next_state,
        final_started_at = case
          when p_next_state = 'FINAL_30' then coalesce(final_started_at, v_now)
          else final_started_at
        end,
        final_duration = case
          when p_next_state = 'FINAL_30' then 1800
          else final_duration
        end,
        bunker_revealed = case
          when p_next_state in ('BUNKER_OPEN', 'FINISHED') then true
          else bunker_revealed
        end,
        unlocked_at = case
          when p_next_state = 'BUNKER_OPEN' then coalesce(unlocked_at, v_now)
          else unlocked_at
        end,
        updated_at = now()
    where event_id = p_event_id;

    update public.bunker_mission_instances instance
    set status = 'active',
        started_at = coalesce(instance.started_at, v_now),
        deadline_at = case
          when instance.mission_code = 'UNKNOWN_PASSENGER' then null
          else coalesce(
            instance.deadline_at,
            v_now + make_interval(
              secs => coalesce(
                (instance.definition#>>'{presentation,deadlineSeconds}')::integer,
                0
              )
            )
          )
        end
    where instance.event_id = p_event_id
      and instance.run_nonce = v_state.run_nonce
      and instance.mission_code = p_next_state
      and instance.status = 'planned';
  end if;

  select instance.id
  into v_instance_id
  from public.bunker_mission_instances instance
  where instance.event_id = p_event_id
    and instance.run_nonce = v_state.run_nonce
    and instance.mission_code = p_next_state
    and instance.scope_kind = 'global'
  limit 1;

  v_result := jsonb_build_object(
    'status', 'transitioned',
    'runNonce', v_state.run_nonce,
    'contractVersion', 2,
    'previousState', v_current,
    'globalGameState', p_next_state,
    'changed', v_changed
  );

  insert into public.bunker_command_receipts(
    event_id,
    run_nonce,
    actor_kind,
    actor_id,
    command_id,
    command_type,
    request_hash,
    result
  )
  values (
    p_event_id,
    v_state.run_nonce,
    'owner',
    v_owner,
    p_command_id,
    'owner_transition',
    v_request_hash,
    v_result
  );

  insert into public.bunker_game_events(
    event_id,
    run_nonce,
    event_type,
    actor_type,
    actor_id,
    command_id,
    correlation_id,
    instance_id,
    schema_version,
    payload
  )
  values (
    p_event_id,
    v_state.run_nonce,
    'v2_global_state_transition',
    'owner',
    v_owner,
    p_command_id,
    p_command_id,
    v_instance_id,
    2,
    jsonb_build_object(
      'previousState', v_current,
      'globalGameState', p_next_state,
      'changed', v_changed
    )
  );

  return v_result;
end;
$$;

create or replace function public.owner_prepare_bunker_v2(
  p_event_id uuid,
  p_command_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_state public.bunker_state%rowtype;
  v_existing_contract integer;
  v_existing_receipt record;
  v_run_nonce uuid;
  v_plan jsonb;
  v_request_hash text;
  v_result jsonb;
  v_wagon_count integer;
  v_guest_count integer;
  v_profile_count integer;
  v_instance_count integer;
  v_technical_target integer;
  v_medical_target integer;
  v_information_target integer;
  v_communication_target integer;
  v_analytical_target integer;
  v_bunker_target integer;
  v_navigation_target integer;
  v_profile_keys text[] := array[]::text[];
  v_selected_keys text[];
  v_category record;
begin
  if p_command_id is null then
    raise exception 'Bunker V2 command id is required' using errcode = '22023';
  end if;
  if v_owner is null then
    raise exception 'owner access required' using errcode = '42501';
  end if;

  perform 1
  from public.events event
  where event.id = p_event_id and event.owner_user_id = v_owner;
  if not found then
    raise exception 'owner access required' using errcode = '42501';
  end if;

  insert into public.bunker_state(event_id)
  values (p_event_id)
  on conflict (event_id) do nothing;

  select state.*
  into v_state
  from public.bunker_state state
  where state.event_id = p_event_id
  for update;

  -- Recheck ownership after serializing on bunker_state without taking an
  -- events row lock that can deadlock with guest registration.
  perform 1
  from public.events event
  where event.id = p_event_id and event.owner_user_id = v_owner;
  if not found then
    raise exception 'owner access required' using errcode = '42501';
  end if;

  v_request_hash := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'commandType', 'owner_prepare',
          'eventId', p_event_id
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  if v_state.run_nonce is not null then
    select run.contract_version
    into v_existing_contract
    from public.bunker_game_runs run
    where run.event_id = p_event_id and run.run_nonce = v_state.run_nonce;

    if v_existing_contract = 2 then
      select receipt.*
      into v_existing_receipt
      from public.bunker_command_receipts receipt
      where receipt.event_id = p_event_id
        and receipt.run_nonce = v_state.run_nonce
        and receipt.actor_kind = 'owner'
        and receipt.actor_id = v_owner
        and receipt.command_id = p_command_id;

      if v_existing_receipt.id is not null then
        if v_existing_receipt.request_hash <> v_request_hash then
          raise exception 'idempotency_conflict' using errcode = '55000';
        end if;
        return v_existing_receipt.result;
      end if;
    end if;

    if v_state.global_game_state <> 'FINISHED' then
      raise exception 'Bunker V2 run is already active' using errcode = '55000';
    end if;
  end if;

  select count(*)::integer
  into v_wagon_count
  from public.carriages carriage
  where carriage.event_id = p_event_id and carriage.enabled;
  if v_wagon_count not between 2 and 5 then
    raise exception 'Bunker V2 requires between 2 and 5 enabled wagons'
      using errcode = '55000';
  end if;

  select count(*)::integer
  into v_guest_count
  from public.guests guest
  where guest.event_id = p_event_id;
  if v_guest_count not between 15 and 40 then
    raise exception 'Bunker V2 requires between 15 and 40 guests'
      using errcode = '55000';
  end if;
  if exists (
    select 1
    from public.guests guest
    left join public.carriages carriage
      on carriage.id = guest.carriage_id
     and carriage.event_id = p_event_id
     and carriage.enabled
    where guest.event_id = p_event_id and carriage.id is null
  ) then
    raise exception 'Bunker V2 guests must belong to enabled wagons'
      using errcode = '55000';
  end if;

  select count(*)::integer
  into v_profile_count
  from public.bunker_character_profiles profile
  where profile.enabled;
  if v_profile_count <> 36 then
    raise exception 'Bunker V2 requires the complete 36-profile catalog'
      using errcode = '55000';
  end if;

  v_run_nonce := gen_random_uuid();

  if v_guest_count <= 18 then
    v_technical_target := 2;
    v_medical_target := 1;
    v_information_target := 1;
    v_communication_target := 2;
    v_analytical_target := 2;
    v_bunker_target := 1;
    v_navigation_target := 1;
  elsif v_guest_count <= 20 then
    v_technical_target := 2;
    v_medical_target := 2;
    v_information_target := 1;
    v_communication_target := 2;
    v_analytical_target := 2;
    v_bunker_target := 1;
    v_navigation_target := 1;
  else
    v_technical_target := 3;
    v_medical_target := 2;
    v_information_target := 2;
    v_communication_target := 3;
    v_analytical_target := 3;
    v_bunker_target := 2;
    v_navigation_target := 2;
  end if;

  for v_category in
    select category, target_count
    from (values
      ('technical'::text, v_technical_target),
      ('medical'::text, v_medical_target),
      ('information'::text, v_information_target),
      ('communication'::text, v_communication_target),
      ('analytical'::text, v_analytical_target),
      ('bunker'::text, v_bunker_target),
      ('navigation'::text, v_navigation_target)
    ) categories(category, target_count)
  loop
    select coalesce(
      array_agg(candidate.key order by candidate.order_key),
      array[]::text[]
    )
    into v_selected_keys
    from (
      select
        profile.key,
        md5(
          v_run_nonce::text || ':' || v_category.category || ':' || profile.key
        ) as order_key
      from public.bunker_character_profiles profile
      where profile.enabled
        and not (profile.key = any(v_profile_keys))
        and case v_category.category
          when 'technical' then profile.key = any(array[
            'power_engineer', 'electrician', 'mechanic', 'military_engineer'
          ]::text[])
          when 'medical' then profile.key = any(array[
            'surgeon', 'paramedic'
          ]::text[])
          when 'information' then profile.key = any(array[
            'cybersecurity_specialist', 'programmer', 'student'
          ]::text[])
          when 'communication' then profile.key = any(array[
            'signal_operator', 'radio_amateur', 'diplomat', 'psychologist'
          ]::text[])
          when 'analytical' then profile.key = any(array[
            'cartographer', 'cybersecurity_specialist', 'lawyer',
            'journalist', 'teacher', 'astronomer'
          ]::text[])
          when 'bunker' then profile.key = any(array[
            'unemployed', 'architect', 'security_guard',
            'journalist', 'military_engineer'
          ]::text[])
          when 'navigation' then profile.key = any(array[
            'geologist', 'cartographer', 'train_driver', 'driver'
          ]::text[])
          else false
        end
      order by order_key
      limit v_category.target_count
    ) candidate;

    if cardinality(v_selected_keys) <> v_category.target_count then
      raise exception 'Bunker V2 character pool cannot cover %',
        v_category.category using errcode = '55000';
    end if;
    v_profile_keys := v_profile_keys || v_selected_keys;
  end loop;

  select v_profile_keys || coalesce(
    array_agg(candidate.key order by candidate.order_key),
    array[]::text[]
  )
  into v_profile_keys
  from (
    select
      profile.key,
      md5(v_run_nonce::text || ':remaining:' || profile.key) as order_key
    from public.bunker_character_profiles profile
    where profile.enabled and not (profile.key = any(v_profile_keys))
  ) candidate;

  v_plan := public._bunker_v2_plan(p_event_id, v_run_nonce);

  insert into public.bunker_game_runs(
    run_nonce,
    event_id,
    wagon_count,
    guest_count,
    plan,
    contract_version,
    plan_version
  )
  values (
    v_run_nonce,
    p_event_id,
    v_wagon_count,
    v_guest_count,
    v_plan,
    2,
    1
  );

  update public.bunker_state
  set status = 'active',
      phase = 'emergency',
      run_nonce = v_run_nonce,
      global_game_state = 'LOBBY',
      game_mode = 'production',
      started_at = clock_timestamp(),
      phase_started_at = null,
      final_started_at = null,
      final_duration = 1800,
      unlocked_at = null,
      bunker_revealed = false,
      updated_at = now()
  where event_id = p_event_id;

  with ordered_guests as (
    select
      guest.id as guest_id,
      guest.carriage_id,
      row_number() over (
        order by md5(v_run_nonce::text || ':guest:' || guest.id::text)
      ) as ordinal,
      count(*) over () as total_count
    from public.guests guest
    where guest.event_id = p_event_id
  ),
  ordered_profiles as (
    select profile.key, profile.ordinal
    from unnest(v_profile_keys)
      with ordinality as profile(key, ordinal)
  ),
  base_assignments as (
    select
      guest.guest_id,
      guest.carriage_id,
      guest.ordinal,
      profile.key as profile_key
    from ordered_guests guest
    join ordered_profiles profile on profile.ordinal = guest.ordinal
    where guest.ordinal <= 36
  ),
  repeat_guests as (
    select
      guest.guest_id,
      guest.carriage_id,
      guest.ordinal - 36 as repeat_index
    from ordered_guests guest
    where guest.ordinal > 36
  ),
  matching_input as (
    select
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'profileKey', base.profile_key,
          'carriageId', base.carriage_id,
          'ordinal', base.ordinal
        ) order by base.ordinal)
        from base_assignments base
      ), '[]'::jsonb) as base_assignments,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'guestId', repeat_guest.guest_id,
          'carriageId', repeat_guest.carriage_id,
          'repeatIndex', repeat_guest.repeat_index
        ) order by repeat_guest.repeat_index)
        from repeat_guests repeat_guest
      ), '[]'::jsonb) as repeat_guests
  ),
  repeat_assignments as (
    select
      (matched.value->>'guestId')::uuid as guest_id,
      repeat_guest.carriage_id,
      matched.value->>'profileKey' as profile_key
    from matching_input input
    cross join lateral jsonb_array_elements(
      public._bunker_v2_match_repeats(
        v_run_nonce, input.base_assignments, input.repeat_guests
      )
    ) matched(value)
    join repeat_guests repeat_guest
      on repeat_guest.guest_id = (matched.value->>'guestId')::uuid
  ),
  assignments as (
    select base.guest_id, base.carriage_id, base.profile_key
    from base_assignments base
    union all
    select repeat_assignment.guest_id,
      repeat_assignment.carriage_id,
      repeat_assignment.profile_key
    from repeat_assignments repeat_assignment
  )
  insert into public.bunker_guest_profiles(
    event_id,
    run_nonce,
    guest_id,
    profession,
    profile,
    health,
    hobby,
    baggage,
    hidden_fact,
    ability_tags,
    character_profile_key,
    visible_skill,
    special_ability,
    ability_description,
    character_status,
    hidden_trait_revealed,
    ability_uses_remaining,
    profile_version,
    joined_late,
    assigned_at
  )
  select
    p_event_id,
    v_run_nonce,
    assignment.guest_id,
    profile.profession,
    'ПАССАЖИР СОСТАВА',
    profile.health,
    profile.visible_skill,
    'НЕТ ДАННЫХ',
    profile.hidden_trait,
    profile.tags,
    profile.key,
    profile.visible_skill,
    profile.special_ability,
    profile.ability_description,
    'active',
    false,
    1,
    profile.profile_version,
    false,
    now()
  from assignments assignment
  join public.bunker_character_profiles profile
    on profile.key = assignment.profile_key;

  insert into public.bunker_wagon_state(event_id, run_nonce, carriage_id)
  select p_event_id, v_run_nonce, carriage.id
  from public.carriages carriage
  where carriage.event_id = p_event_id and carriage.enabled;

  insert into public.bunker_inventory_lots(
    event_id, run_nonce, carriage_id, item_key, quantity
  )
  select p_event_id, v_run_nonce, carriage.id, seed.item_key, seed.quantity
  from public.carriages carriage
  cross join (values
    ('medkit', 1),
    ('radio', 1),
    ('generator', 1),
    ('tools', 1),
    ('water', 2),
    ('gas_mask', 1)
  ) as seed(item_key, quantity)
  where carriage.event_id = p_event_id and carriage.enabled;

  insert into public.bunker_mission_instances(
    event_id,
    run_nonce,
    mission_code,
    scope_kind,
    scope_key,
    definition
  )
  select
    p_event_id,
    v_run_nonce,
    mission.mission_code,
    'wagon',
    carriage.id::text,
    jsonb_build_object(
      'contractVersion', 2,
      'planVersion', 1,
      'wagonId', carriage.id,
      'missionCode', mission.mission_code,
      'presentation', jsonb_build_object(
        'deadlineSeconds', mission.deadline_seconds
      ),
      'quota', case
        when mission.mission_code = 'MISSION_01' then mission_01.value->'quota'
        else null
      end,
      'scenario', case
        when mission.mission_code = 'MISSION_05' then mission_05.value
        else null
      end
    )
  from public.carriages carriage
  cross join (values
    ('MISSION_01', 240),
    ('MISSION_02', 300),
    ('MISSION_03', 360),
    ('MISSION_05', 90)
  ) as mission(mission_code, deadline_seconds)
  left join lateral (
    select planned.value
    from jsonb_array_elements(v_plan->'mission01') planned(value)
    where planned.value->>'wagonId' = carriage.id::text
  ) mission_01 on true
  left join lateral (
    select planned.value
    from jsonb_array_elements(v_plan->'mission05') planned(value)
    where planned.value->>'wagonId' = carriage.id::text
  ) mission_05 on true
  where carriage.event_id = p_event_id and carriage.enabled;

  insert into public.bunker_mission_instances(
    event_id,
    run_nonce,
    mission_code,
    scope_kind,
    scope_key,
    definition
  )
  select
    p_event_id,
    v_run_nonce,
    'MISSION_04',
    'group',
    mission_group.value->>'groupKey',
    jsonb_build_object(
      'contractVersion', 2,
      'planVersion', 1,
      'missionCode', 'MISSION_04',
      'wagonIds', mission_group.value->'wagonIds',
      'operatorGuestIds', mission_group.value->'operatorGuestIds',
      'interactionPhase', 'exchange',
      'presentation', jsonb_build_object('deadlineSeconds', 300)
    )
  from jsonb_array_elements(v_plan#>'{mission04,groups}') mission_group(value);

  insert into public.bunker_mission_instances(
    event_id,
    run_nonce,
    mission_code,
    scope_kind,
    scope_key,
    definition
  )
  values
    (
      p_event_id,
      v_run_nonce,
      'MISSION_06',
      'global',
      'global',
      jsonb_build_object(
        'contractVersion', 2,
        'planVersion', 1,
        'missionCode', 'MISSION_06',
        'fragments', v_plan->'mission06',
        'presentation', jsonb_build_object('deadlineSeconds', 480)
      )
    ),
    (
      p_event_id,
      v_run_nonce,
      'UNKNOWN_PASSENGER',
      'global',
      'global',
      jsonb_build_object(
        'contractVersion', 2,
        'planVersion', 1,
        'missionCode', 'UNKNOWN_PASSENGER',
        'actionWindowSeconds', 60,
        'presentation', jsonb_build_object('deadlineSeconds', null)
      )
    ),
    (
      p_event_id,
      v_run_nonce,
      'FINAL_30',
      'global',
      'global',
      jsonb_build_object(
        'contractVersion', 2,
        'planVersion', 1,
        'missionCode', 'FINAL_30',
        'parameterDistribution', v_plan->'final',
        'finalBaseSeconds', 1800,
        'finalBonusMinSeconds', -300,
        'finalBonusMaxSeconds', 600,
        'presentation', jsonb_build_object('deadlineSeconds', 1800)
      )
    );

  with eligible_members as (
    select
      instance.id as instance_id,
      instance.mission_code,
      guest.id as guest_id,
      guest.carriage_id,
      profile.character_profile_key,
      profile.profile_version,
      row_number() over (
        partition by instance.id, guest.carriage_id
        order by case
          when instance.mission_code = 'MISSION_04'
            then md5(v_run_nonce::text || ':m04:' || guest.id::text)
          else md5(
            v_run_nonce::text || ':' || instance.mission_code || ':' || guest.id::text
          )
        end
      ) as wagon_ordinal
    from public.bunker_mission_instances instance
    join public.guests guest on guest.event_id = p_event_id
    join public.bunker_guest_profiles profile
      on profile.event_id = p_event_id
     and profile.run_nonce = v_run_nonce
     and profile.guest_id = guest.id
    where instance.event_id = p_event_id
      and instance.run_nonce = v_run_nonce
      and (
        (instance.scope_kind = 'wagon' and instance.scope_key = guest.carriage_id::text)
        or (
          instance.scope_kind = 'group'
          and instance.definition->'wagonIds' @> jsonb_build_array(guest.carriage_id)
        )
        or instance.scope_kind = 'global'
      )
  )
  insert into public.bunker_mission_members(
    event_id,
    run_nonce,
    instance_id,
    guest_id,
    carriage_id,
    member_role,
    action_limit,
    frozen_snapshot
  )
  select
    p_event_id,
    v_run_nonce,
    member.instance_id,
    member.guest_id,
    member.carriage_id,
    case
      when member.mission_code = 'MISSION_03' and member.wagon_ordinal = 1
        then 'captain'
      when member.mission_code = 'MISSION_04' and member.wagon_ordinal = 1
        then 'operator'
      when member.mission_code = 'MISSION_06' then 'voter'
      else 'member'
    end,
    1,
    jsonb_build_object(
      'guestId', member.guest_id,
      'carriageId', member.carriage_id,
      'characterProfileKey', member.character_profile_key,
      'profileVersion', member.profile_version
    )
  from eligible_members member;

  insert into public.bunker_final_parameters(
    event_id,
    run_nonce,
    parameter_key,
    canonical_value,
    normalized_value
  )
  values
    (p_event_id, v_run_nonce, 'coordinates', '57°09 / 65°32', '5709/6532'),
    (p_event_id, v_run_nonce, 'sector', '04', '04'),
    (p_event_id, v_run_nonce, 'access_code', '4719', '4719'),
    (p_event_id, v_run_nonce, 'gate_time', '23:40', '23:40'),
    (p_event_id, v_run_nonce, 'password', 'LV0830', 'LV0830');

  select count(*)::integer
  into v_instance_count
  from public.bunker_mission_instances instance
  where instance.event_id = p_event_id and instance.run_nonce = v_run_nonce;

  v_result := jsonb_build_object(
    'status', 'prepared',
    'eventId', p_event_id,
    'runNonce', v_run_nonce,
    'contractVersion', 2,
    'planVersion', 1,
    'globalGameState', 'LOBBY',
    'wagonCount', v_wagon_count,
    'guestCount', v_guest_count,
    'missionInstanceCount', v_instance_count
  );

  insert into public.bunker_command_receipts(
    event_id,
    run_nonce,
    actor_kind,
    actor_id,
    command_id,
    command_type,
    request_hash,
    result
  )
  values (
    p_event_id,
    v_run_nonce,
    'owner',
    v_owner,
    p_command_id,
    'owner_prepare',
    v_request_hash,
    v_result
  );

  insert into public.bunker_game_events(
    event_id,
    run_nonce,
    event_type,
    actor_type,
    actor_id,
    command_id,
    correlation_id,
    schema_version,
    payload
  )
  values (
    p_event_id,
    v_run_nonce,
    'v2_run_prepared',
    'owner',
    v_owner,
    p_command_id,
    p_command_id,
    2,
    jsonb_build_object(
      'contractVersion', 2,
      'planVersion', 1,
      'wagonCount', v_wagon_count,
      'guestCount', v_guest_count,
      'missionInstanceCount', v_instance_count
    )
  );

  return v_result;
end;
$$;

alter table public.bunker_state
  drop constraint if exists bunker_state_global_game_state_check;

alter table public.bunker_state
  add constraint bunker_state_global_game_state_check
  check (global_game_state in (
    'LOBBY', 'CHARACTERS_READY', 'MISSION_01', 'BREAK', 'MISSION_02',
    'MISSION_03', 'MISSION_04', 'MISSION_05', 'MISSION_06',
    'STORY_BUNKER', 'UNKNOWN_PASSENGER', 'BREAK_BEFORE_FINAL',
    'FINAL_30', 'BUNKER_OPEN', 'FINISHED'
  ));

create unique index carriages_id_event_uidx
  on public.carriages(id, event_id);
create unique index guests_id_event_uidx
  on public.guests(id, event_id);
create unique index bunker_inventory_lots_id_event_run_uidx
  on public.bunker_inventory_lots(id, event_id, run_nonce);
create unique index bunker_archive_entries_id_event_run_uidx
  on public.bunker_archive_entries(id, event_id, run_nonce);

create table public.bunker_mission_instances (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  run_nonce uuid not null,
  mission_code text not null check (
    mission_code in (
      'MISSION_01', 'MISSION_02', 'MISSION_03', 'MISSION_04',
      'MISSION_05', 'MISSION_06', 'UNKNOWN_PASSENGER', 'FINAL_30'
    )
  ),
  scope_kind text not null check (scope_kind in ('wagon', 'group', 'global')),
  scope_key text not null check (length(btrim(scope_key)) > 0),
  status text not null default 'planned'
    check (status in ('planned', 'active', 'completed', 'expired', 'cancelled')),
  instance_version integer not null default 1 check (instance_version > 0),
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  outcome jsonb check (outcome is null or jsonb_typeof(outcome) = 'object'),
  started_at timestamptz,
  deadline_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique (run_nonce, mission_code, scope_key),
  unique (id, event_id, run_nonce),
  foreign key (event_id, run_nonce)
    references public.bunker_game_runs(event_id, run_nonce) on delete cascade,
  check (deadline_at is null or started_at is not null),
  check (completed_at is null or started_at is not null)
);

create table public.bunker_mission_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  run_nonce uuid not null,
  instance_id uuid not null,
  guest_id uuid not null,
  carriage_id uuid not null,
  member_role text not null default 'member'
    check (member_role in ('member', 'captain', 'operator', 'voter')),
  member_status text not null default 'planned'
    check (member_status in ('planned', 'ready', 'confirmed', 'completed', 'expired')),
  action_limit integer not null default 1 check (action_limit >= 0),
  actions_used integer not null default 0
    check (actions_used >= 0 and actions_used <= action_limit),
  frozen_snapshot jsonb not null check (jsonb_typeof(frozen_snapshot) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (instance_id, guest_id),
  foreign key (event_id, run_nonce)
    references public.bunker_game_runs(event_id, run_nonce) on delete cascade,
  foreign key (instance_id, event_id, run_nonce)
    references public.bunker_mission_instances(id, event_id, run_nonce)
    on delete cascade,
  constraint bunker_mission_members_guest_event_fkey
    foreign key (guest_id, event_id)
    references public.guests(id, event_id) on delete cascade,
  constraint bunker_mission_members_carriage_event_fkey
    foreign key (carriage_id, event_id)
    references public.carriages(id, event_id) on delete cascade
);

create table public.bunker_mission_decisions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  run_nonce uuid not null,
  instance_id uuid not null,
  decision_key text not null check (decision_key ~ '^[a-z][a-z0-9_]+$'),
  actor_kind text not null check (actor_kind in ('owner', 'guest', 'wagon', 'group', 'system')),
  actor_id uuid,
  actor_scope_key text not null check (length(btrim(actor_scope_key)) > 0),
  status text not null default 'submitted'
    check (status in ('submitted', 'confirmed', 'superseded', 'expired')),
  instance_version integer not null check (instance_version > 0),
  command_id uuid not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  outcome jsonb check (outcome is null or jsonb_typeof(outcome) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  confirmed_at timestamptz,
  unique (instance_id, decision_key, actor_kind, actor_scope_key),
  foreign key (event_id, run_nonce)
    references public.bunker_game_runs(event_id, run_nonce) on delete cascade,
  foreign key (instance_id, event_id, run_nonce)
    references public.bunker_mission_instances(id, event_id, run_nonce)
    on delete cascade,
  check ((status = 'confirmed') = (confirmed_at is not null))
);

create table public.bunker_ability_uses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  run_nonce uuid not null,
  instance_id uuid not null,
  guest_id uuid not null,
  ability_key text not null check (ability_key ~ '^[a-z][a-z0-9_]+$'),
  problem_key text check (problem_key is null or problem_key ~ '^[a-z][a-z0-9_]+$'),
  status text not null default 'pending'
    check (status in ('pending', 'committed', 'rejected', 'expired')),
  command_id uuid not null,
  effect jsonb check (effect is null or jsonb_typeof(effect) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  committed_at timestamptz,
  unique (run_nonce, guest_id, ability_key),
  foreign key (event_id, run_nonce)
    references public.bunker_game_runs(event_id, run_nonce) on delete cascade,
  foreign key (instance_id, event_id, run_nonce)
    references public.bunker_mission_instances(id, event_id, run_nonce)
    on delete cascade,
  constraint bunker_ability_uses_guest_event_fkey
    foreign key (guest_id, event_id)
    references public.guests(id, event_id) on delete cascade,
  check ((status = 'committed') = (committed_at is not null))
);

create table public.bunker_inventory_transfers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  run_nonce uuid not null,
  instance_id uuid not null,
  source_lot_id uuid not null,
  accepted_lot_id uuid,
  from_carriage_id uuid not null,
  to_carriage_id uuid not null,
  proposed_by_guest_id uuid not null,
  item_key text not null check (item_key ~ '^[a-z][a-z0-9_]+$'),
  quantity integer not null check (quantity > 0),
  status text not null default 'proposed'
    check (status in ('proposed', 'accepted', 'rejected', 'expired')),
  command_id uuid not null,
  offered_at timestamptz not null default clock_timestamp(),
  settled_at timestamptz,
  unique (id, event_id, run_nonce),
  foreign key (event_id, run_nonce)
    references public.bunker_game_runs(event_id, run_nonce) on delete cascade,
  foreign key (instance_id, event_id, run_nonce)
    references public.bunker_mission_instances(id, event_id, run_nonce)
    on delete cascade,
  constraint bunker_inventory_transfers_source_lot_run_fkey
    foreign key (source_lot_id, event_id, run_nonce)
    references public.bunker_inventory_lots(id, event_id, run_nonce)
    on delete restrict,
  constraint bunker_inventory_transfers_accepted_lot_run_fkey
    foreign key (accepted_lot_id, event_id, run_nonce)
    references public.bunker_inventory_lots(id, event_id, run_nonce)
    on delete restrict,
  constraint bunker_inventory_transfers_from_carriage_event_fkey
    foreign key (from_carriage_id, event_id)
    references public.carriages(id, event_id) on delete restrict,
  constraint bunker_inventory_transfers_to_carriage_event_fkey
    foreign key (to_carriage_id, event_id)
    references public.carriages(id, event_id) on delete restrict,
  constraint bunker_inventory_transfers_guest_event_fkey
    foreign key (proposed_by_guest_id, event_id)
    references public.guests(id, event_id) on delete restrict,
  check (from_carriage_id <> to_carriage_id),
  check ((status = 'proposed') = (settled_at is null)),
  check ((status = 'accepted') = (accepted_lot_id is not null))
);

create table public.bunker_archive_entitlements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  run_nonce uuid not null,
  archive_entry_id uuid not null,
  carriage_id uuid,
  owner_scope_kind text not null check (owner_scope_kind in ('wagon', 'global')),
  owner_scope_key text not null check (length(btrim(owner_scope_key)) > 0),
  status text not null default 'active'
    check (status in ('active', 'transferred', 'revoked')),
  source_entitlement_id uuid,
  source_transfer_id uuid,
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
  granted_at timestamptz not null default clock_timestamp(),
  transferred_at timestamptz,
  unique (id, event_id, run_nonce),
  unique (run_nonce, archive_entry_id, owner_scope_kind, owner_scope_key),
  foreign key (event_id, run_nonce)
    references public.bunker_game_runs(event_id, run_nonce) on delete cascade,
  constraint bunker_archive_entitlements_archive_run_fkey
    foreign key (archive_entry_id, event_id, run_nonce)
    references public.bunker_archive_entries(id, event_id, run_nonce)
    on delete restrict,
  constraint bunker_archive_entitlements_carriage_event_fkey
    foreign key (carriage_id, event_id)
    references public.carriages(id, event_id) on delete restrict,
  constraint bunker_archive_entitlements_source_run_fkey
    foreign key (source_entitlement_id, event_id, run_nonce)
    references public.bunker_archive_entitlements(id, event_id, run_nonce)
    on delete restrict,
  constraint bunker_archive_entitlements_transfer_run_fkey
    foreign key (source_transfer_id, event_id, run_nonce)
    references public.bunker_inventory_transfers(id, event_id, run_nonce)
    on delete restrict,
  check ((owner_scope_kind = 'wagon') = (carriage_id is not null)),
  check ((status = 'transferred') = (transferred_at is not null))
);

create table public.bunker_final_parameters (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  run_nonce uuid not null,
  parameter_key text not null
    check (parameter_key in ('coordinates', 'sector', 'access_code', 'gate_time', 'password')),
  canonical_value text not null check (length(btrim(canonical_value)) > 0),
  normalized_value text not null check (length(btrim(normalized_value)) > 0),
  status text not null default 'locked'
    check (status in ('locked', 'partial', 'resolved')),
  source_kind text,
  source_instance_id uuid,
  public_hint jsonb not null default '{}'::jsonb check (jsonb_typeof(public_hint) = 'object'),
  resolved_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique (run_nonce, parameter_key),
  foreign key (event_id, run_nonce)
    references public.bunker_game_runs(event_id, run_nonce) on delete cascade,
  constraint bunker_final_parameters_source_instance_run_fkey
    foreign key (source_instance_id, event_id, run_nonce)
    references public.bunker_mission_instances(id, event_id, run_nonce)
    on delete restrict,
  check ((status = 'resolved') = (resolved_at is not null))
);

create table public.bunker_command_receipts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  run_nonce uuid not null,
  actor_kind text not null check (actor_kind in ('owner', 'guest')),
  actor_id uuid not null,
  command_id uuid not null,
  command_type text not null check (command_type ~ '^[a-z][a-z0-9_]+$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  unique (run_nonce, actor_kind, actor_id, command_id),
  foreign key (event_id, run_nonce)
    references public.bunker_game_runs(event_id, run_nonce) on delete cascade
);

alter table public.bunker_game_events
  add column if not exists sequence bigint generated always as (id) stored,
  add column if not exists command_id uuid,
  add column if not exists instance_id uuid,
  add column if not exists actor_id uuid,
  add column if not exists correlation_id uuid,
  add column if not exists schema_version integer not null default 1
    check (schema_version > 0);

alter table public.bunker_game_events
  add constraint bunker_game_events_instance_run_fkey
  foreign key (instance_id, event_id, run_nonce)
  references public.bunker_mission_instances(id, event_id, run_nonce)
  on delete set null (instance_id);

-- The run reset is an AFTER UPDATE trigger. Remove provenance dependents in a
-- deterministic child-first order before the run's broad cascades execute.
create or replace function public._clear_bunker_game_run_on_reset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if old.run_nonce is not null and new.run_nonce is null then
    loop
      delete from public.bunker_archive_entitlements entitlement
      where entitlement.event_id = old.event_id
        and not exists (
          select 1
          from public.bunker_archive_entitlements child
          where child.event_id = entitlement.event_id
            and child.run_nonce = entitlement.run_nonce
            and child.source_entitlement_id = entitlement.id
        );
      get diagnostics v_deleted = row_count;
      exit when v_deleted = 0;
    end loop;

    if exists (
      select 1
      from public.bunker_archive_entitlements entitlement
      where entitlement.event_id = old.event_id
    ) then
      raise exception 'cyclic Bunker archive entitlement provenance'
        using errcode = '23514';
    end if;

    delete from public.bunker_final_parameters parameter
    where parameter.event_id = old.event_id;

    delete from public.bunker_inventory_transfers transfer
    where transfer.event_id = old.event_id;

    -- Reset is destroying these runs, so their nullable provenance links no
    -- longer carry ledger value. Break self references before run cascades.
    update public.bunker_inventory_lots lot
    set source_lot_id = null
    where lot.event_id = old.event_id
      and lot.source_lot_id is not null;

    delete from public.bunker_game_runs run
    where run.event_id = old.event_id;
  end if;
  return new;
end;
$$;

revoke all on function public._clear_bunker_game_run_on_reset()
  from public, anon, authenticated;

create unique index bunker_game_events_run_sequence_idx
  on public.bunker_game_events(run_nonce, sequence);
create index bunker_game_events_command_idx
  on public.bunker_game_events(run_nonce, command_id)
  where command_id is not null;
create index bunker_game_events_instance_idx
  on public.bunker_game_events(instance_id)
  where instance_id is not null;
create index bunker_game_events_event_run_idx
  on public.bunker_game_events(event_id, run_nonce);

create index bunker_mission_instances_event_run_idx
  on public.bunker_mission_instances(event_id, run_nonce);
create index bunker_mission_instances_active_idx
  on public.bunker_mission_instances(run_nonce, mission_code, status)
  where status in ('planned', 'active');
create index bunker_mission_members_event_run_idx
  on public.bunker_mission_members(event_id, run_nonce);
create index bunker_mission_members_instance_role_idx
  on public.bunker_mission_members(instance_id, member_role, member_status);
create index bunker_mission_members_guest_idx
  on public.bunker_mission_members(run_nonce, guest_id);
create index bunker_mission_members_guest_fk_idx
  on public.bunker_mission_members(guest_id);
create index bunker_mission_members_carriage_fk_idx
  on public.bunker_mission_members(carriage_id);
create index bunker_mission_decisions_event_run_idx
  on public.bunker_mission_decisions(event_id, run_nonce);
create index bunker_mission_decisions_instance_status_idx
  on public.bunker_mission_decisions(instance_id, status, created_at);
create index bunker_ability_uses_event_run_idx
  on public.bunker_ability_uses(event_id, run_nonce);
create index bunker_ability_uses_instance_status_idx
  on public.bunker_ability_uses(instance_id, status);
create index bunker_ability_uses_guest_fk_idx
  on public.bunker_ability_uses(guest_id);
create index bunker_inventory_transfers_event_run_idx
  on public.bunker_inventory_transfers(event_id, run_nonce);
create index bunker_inventory_transfers_instance_idx
  on public.bunker_inventory_transfers(instance_id);
create index bunker_inventory_transfers_open_idx
  on public.bunker_inventory_transfers(run_nonce, to_carriage_id, offered_at)
  where status = 'proposed';
create index bunker_inventory_transfers_source_lot_idx
  on public.bunker_inventory_transfers(source_lot_id);
create index bunker_inventory_transfers_accepted_lot_idx
  on public.bunker_inventory_transfers(accepted_lot_id)
  where accepted_lot_id is not null;
create index bunker_inventory_transfers_from_carriage_idx
  on public.bunker_inventory_transfers(from_carriage_id);
create index bunker_inventory_transfers_to_carriage_idx
  on public.bunker_inventory_transfers(to_carriage_id);
create index bunker_inventory_transfers_proposed_by_guest_idx
  on public.bunker_inventory_transfers(proposed_by_guest_id);
create index bunker_archive_entitlements_event_run_idx
  on public.bunker_archive_entitlements(event_id, run_nonce);
create index bunker_archive_entitlements_active_idx
  on public.bunker_archive_entitlements(run_nonce, owner_scope_kind, owner_scope_key)
  where status = 'active';
create index bunker_archive_entitlements_entry_idx
  on public.bunker_archive_entitlements(archive_entry_id);
create index bunker_archive_entitlements_carriage_idx
  on public.bunker_archive_entitlements(carriage_id)
  where carriage_id is not null;
create index bunker_archive_entitlements_source_idx
  on public.bunker_archive_entitlements(source_entitlement_id)
  where source_entitlement_id is not null;
create index bunker_archive_entitlements_transfer_idx
  on public.bunker_archive_entitlements(source_transfer_id)
  where source_transfer_id is not null;
create index bunker_final_parameters_event_run_idx
  on public.bunker_final_parameters(event_id, run_nonce);
create index bunker_final_parameters_status_idx
  on public.bunker_final_parameters(run_nonce, status);
create index bunker_final_parameters_source_instance_idx
  on public.bunker_final_parameters(source_instance_id)
  where source_instance_id is not null;
create index bunker_command_receipts_event_run_idx
  on public.bunker_command_receipts(event_id, run_nonce);
create index bunker_command_receipts_command_idx
  on public.bunker_command_receipts(command_id);

alter table public.bunker_mission_instances enable row level security;
alter table public.bunker_mission_members enable row level security;
alter table public.bunker_mission_decisions enable row level security;
alter table public.bunker_ability_uses enable row level security;
alter table public.bunker_inventory_transfers enable row level security;
alter table public.bunker_archive_entitlements enable row level security;
alter table public.bunker_final_parameters enable row level security;
alter table public.bunker_command_receipts enable row level security;

revoke all on table public.bunker_mission_instances from public, anon, authenticated;
revoke all on table public.bunker_mission_members from public, anon, authenticated;
revoke all on table public.bunker_mission_decisions from public, anon, authenticated;
revoke all on table public.bunker_ability_uses from public, anon, authenticated;
revoke all on table public.bunker_inventory_transfers from public, anon, authenticated;
revoke all on table public.bunker_archive_entitlements from public, anon, authenticated;
revoke all on table public.bunker_final_parameters from public, anon, authenticated;
revoke all on table public.bunker_command_receipts from public, anon, authenticated;

create or replace function public._bunker_v2_plan(
  p_event_id uuid,
  p_run_nonce uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_wagon_ids uuid[];
  v_wagon_count integer;
  v_guest_count integer;
  v_wagon_snapshots jsonb;
  v_mission_01 jsonb;
  v_mission_04_groups jsonb;
  v_mission_05 jsonb;
  v_mission_06 jsonb;
  v_final jsonb;
begin
  if p_event_id is null or p_run_nonce is null then
    raise exception 'Bunker V2 event and run are required' using errcode = '22023';
  end if;

  select array_agg(carriage.id order by carriage.sort_order, carriage.number, carriage.id)
  into v_wagon_ids
  from public.carriages carriage
  where carriage.event_id = p_event_id and carriage.enabled;

  v_wagon_count := coalesce(cardinality(v_wagon_ids), 0);

  select count(*)::integer
  into v_guest_count
  from public.guests guest
  where guest.event_id = p_event_id;

  if v_wagon_count not between 2 and 5 then
    raise exception 'Bunker V2 requires between 2 and 5 enabled wagons'
      using errcode = '55000';
  end if;
  if v_guest_count not between 15 and 40 then
    raise exception 'Bunker V2 requires between 15 and 40 guests'
      using errcode = '55000';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'wagonId', wagon.id,
        'number', wagon.number,
        'label', wagon.label,
        'sortOrder', wagon.sort_order,
        'guestCount', wagon.guest_count,
        'guestIds', wagon.guest_ids,
        'm01Quota', case
          when wagon.guest_count = 0 then 0
          when wagon.guest_count >= 10 then 3
          when wagon.guest_count >= 7 then 2
          else 1
        end
      )
      order by wagon.sort_order, wagon.number, wagon.id
    ),
    '[]'::jsonb
  )
  into v_wagon_snapshots
  from (
    select
      carriage.id,
      carriage.number,
      carriage.label,
      carriage.sort_order,
      count(guest.id)::integer as guest_count,
      coalesce(
        jsonb_agg(guest.id order by guest.registered_at, guest.id)
          filter (where guest.id is not null),
        '[]'::jsonb
      ) as guest_ids
    from public.carriages carriage
    left join public.guests guest
      on guest.event_id = p_event_id
     and guest.carriage_id = carriage.id
    where carriage.event_id = p_event_id and carriage.enabled
    group by carriage.id, carriage.number, carriage.label, carriage.sort_order
  ) wagon;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'wagonId', snapshot.value->'wagonId',
        'wagonSize', snapshot.value->'guestCount',
        'quota', snapshot.value->'m01Quota',
        'memberGuestIds', snapshot.value->'guestIds'
      )
      order by snapshot.ordinal
    ),
    '[]'::jsonb
  )
  into v_mission_01
  from jsonb_array_elements(v_wagon_snapshots)
    with ordinality as snapshot(value, ordinal);

  v_mission_04_groups := case v_wagon_count
    when 2 then jsonb_build_array(
      jsonb_build_object(
        'groupKey', 'group_1',
        'wagonIds', jsonb_build_array(v_wagon_ids[1], v_wagon_ids[2])
      )
    )
    when 3 then jsonb_build_array(
      jsonb_build_object(
        'groupKey', 'group_1',
        'wagonIds', jsonb_build_array(
          v_wagon_ids[1], v_wagon_ids[2], v_wagon_ids[3]
        )
      )
    )
    when 4 then jsonb_build_array(
      jsonb_build_object(
        'groupKey', 'group_1',
        'wagonIds', jsonb_build_array(v_wagon_ids[1], v_wagon_ids[3])
      ),
      jsonb_build_object(
        'groupKey', 'group_2',
        'wagonIds', jsonb_build_array(v_wagon_ids[2], v_wagon_ids[4])
      )
    )
    when 5 then jsonb_build_array(
      jsonb_build_object(
        'groupKey', 'group_1',
        'wagonIds', jsonb_build_array(v_wagon_ids[1], v_wagon_ids[2])
      ),
      jsonb_build_object(
        'groupKey', 'group_2',
        'wagonIds', jsonb_build_array(
          v_wagon_ids[3], v_wagon_ids[4], v_wagon_ids[5]
        )
      )
    )
  end;

  select coalesce(
    jsonb_agg(
      mission_group.value || jsonb_build_object(
        'operatorGuestIds', (
          select coalesce(
            jsonb_agg(
              operator_assignment.guest_id
              order by operator_assignment.sort_order
            ),
            '[]'::jsonb
          )
          from (
            select
              carriage.sort_order,
              (
                select guest.id
                from public.guests guest
                where guest.event_id = p_event_id
                  and guest.carriage_id = carriage.id
                order by md5(p_run_nonce::text || ':m04:' || guest.id::text)
                limit 1
              ) as guest_id
            from public.carriages carriage
            where carriage.id in (
              select wagon_id.value::uuid
              from jsonb_array_elements_text(mission_group.value->'wagonIds')
                as wagon_id(value)
            )
          ) operator_assignment
          where operator_assignment.guest_id is not null
        )
      )
      order by mission_group.ordinal
    ),
    '[]'::jsonb
  )
  into v_mission_04_groups
  from jsonb_array_elements(v_mission_04_groups)
    with ordinality as mission_group(value, ordinal);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'wagonId', carriage.id,
        'scenarioKey', 'route_' || substr(
          md5(p_run_nonce::text || ':m05:' || carriage.id::text), 1, 12
        ),
        'choices', jsonb_build_array('A', 'B')
      )
      order by carriage.sort_order, carriage.number, carriage.id
    ),
    '[]'::jsonb
  )
  into v_mission_05
  from public.carriages carriage
  where carriage.event_id = p_event_id and carriage.enabled;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'wagonId', active.wagon_id,
        'fragmentIndex', active.ordinal,
        'totalFragments', v_wagon_count,
        'requiredWagonIds', to_jsonb(array_remove(v_wagon_ids, active.wagon_id))
      )
      order by active.ordinal
    ),
    '[]'::jsonb
  )
  into v_mission_06
  from unnest(v_wagon_ids) with ordinality as active(wagon_id, ordinal);

  if v_wagon_count = 2 then
    v_final := jsonb_build_array(
      jsonb_build_object('wagonId', v_wagon_ids[1], 'parameter', 'sector', 'part', 1, 'totalParts', 1),
      jsonb_build_object('wagonId', v_wagon_ids[1], 'parameter', 'coordinates', 'part', 1, 'totalParts', 2),
      jsonb_build_object('wagonId', v_wagon_ids[1], 'parameter', 'access_code', 'part', 1, 'totalParts', 1),
      jsonb_build_object('wagonId', v_wagon_ids[2], 'parameter', 'coordinates', 'part', 2, 'totalParts', 2),
      jsonb_build_object('wagonId', v_wagon_ids[2], 'parameter', 'gate_time', 'part', 1, 'totalParts', 1),
      jsonb_build_object('wagonId', v_wagon_ids[2], 'parameter', 'password', 'part', 1, 'totalParts', 1)
    );
  elsif v_wagon_count = 3 then
    v_final := jsonb_build_array(
      jsonb_build_object('wagonId', v_wagon_ids[1], 'parameter', 'coordinates', 'part', 1, 'totalParts', 2),
      jsonb_build_object('wagonId', v_wagon_ids[1], 'parameter', 'access_code', 'part', 1, 'totalParts', 2),
      jsonb_build_object('wagonId', v_wagon_ids[2], 'parameter', 'sector', 'part', 1, 'totalParts', 1),
      jsonb_build_object('wagonId', v_wagon_ids[2], 'parameter', 'gate_time', 'part', 1, 'totalParts', 1),
      jsonb_build_object('wagonId', v_wagon_ids[3], 'parameter', 'coordinates', 'part', 2, 'totalParts', 2),
      jsonb_build_object('wagonId', v_wagon_ids[3], 'parameter', 'access_code', 'part', 2, 'totalParts', 2),
      jsonb_build_object('wagonId', v_wagon_ids[3], 'parameter', 'password', 'part', 1, 'totalParts', 1)
    );
  else
    select jsonb_agg(
      jsonb_build_object(
        'wagonId', v_wagon_ids[1 + mod(unit.ordinal - 1, v_wagon_count)],
        'parameter', unit.parameter,
        'part', unit.part,
        'totalParts', unit.total_parts
      )
      order by unit.ordinal
    )
    into v_final
    from (values
      ('coordinates', 1, 2, 1),
      ('sector', 1, 1, 2),
      ('access_code', 1, 2, 3),
      ('gate_time', 1, 1, 4),
      ('password', 1, 1, 5),
      ('coordinates', 2, 2, 6),
      ('access_code', 2, 2, 7)
    ) as unit(parameter, part, total_parts, ordinal);
  end if;

  return jsonb_build_object(
    'contractVersion', 2,
    'planVersion', 1,
    'catalogVersion', 1,
    'runNonce', p_run_nonce,
    'wagonCount', v_wagon_count,
    'guestCount', v_guest_count,
    'activeWagonIds', to_jsonb(v_wagon_ids),
    'wagonSnapshots', v_wagon_snapshots,
    'mission01', v_mission_01,
    'mission04', jsonb_build_object('groups', v_mission_04_groups),
    'mission05', v_mission_05,
    'mission06', v_mission_06,
    'final', v_final,
    'finalBaseSeconds', 1800,
    'finalBonusMinSeconds', -300,
    'finalBonusMaxSeconds', 600
  );
end;
$$;

revoke all on function public._bunker_v2_plan(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.owner_prepare_bunker_v2(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.owner_transition_bunker_v2(uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.owner_advance_bunker_game_state(uuid, text)
  from public, anon, authenticated;

grant execute on function public.owner_prepare_bunker_v2(uuid, uuid)
  to authenticated;
grant execute on function public.owner_transition_bunker_v2(uuid, text, uuid)
  to authenticated;
grant execute on function public.owner_advance_bunker_game_state(uuid, text)
  to authenticated;
