-- `get_guest_bunker_runtime` is shared by the legacy and V2 guest clients.
-- Legacy compatibility wrappers were written before the strict V2 runtime
-- contract existed; after V2 dispatch was introduced they kept appending
-- legacy-only fields (`missionAction`, `character.abilityAction`,
-- `wagonState.abilityModifiers`) to an otherwise valid V2 payload. The V2
-- client intentionally rejects extra authority-bearing keys, so `/join`
-- reported the protected archive as stale even though the server read worked.
-- Short-circuit the legacy enrichers when the dispatched response is V2.

create or replace function public._get_guest_bunker_runtime_before_character_abilities(
  p_event_slug text,
  p_device_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_event_id uuid;
  v_state text;
begin
  v_result := public._get_guest_bunker_runtime_before_global_missions(
    p_event_slug,
    p_device_key
  );

  if v_result->>'status' <> 'active' then
    return v_result;
  end if;

  if v_result->>'contractVersion' = '2' then return v_result; end if;

  select event.id into v_event_id
  from public.events event
  where event.slug = public._normalize_spaces(p_event_slug);

  v_state := v_result#>>'{game,state}';

  return v_result || jsonb_build_object(
    'missionAction', public._bunker_global_mission_action(
      v_event_id,
      (v_result#>>'{game,runNonce}')::uuid,
      (v_result#>>'{wagon,id}')::uuid,
      v_state
    )
  );
end;
$$;

revoke all on function public._get_guest_bunker_runtime_before_character_abilities(text, text)
from public, anon, authenticated;

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
  v_result jsonb;
  v_wagon public.bunker_wagon_state%rowtype;
begin
  v_result := public._get_guest_bunker_runtime_before_character_abilities(
    p_event_slug,
    p_device_key
  );

  if v_result->>'status' <> 'active' then
    return v_result;
  end if;

  if v_result->>'contractVersion' = '2' then return v_result; end if;

  v_result := jsonb_set(
    v_result,
    '{character,abilityAction}',
    public._bunker_ability_action(
      v_result#>>'{character,specialAbility}',
      v_result#>>'{game,state}'
    ),
    true
  );

  select wagon.* into v_wagon
  from public.bunker_wagon_state wagon
  where wagon.run_nonce = (v_result#>>'{game,runNonce}')::uuid
    and wagon.carriage_id = (v_result#>>'{wagon,id}')::uuid;

  return jsonb_set(
    v_result,
    '{wagonState,abilityModifiers}',
    jsonb_build_object(
      'powerStabilized', v_wagon.ability_power_stabilized,
      'technicalDoorUnlocked', v_wagon.ability_technical_door_unlocked,
      'waterStabilized', v_wagon.ability_water_stabilized,
      'communicationBonus', v_wagon.ability_communication_bonus,
      'routeBonus', v_wagon.ability_route_bonus,
      'sectorHint', v_wagon.ability_sector_hint
    ),
    true
  );
end;
$$;

revoke all on function public.get_guest_bunker_runtime(text, text)
from public;

grant execute on function public.get_guest_bunker_runtime(text, text)
to anon, authenticated;
