-- Forward-only destructive reset hardening.
-- Progress reset intentionally removes only the current run. The two destructive
-- rehearsal resets also remove prior V2 run history for the same event so a new
-- rehearsal starts from a genuinely clean Bunker state.

create or replace function public._delete_bunker_game_run(
  p_event_id uuid,
  p_run_nonce uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if p_event_id is null or p_run_nonce is null then
    return;
  end if;

  loop
    delete from public.bunker_archive_entitlements entitlement
    where entitlement.event_id = p_event_id
      and entitlement.run_nonce = p_run_nonce
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
    where entitlement.event_id = p_event_id
      and entitlement.run_nonce = p_run_nonce
  ) then
    raise exception 'cyclic Bunker archive entitlement provenance'
      using errcode = '23514';
  end if;

  delete from public.bunker_final_parameters parameter
  where parameter.event_id = p_event_id
    and parameter.run_nonce = p_run_nonce;

  delete from public.bunker_inventory_transfers transfer
  where transfer.event_id = p_event_id
    and transfer.run_nonce = p_run_nonce;

  update public.bunker_inventory_lots lot
  set source_lot_id = null
  where lot.event_id = p_event_id
    and lot.run_nonce = p_run_nonce
    and lot.source_lot_id is not null;

  delete from public.bunker_game_runs run
  where run.event_id = p_event_id
    and run.run_nonce = p_run_nonce;
end;
$$;

revoke all on function public._delete_bunker_game_run(uuid,uuid)
  from public,anon,authenticated;

create or replace function public._clear_bunker_game_run_on_reset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.run_nonce is not null and new.run_nonce is null then
    perform public._delete_bunker_game_run(old.event_id, old.run_nonce);
  end if;
  return new;
end;
$$;

revoke all on function public._clear_bunker_game_run_on_reset()
  from public,anon,authenticated;

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
      and run.contract_version = 2
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
      'historicalV2RunsCleared',true
    )
  );

  return jsonb_build_object(
    'status','reset',
    'deletedGuests',v_deleted,
    'preservedCoupleAnswers',true,
    'historicalV2RunsCleared',true
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
      and run.contract_version = 2
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
    'historicalV2RunsCleared',true
  );
end;
$$;

revoke all on function public.owner_reset_event_test_data(uuid,text)
  from public,anon,authenticated;
grant execute on function public.owner_reset_event_test_data(uuid,text)
  to authenticated;
