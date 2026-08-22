-- Forward-only V2 runtime correction.
-- A wagon may complete its current mission before the other wagons. Until the
-- owner advances the global stage, that completed instance is still the
-- authoritative current mission for members of that wagon.

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
      and instance.status in ('planned', 'active', 'completed')
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

revoke all on function public.get_guest_bunker_v2_runtime(text, text)
  from public, anon, authenticated;
grant execute on function public.get_guest_bunker_v2_runtime(text, text)
  to anon, authenticated;
