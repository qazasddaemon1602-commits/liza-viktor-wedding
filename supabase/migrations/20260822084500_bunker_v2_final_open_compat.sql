-- Forward-only compatibility hardening.
-- New clients use terminal success or owner_bunker_v2_emergency_open. If an
-- older owner client still calls the generic FINAL_30 -> BUNKER_OPEN transition,
-- preserve compatibility by classifying it as an emergency open, never as an
-- untracked successful finale.

create or replace function public._guard_bunker_v2_final_open()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contract integer;
  v_instance public.bunker_mission_instances%rowtype;
  v_outcome_status text;
  v_now timestamptz := clock_timestamp();
begin
  if old.run_nonce is null
    or old.global_game_state <> 'FINAL_30'
    or new.global_game_state <> 'BUNKER_OPEN' then
    return new;
  end if;

  select run.contract_version into v_contract
  from public.bunker_game_runs run
  where run.event_id = old.event_id
    and run.run_nonce = old.run_nonce;

  if v_contract is distinct from 2 then
    return new;
  end if;

  select instance.* into v_instance
  from public.bunker_mission_instances instance
  where instance.event_id = old.event_id
    and instance.run_nonce = old.run_nonce
    and instance.mission_code = 'FINAL_30'
  limit 1
  for update;

  if v_instance.id is null then
    raise exception 'V2 final instance missing before BUNKER_OPEN'
      using errcode = '55000';
  end if;

  v_outcome_status := v_instance.outcome->>'status';

  if v_outcome_status in ('success','emergency_open') then
    return new;
  end if;

  if coalesce((v_instance.outcome->>'transitionedByOwner')::boolean,false) then
    update public.bunker_final_parameters
    set status='resolved',
        source_kind='owner_emergency',
        source_instance_id=v_instance.id,
        resolved_at=coalesce(resolved_at,v_now)
    where event_id=old.event_id
      and run_nonce=old.run_nonce;

    update public.bunker_mission_instances
    set status='completed',
        completed_at=coalesce(completed_at,v_now),
        outcome=jsonb_build_object(
          'status','emergency_open',
          'finishTimeSeconds',greatest(
            0,
            extract(epoch from(v_now-coalesce(started_at,v_now)))::integer
          ),
          'compatibilityTransition',true
        )
    where id=v_instance.id;

    return new;
  end if;

  raise exception 'V2 final must be solved or emergency-opened before BUNKER_OPEN'
    using errcode = '55000';
end;
$$;

revoke all on function public._guard_bunker_v2_final_open()
  from public,anon,authenticated;
