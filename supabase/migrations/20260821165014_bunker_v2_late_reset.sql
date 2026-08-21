-- Bunker V2 keeps its prepared plan immutable. Registrations after prepare get
-- one saved character snapshot, but never become frozen mission members.

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
  v_contract_version integer;
  v_guest public.guests%rowtype;
  v_profile public.bunker_character_profiles%rowtype;
  v_inserted boolean := false;
begin
  select run.contract_version
  into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = p_event_id and run.run_nonce = p_run_nonce;
  if v_contract_version is null then
    raise exception 'Bunker run contract is missing' using errcode = '55000';
  end if;

  if v_contract_version = 1 then
    perform 1
    from public.bunker_game_runs run
    where run.event_id = p_event_id and run.run_nonce = p_run_nonce
    for update;
    return public._ensure_late_bunker_guest_v1(
      p_event_id, p_run_nonce, p_guest_id
    );
  end if;
  if v_contract_version <> 2 then
    raise exception 'Bunker run contract is missing' using errcode = '55000';
  end if;

  -- Registration already holds the event row, so this lock is re-entrant in
  -- the trigger path. Other V2 repair callers acquire event before run too.
  perform 1
  from public.events event
  where event.id = p_event_id
  for key share;
  if not found then
    raise exception 'Bunker event is missing' using errcode = '55000';
  end if;

  select run.contract_version
  into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = p_event_id and run.run_nonce = p_run_nonce
  for update;
  if v_contract_version is distinct from 2 then
    raise exception 'Bunker V2 run changed during late registration'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.bunker_guest_profiles assigned
    where assigned.event_id = p_event_id
      and assigned.run_nonce = p_run_nonce
      and assigned.guest_id = p_guest_id
  ) then
    return false;
  end if;

  select guest.*
  into v_guest
  from public.guests guest
  where guest.id = p_guest_id and guest.event_id = p_event_id;
  if v_guest.id is null then
    raise exception 'registered Bunker guest required' using errcode = '42501';
  end if;

  select candidate.*
  into v_profile
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
  values (
    p_event_id,
    p_run_nonce,
    p_guest_id,
    v_profile.profession,
    'ПАССАЖИР СОСТАВА',
    v_profile.health,
    v_profile.visible_skill,
    'НЕТ ДАННЫХ',
    v_profile.hidden_trait,
    v_profile.tags,
    v_profile.key,
    v_profile.visible_skill,
    v_profile.special_ability,
    v_profile.ability_description,
    'saved',
    false,
    v_profile.max_uses,
    v_profile.profile_version,
    true,
    now()
  )
  on conflict (run_nonce, guest_id) do nothing
  returning true into v_inserted;

  if not coalesce(v_inserted, false) then
    return false;
  end if;

  insert into public.bunker_game_events(
    event_id,
    run_nonce,
    carriage_id,
    guest_id,
    event_type,
    actor_type,
    schema_version,
    payload
  )
  values (
    p_event_id,
    p_run_nonce,
    v_guest.carriage_id,
    p_guest_id,
    'late_guest_joined',
    'system',
    2,
    jsonb_build_object(
      'characterProfileKey', v_profile.key,
      'profileVersion', v_profile.profile_version,
      'characterStatus', 'saved',
      'm01Eligibility', 'late_joiner'
    )
  );

  return true;
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
  v_contract_version integer;
begin
  select state.*
  into v_state
  from public.bunker_state state
  where state.event_id = new.event_id
  for update;

  if v_state.run_nonce is null then
    return new;
  end if;

  select run.contract_version
  into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = new.event_id and run.run_nonce = v_state.run_nonce;
  if v_contract_version is null then
    raise exception 'Bunker run contract is missing' using errcode = '55000';
  end if;

  if v_contract_version = 1
    and v_state.global_game_state in ('LOBBY', 'FINISHED') then
    return new;
  end if;

  perform public._ensure_late_bunker_guest(
    new.event_id, v_state.run_nonce, new.id
  );
  return new;
end;
$$;

-- Serialize ability creation with owner transitions on the instance row. A
-- planned instance is future and an active instance is current; every other
-- status is closed to new ability use.
create or replace function public._guard_bunker_v2_ability_instance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_instance_status text;
begin
  select instance.status
  into v_instance_status
  from public.bunker_mission_instances instance
  where instance.id = new.instance_id
    and instance.event_id = new.event_id
    and instance.run_nonce = new.run_nonce
  for update;

  if v_instance_status is null then
    raise exception 'Bunker ability instance is missing' using errcode = '55000';
  end if;
  if v_instance_status not in ('planned', 'active') then
    raise exception 'Bunker ability instance is complete' using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists bunker_v2_ability_instance_incomplete
  on public.bunker_ability_uses;
create trigger bunker_v2_ability_instance_incomplete
before insert or update of instance_id on public.bunker_ability_uses
for each row execute function public._guard_bunker_v2_ability_instance();

-- Keep the legacy runtime callable behind a version-dispatching wrapper.
alter function public.get_guest_bunker_runtime(text, text)
  rename to _get_guest_bunker_runtime_v1;
alter function public._get_guest_bunker_runtime_v1(text, text)
  set search_path = '';

create or replace function public.get_guest_bunker_v2_runtime(
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
  v_run public.bunker_game_runs%rowtype;
  v_character public.bunker_guest_profiles%rowtype;
  v_instance public.bunker_mission_instances%rowtype;
  v_character_json jsonb;
  v_current_mission jsonb := null;
  v_now timestamptz := clock_timestamp();
begin
  select event.id
  into v_event_id
  from public.events event
  where event.slug = public._normalize_spaces(p_event_slug);
  if v_event_id is null then
    return jsonb_build_object(
      'contractVersion', 2, 'status', 'not_found', 'serverNow', v_now
    );
  end if;

  select guest.*
  into v_guest
  from public.guests guest
  where guest.id = public._bunker_guest_id(p_event_slug, p_device_key)
    and guest.event_id = v_event_id;
  if v_guest.id is null then
    return jsonb_build_object(
      'contractVersion', 2, 'status', 'guest_not_found', 'serverNow', v_now
    );
  end if;

  select state.*
  into v_state
  from public.bunker_state state
  where state.event_id = v_event_id;
  if v_state.run_nonce is null then
    return jsonb_build_object(
      'contractVersion', 2, 'status', 'idle', 'serverNow', v_now
    );
  end if;

  select run.*
  into v_run
  from public.bunker_game_runs run
  where run.event_id = v_event_id and run.run_nonce = v_state.run_nonce;
  if v_run.contract_version is distinct from 2 then
    return jsonb_build_object(
      'contractVersion', 2, 'status', 'idle', 'serverNow', v_now
    );
  end if;

  select profile.*
  into v_character
  from public.bunker_guest_profiles profile
  where profile.event_id = v_event_id
    and profile.run_nonce = v_state.run_nonce
    and profile.guest_id = v_guest.id;
  if v_character.guest_id is null then
    perform public._ensure_late_bunker_guest(
      v_event_id, v_state.run_nonce, v_guest.id
    );
    select profile.*
    into v_character
    from public.bunker_guest_profiles profile
    where profile.event_id = v_event_id
      and profile.run_nonce = v_state.run_nonce
      and profile.guest_id = v_guest.id;
  end if;
  if v_character.guest_id is null then
    raise exception 'Bunker runtime is incomplete for registered guest'
      using errcode = '55000';
  end if;

  select carriage.*
  into v_wagon
  from public.carriages carriage
  where carriage.id = v_guest.carriage_id and carriage.event_id = v_event_id;
  if v_wagon.id is null then
    raise exception 'Bunker wagon is missing for registered guest'
      using errcode = '55000';
  end if;

  if v_state.global_game_state in (
    'MISSION_01', 'MISSION_02', 'MISSION_03', 'MISSION_04',
    'MISSION_05', 'MISSION_06', 'UNKNOWN_PASSENGER', 'FINAL_30'
  ) then
    select instance.*
    into v_instance
    from public.bunker_mission_instances instance
    where instance.event_id = v_event_id
      and instance.run_nonce = v_state.run_nonce
      and instance.mission_code = v_state.global_game_state
      and instance.status in ('planned', 'active')
      and (
        (instance.scope_kind = 'wagon'
          and instance.scope_key = v_guest.carriage_id::text)
        or (instance.scope_kind = 'group'
          and instance.definition->'wagonIds'
            @> jsonb_build_array(v_guest.carriage_id))
        or instance.scope_kind = 'global'
      )
    order by case instance.scope_kind
      when 'wagon' then 1 when 'group' then 2 else 3 end
    limit 1;
    if v_instance.id is null then
      raise exception 'Bunker current mission is missing for registered guest'
        using errcode = '55000';
    end if;
    v_current_mission := jsonb_build_object(
      'instanceId', v_instance.id,
      'instanceVersion', v_instance.instance_version,
      'code', v_instance.mission_code,
      'status', v_instance.status,
      'scope', v_instance.scope_kind
    );
  end if;

  v_character_json := jsonb_build_object(
    'profileKey', v_character.character_profile_key,
    'profileVersion', v_character.profile_version,
    'profession', v_character.profession,
    'health', v_character.health,
    'visibleSkill', v_character.visible_skill,
    'specialAbility', v_character.special_ability,
    'abilityDescription', v_character.ability_description,
    'abilityUsesRemaining', v_character.ability_uses_remaining,
    'status', v_character.character_status,
    'm01Eligibility', case
      when v_character.joined_late then 'late_joiner' else 'frozen_member'
    end,
    'hiddenTraitRevealed', v_character.hidden_trait_revealed
  );
  if v_character.hidden_trait_revealed then
    v_character_json := v_character_json || jsonb_build_object(
      'hiddenTrait', v_character.hidden_fact
    );
  end if;

  return jsonb_build_object(
    'contractVersion', 2,
    'status', 'active',
    'serverNow', v_now,
    'state', v_state.global_game_state,
    'planVersion', v_run.plan_version,
    'runNonce', v_state.run_nonce,
    'viewer', jsonb_build_object(
      'kind', 'guest',
      'guest', jsonb_build_object(
        'id', v_guest.id,
        'realName', v_guest.first_name || ' '
          || upper(left(v_guest.last_name, 1)) || '.'
      ),
      'wagon', jsonb_build_object(
        'number', v_wagon.number,
        'label', v_wagon.label
      )
    ),
    'character', v_character_json,
    'currentMission', v_current_mission
  );
end;
$$;

create function public.get_guest_bunker_runtime(
  p_event_slug text,
  p_device_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contract_version integer;
begin
  select run.contract_version
  into v_contract_version
  from public.events event
  join public.bunker_state state on state.event_id = event.id
  join public.bunker_game_runs run
    on run.event_id = event.id and run.run_nonce = state.run_nonce
  where event.slug = public._normalize_spaces(p_event_slug);

  if v_contract_version = 2 then
    return public.get_guest_bunker_v2_runtime(p_event_slug, p_device_key);
  end if;
  return public._get_guest_bunker_runtime_v1(p_event_slug, p_device_key);
end;
$$;

-- Scope cleanup to the run removed from bunker_state. This retains other run
-- history and all guest/device/wedding configuration while deleting the V2
-- projection graph in immediate-FK-safe order.
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
        and entitlement.run_nonce = old.run_nonce
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
        and entitlement.run_nonce = old.run_nonce
    ) then
      raise exception 'cyclic Bunker archive entitlement provenance'
        using errcode = '23514';
    end if;

    delete from public.bunker_final_parameters parameter
    where parameter.event_id = old.event_id
      and parameter.run_nonce = old.run_nonce;

    delete from public.bunker_inventory_transfers transfer
    where transfer.event_id = old.event_id
      and transfer.run_nonce = old.run_nonce;

    update public.bunker_inventory_lots lot
    set source_lot_id = null
    where lot.event_id = old.event_id
      and lot.run_nonce = old.run_nonce
      and lot.source_lot_id is not null;

    delete from public.bunker_game_runs run
    where run.event_id = old.event_id
      and run.run_nonce = old.run_nonce;
  end if;
  return new;
end;
$$;

alter function public.owner_reset_event_test_data(uuid, text)
  set search_path = '';

revoke all on function public._ensure_late_bunker_guest(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public._assign_late_bunker_guest()
  from public, anon, authenticated;
revoke all on function public._guard_bunker_v2_ability_instance()
  from public, anon, authenticated;
revoke all on function public._get_guest_bunker_runtime_v1(text, text)
  from public, anon, authenticated;
revoke all on function public.get_guest_bunker_v2_runtime(text, text)
  from public, anon, authenticated;
revoke all on function public.get_guest_bunker_runtime(text, text)
  from public, anon, authenticated;
revoke all on function public._clear_bunker_game_run_on_reset()
  from public, anon, authenticated;

grant execute on function public.get_guest_bunker_v2_runtime(text, text)
  to anon, authenticated;
grant execute on function public.get_guest_bunker_runtime(text, text)
  to anon, authenticated;
