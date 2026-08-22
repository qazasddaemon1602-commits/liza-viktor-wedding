-- Forward-only rehearsal correction after the canonical M05 outcome migration.
-- Simulating M05 represents a deliberate route decision; only the stage-transition
-- safety fallback is allowed to set fallback=true.
create or replace function public.owner_bunker_v2_test_simulate_current(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_run uuid;
  v_state public.bunker_state%rowtype;
  v_instance public.bunker_mission_instances%rowtype;
  v_outcome jsonb;
  v_number integer;
  v_count integer:=0;
  v_now timestamptz:=clock_timestamp();
begin
  v_run:=public._require_bunker_v2_test_mode(p_event_id);
  select s.* into v_state
  from public.bunker_state s
  where s.event_id=p_event_id
  for update;

  if v_state.global_game_state='FINAL_30' then
    perform public.owner_bunker_v2_emergency_open(p_event_id);
    return jsonb_build_object('status','simulated','state','FINAL_30','opened',true);
  end if;

  if v_state.global_game_state not in (
    'MISSION_01','MISSION_02','MISSION_03','MISSION_04','MISSION_05','MISSION_06'
  ) then
    return jsonb_build_object('status','nothing_to_simulate','state',v_state.global_game_state);
  end if;

  for v_instance in
    select i.*
    from public.bunker_mission_instances i
    where i.event_id=p_event_id
      and i.run_nonce=v_run
      and i.mission_code=v_state.global_game_state
      and i.status in ('planned','active')
    order by i.id
    for update
  loop
    v_outcome:=jsonb_build_object('status','test_simulated');

    if v_state.global_game_state='MISSION_05' then
      select c.number into v_number
      from public.carriages c
      where c.id::text=v_instance.scope_key;

      v_outcome:=public._bunker_v2_apply_m05_outcome(
        p_event_id,
        v_run,
        v_instance.scope_key::uuid,
        case when mod(v_number,2)=1 then 'A' else 'B' end,
        false
      ) || jsonb_build_object('testSimulated',true);
    elsif v_state.global_game_state='MISSION_06' then
      v_outcome:=jsonb_build_object(
        'status','success',
        'protocol','B',
        'sector','04',
        'accessCode','4719',
        'testSimulated',true
      );
      update public.bunker_final_parameters
      set status='resolved',
          source_kind='test_simulation',
          source_instance_id=v_instance.id,
          resolved_at=coalesce(resolved_at,v_now)
      where event_id=p_event_id
        and run_nonce=v_run
        and parameter_key in ('sector','access_code');
    end if;

    update public.bunker_mission_instances
    set status='completed',
        started_at=coalesce(started_at,v_now),
        completed_at=v_now,
        outcome=coalesce(outcome,'{}'::jsonb)||v_outcome
    where id=v_instance.id;

    update public.bunker_mission_members
    set member_status='completed',updated_at=v_now
    where instance_id=v_instance.id;

    v_count:=v_count+1;
  end loop;

  return jsonb_build_object(
    'status','simulated',
    'state',v_state.global_game_state,
    'instances',v_count
  );
end;
$$;

revoke all on function public.owner_bunker_v2_test_simulate_current(uuid)
  from public,anon,authenticated;
grant execute on function public.owner_bunker_v2_test_simulate_current(uuid)
  to authenticated;