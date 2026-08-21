create or replace function public.get_bunker_v2_m01_screen(p_event_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_state public.bunker_state%rowtype;
  v_contract_version integer;
  v_wagons jsonb := '[]'::jsonb;
  v_deadline timestamptz;
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

  select state.*
  into v_state
  from public.bunker_state state
  where state.event_id = v_event_id;
  if v_state.run_nonce is null then
    return jsonb_build_object(
      'contractVersion', 1, 'status', 'legacy', 'serverNow', v_now
    );
  end if;

  select run.contract_version
  into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = v_event_id and run.run_nonce = v_state.run_nonce;
  if v_contract_version = 1 then
    return jsonb_build_object(
      'contractVersion', 1, 'status', 'legacy', 'serverNow', v_now
    );
  end if;
  if v_contract_version is distinct from 2 then
    raise exception 'Bunker screen contract is unavailable' using errcode = '55000';
  end if;
  if v_state.global_game_state <> 'MISSION_01' then
    return jsonb_build_object(
      'contractVersion', 2, 'status', 'idle', 'serverNow', v_now
    );
  end if;

  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'wagonId', carriage.id,
        'label', carriage.label,
        'status', case when instance.status = 'completed' then 'completed' else 'active' end
      ) order by carriage.number
    ), '[]'::jsonb),
    max(instance.deadline_at)
  into v_wagons, v_deadline
  from public.bunker_mission_instances instance
  join public.carriages carriage
    on carriage.event_id = instance.event_id
   and carriage.id::text = instance.scope_key
  where instance.event_id = v_event_id
    and instance.run_nonce = v_state.run_nonce
    and instance.mission_code = 'MISSION_01'
    and instance.scope_kind = 'wagon'
    and instance.status in ('active', 'completed');

  if jsonb_array_length(v_wagons) not between 2 and 5 or v_deadline is null then
    return jsonb_build_object(
      'contractVersion', 2, 'status', 'idle', 'serverNow', v_now
    );
  end if;

  return jsonb_build_object(
    'contractVersion', 2,
    'status', 'active',
    'serverNow', v_now,
    'deadlineAt', v_deadline,
    'title', 'Лишний пассажир',
    'publicSummary', 'Вагоны изучают открытые части досье и принимают командное решение.',
    'wagons', v_wagons
  );
end;
$$;

revoke all on function public.get_bunker_v2_m01_screen(text)
  from public, anon, authenticated;
grant execute on function public.get_bunker_v2_m01_screen(text)
  to anon, authenticated;
