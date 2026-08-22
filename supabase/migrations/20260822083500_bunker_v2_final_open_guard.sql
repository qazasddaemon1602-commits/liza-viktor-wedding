-- Forward-only final-state guard.
-- FINAL_30 may reach BUNKER_OPEN only through a successful terminal submission
-- or the explicit owner emergency-open command. Generic owner state advance is
-- not a third, untracked way to bypass the finale.

create or replace function public._guard_bunker_v2_final_open()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contract integer;
  v_outcome_status text;
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

  select instance.outcome->>'status' into v_outcome_status
  from public.bunker_mission_instances instance
  where instance.event_id = old.event_id
    and instance.run_nonce = old.run_nonce
    and instance.mission_code = 'FINAL_30'
  limit 1;

  if v_outcome_status not in ('success','emergency_open')
    or v_outcome_status is null then
    raise exception 'V2 final must be solved or emergency-opened before BUNKER_OPEN'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function public._guard_bunker_v2_final_open()
  from public,anon,authenticated;

drop trigger if exists bunker_v2_guard_final_open on public.bunker_state;
create trigger bunker_v2_guard_final_open
before update of global_game_state on public.bunker_state
for each row
when (
  old.global_game_state = 'FINAL_30'
  and new.global_game_state = 'BUNKER_OPEN'
)
execute function public._guard_bunker_v2_final_open();
