create or replace function public.submit_bunker_command(
  p_event_slug text,
  p_device_key text,
  p_command_id uuid,
  p_command_type text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_guest public.guests%rowtype;
  v_state public.bunker_state%rowtype;
  v_run public.bunker_game_runs%rowtype;
  v_instance public.bunker_mission_instances%rowtype;
  v_existing_receipt public.bunker_command_receipts%rowtype;
  v_instance_id uuid;
  v_instance_version integer;
  v_selection jsonb;
  v_quota integer;
  v_selected_count integer;
  v_distinct_count integer;
  v_selected_ids uuid[];
  v_saved_ids uuid[];
  v_request_hash text;
  v_outcome jsonb;
  v_result jsonb;
  v_now timestamptz := clock_timestamp();
begin
  if p_command_id is null then
    raise exception 'Bunker V2 command id is required' using errcode = '22023';
  end if;
  if coalesce(btrim(p_command_type), '') = ''
    or p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
  then
    raise exception 'Bunker V2 command and object payload are required'
      using errcode = '22023';
  end if;

  select event.id
  into v_event_id
  from public.events event
  where event.slug = public._normalize_spaces(p_event_slug);
  if v_event_id is null then
    raise exception 'Bunker event not found' using errcode = 'P0002';
  end if;

  select guest.*
  into v_guest
  from public.guests guest
  where guest.event_id = v_event_id
    and guest.id = public._bunker_guest_id(p_event_slug, p_device_key);
  if v_guest.id is null then
    raise exception 'registered Bunker guest required' using errcode = '42501';
  end if;

  select state.*
  into v_state
  from public.bunker_state state
  where state.event_id = v_event_id
  for update;
  if v_state.event_id is null or v_state.run_nonce is null then
    raise exception 'active Bunker V2 run required' using errcode = '55000';
  end if;

  select run.*
  into v_run
  from public.bunker_game_runs run
  where run.event_id = v_event_id and run.run_nonce = v_state.run_nonce;
  if v_run.contract_version is distinct from 2 then
    raise exception 'active Bunker V2 run required' using errcode = '55000';
  end if;

  v_request_hash := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'commandType', p_command_type,
          'payload', p_payload
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
  where receipt.event_id = v_event_id
    and receipt.run_nonce = v_state.run_nonce
    and receipt.actor_kind = 'guest'
    and receipt.actor_id = v_guest.id
    and receipt.command_id = p_command_id;
  if v_existing_receipt.id is not null then
    if v_existing_receipt.request_hash <> v_request_hash then
      raise exception 'idempotency_conflict' using errcode = '55000';
    end if;
    return v_existing_receipt.result;
  end if;

  if p_command_type <> 'mission_confirm' then
    raise exception 'unsupported Bunker V2 command type' using errcode = '22023';
  end if;
  if v_state.global_game_state <> 'MISSION_01' then
    raise exception 'M01 is not the current Bunker V2 stage' using errcode = '55000';
  end if;
  if not (p_payload ?& array['instanceId', 'instanceVersion', 'selection'])
    or (select count(*) from jsonb_object_keys(p_payload)) <> 3
    or jsonb_typeof(p_payload->'selection') <> 'array'
  then
    raise exception 'invalid M01 confirmation payload' using errcode = '22023';
  end if;

  begin
    v_instance_id := (p_payload->>'instanceId')::uuid;
    v_instance_version := (p_payload->>'instanceVersion')::integer;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'invalid M01 confirmation payload' using errcode = '22023';
  end;
  v_selection := p_payload->'selection';

  select instance.*
  into v_instance
  from public.bunker_mission_instances instance
  where instance.event_id = v_event_id
    and instance.run_nonce = v_state.run_nonce
    and instance.id = v_instance_id
  for update;
  if v_instance.id is null or v_instance.mission_code <> 'MISSION_01' then
    raise exception 'M01 instance not found' using errcode = 'P0002';
  end if;
  if v_instance.scope_kind <> 'wagon'
    or v_instance.scope_key <> v_guest.carriage_id::text
  then
    raise exception 'M01 instance does not belong to the guest wagon'
      using errcode = '42501';
  end if;
  if v_instance.instance_version <> v_instance_version then
    raise exception 'M01 instance version changed' using errcode = '55000';
  end if;
  if v_instance.status = 'completed' or exists (
    select 1
    from public.bunker_mission_decisions decision
    where decision.instance_id = v_instance.id
      and decision.decision_key = 'm01_selection'
      and decision.status = 'confirmed'
  ) then
    raise exception 'M01 decision is already confirmed' using errcode = '55000';
  end if;
  if v_instance.status <> 'active' then
    raise exception 'M01 instance is not active' using errcode = '55000';
  end if;

  perform 1
  from public.bunker_mission_members member
  where member.instance_id = v_instance.id
    and member.guest_id = v_guest.id
  for update;
  if not found then
    raise exception 'M01 confirmation requires a frozen wagon member'
      using errcode = '42501';
  end if;

  perform 1
  from public.bunker_mission_members member
  where member.instance_id = v_instance.id
  order by member.id
  for update;

  v_quota := (v_instance.definition->>'quota')::integer;
  v_selected_count := jsonb_array_length(v_selection);
  if v_quota is null or v_selected_count <> v_quota then
    raise exception 'M01 selection must exactly match frozen quota'
      using errcode = '22023';
  end if;

  begin
    select
      count(*)::integer,
      count(distinct selected.value)::integer,
      array_agg(selected.value::uuid order by selected.value::uuid)
    into v_selected_count, v_distinct_count, v_selected_ids
    from jsonb_array_elements_text(v_selection) selected(value);
  exception when invalid_text_representation then
    raise exception 'M01 selection contains an invalid guest id'
      using errcode = '22023';
  end;

  if v_distinct_count <> v_selected_count then
    raise exception 'M01 selection contains duplicate guest ids'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(v_selected_ids) selected(guest_id)
    join public.bunker_guest_profiles profile
      on profile.run_nonce = v_state.run_nonce
     and profile.guest_id = selected.guest_id
    where profile.joined_late
  ) then
    raise exception 'M01 late guests cannot be selected' using errcode = '42501';
  end if;
  if (
    select count(*)
    from public.bunker_mission_members member
    where member.instance_id = v_instance.id
      and member.guest_id = any(v_selected_ids)
  ) <> v_selected_count then
    raise exception 'M01 selection must contain only frozen wagon members'
      using errcode = '42501';
  end if;

  select array_agg(member.guest_id order by member.guest_id)
  into v_saved_ids
  from public.bunker_mission_members member
  where member.instance_id = v_instance.id
    and not (member.guest_id = any(v_selected_ids));

  v_outcome := jsonb_build_object(
    'contractVersion', 2,
    'status', 'completed',
    'selectedGuestIds', to_jsonb(v_selected_ids),
    'savedGuestIds', to_jsonb(coalesce(v_saved_ids, array[]::uuid[]))
  );

  update public.bunker_guest_profiles profile
  set character_status = case
        when profile.guest_id = any(v_selected_ids) then 'excluded'
        else 'saved'
      end,
      hidden_trait_revealed = true
  where profile.run_nonce = v_state.run_nonce
    and exists (
      select 1
      from public.bunker_mission_members member
      where member.instance_id = v_instance.id
        and member.guest_id = profile.guest_id
    );

  update public.bunker_mission_members member
  set member_status = 'completed', updated_at = v_now
  where member.instance_id = v_instance.id;

  insert into public.bunker_mission_decisions(
    event_id, run_nonce, instance_id, decision_key, actor_kind, actor_id,
    actor_scope_key, status, instance_version, command_id, payload, outcome,
    confirmed_at
  ) values (
    v_event_id, v_state.run_nonce, v_instance.id, 'm01_selection', 'wagon',
    v_guest.id, v_instance.scope_key, 'confirmed', v_instance.instance_version,
    p_command_id, jsonb_build_object('selection', to_jsonb(v_selected_ids)),
    v_outcome, v_now
  );

  update public.bunker_mission_instances instance
  set status = 'completed',
      outcome = v_outcome,
      started_at = coalesce(instance.started_at, v_now),
      completed_at = v_now
  where instance.id = v_instance.id;

  v_result := jsonb_build_object(
    'contractVersion', 2,
    'status', 'accepted',
    'commandId', p_command_id,
    'commandType', p_command_type
  );

  insert into public.bunker_command_receipts(
    event_id, run_nonce, actor_kind, actor_id, command_id, command_type,
    request_hash, result
  ) values (
    v_event_id, v_state.run_nonce, 'guest', v_guest.id, p_command_id,
    p_command_type, v_request_hash, v_result
  );

  insert into public.bunker_game_events(
    event_id, run_nonce, carriage_id, guest_id, event_type, actor_type,
    actor_id, command_id, correlation_id, instance_id, schema_version, payload
  ) values
    (
      v_event_id, v_state.run_nonce, v_guest.carriage_id, v_guest.id,
      'decision_confirmed', 'guest', v_guest.id, p_command_id, p_command_id,
      v_instance.id, 2,
      jsonb_build_object('decisionKey', 'm01_selection', 'selectedCount', v_quota)
    ),
    (
      v_event_id, v_state.run_nonce, v_guest.carriage_id, v_guest.id,
      'mission_completed', 'guest', v_guest.id, p_command_id, p_command_id,
      v_instance.id, 2,
      jsonb_build_object('missionCode', 'MISSION_01', 'scopeKey', v_instance.scope_key)
    );

  return v_result;
end;
$$;

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
        'realName', concat_ws(' ', v_guest.first_name, v_guest.last_name)
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

revoke all on function public.submit_bunker_command(text, text, uuid, text, jsonb)
  from public;
grant execute on function public.submit_bunker_command(text, text, uuid, text, jsonb)
  to anon, authenticated;
