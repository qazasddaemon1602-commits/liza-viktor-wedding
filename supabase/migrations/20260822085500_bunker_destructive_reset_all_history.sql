-- Forward-only reset semantics correction.
-- The explicit destructive reset actions mean a clean rehearsal/event reset, so
-- they remove every historical Bunker run for the event, including legacy V1
-- history. The ordinary progress reset still removes only the current run.

create or replace function public.owner_bunker_v2_reset_game_and_registrations(
  p_event_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
  v_run_nonce uuid;
begin
  perform public._require_bunker_owner(p_event_id);

  if coalesce(p_confirmation,'') <> 'СБРОСИТЬ ИГРУ И РЕГИСТРАЦИИ' then
    raise exception 'explicit game and registration reset confirmation required'
      using errcode = '22023';
  end if;

  perform public.owner_reset_bunker_progress(p_event_id, gen_random_uuid());

  for v_run_nonce in
    select run.run_nonce
    from public.bunker_game_runs run
    where run.event_id = p_event_id
    order by run.run_nonce
  loop
    perform public._delete_bunker_game_run(p_event_id, v_run_nonce);
  end loop;

  delete from public.guests guest
  where guest.event_id = p_event_id;
  get diagnostics v_deleted = row_count;

  update public.carriages
  set enabled = true
  where event_id = p_event_id;

  update public.events
  set registration_open = true,
      composition_locked = false,
      next_ticket_sequence = 1
  where id = p_event_id;

  insert into public.owner_action_log(event_id,owner_user_id,action,payload)
  values (
    p_event_id,
    auth.uid(),
    'bunker_game_and_registrations_reset',
    jsonb_build_object(
      'deletedGuests',v_deleted,
      'historicalBunkerRunsCleared',true
    )
  );

  return jsonb_build_object(
    'status','reset',
    'deletedGuests',v_deleted,
    'preservedCoupleAnswers',true,
    'historicalBunkerRunsCleared',true
  );
end;
$$;

revoke all on function public.owner_bunker_v2_reset_game_and_registrations(uuid,text)
  from public,anon,authenticated;
grant execute on function public.owner_bunker_v2_reset_game_and_registrations(uuid,text)
  to authenticated;

create or replace function public.owner_reset_event_test_data(
  p_event_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_run_nonce uuid;
begin
  perform public._require_bunker_owner(p_event_id);

  if coalesce(p_confirmation,'') <> 'СБРОСИТЬ' then
    raise exception 'explicit reset confirmation required' using errcode = '22023';
  end if;

  perform public.owner_reset_bunker_progress(p_event_id, gen_random_uuid());

  for v_run_nonce in
    select run.run_nonce
    from public.bunker_game_runs run
    where run.event_id = p_event_id
    order by run.run_nonce
  loop
    perform public._delete_bunker_game_run(p_event_id, v_run_nonce);
  end loop;

  v_result := public._owner_reset_event_test_data_without_v2(
    p_event_id,
    p_confirmation
  );

  return v_result || jsonb_build_object(
    'bunkerV2RunReset',true,
    'historicalBunkerRunsCleared',true
  );
end;
$$;

revoke all on function public.owner_reset_event_test_data(uuid,text)
  from public,anon,authenticated;
grant execute on function public.owner_reset_event_test_data(uuid,text)
  to authenticated;
