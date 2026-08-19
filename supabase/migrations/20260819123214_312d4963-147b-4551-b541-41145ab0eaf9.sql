create or replace function public.owner_reset_event_test_data(
  p_event_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_deleted_guests integer := 0;
  v_deleted_quiz_rounds integer := 0;
  v_deleted_bunker_profiles integer := 0;
  v_deleted_bunker_progress integer := 0;
  v_deleted_bunker_attempts integer := 0;
  v_preserved_couple_answers integer := 0;
  v_premiere_configured boolean := false;
  v_mk_tournament_id uuid;
begin
  if v_owner is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.owner_user_id = v_owner
  ) then
    raise exception 'owner access required or event not found' using errcode = '42501';
  end if;

  if coalesce(p_confirmation, '') <> 'СБРОСИТЬ' then
    raise exception 'explicit reset confirmation required' using errcode = '22023';
  end if;

  select count(*)::integer
  into v_preserved_couple_answers
  from public.couple_preanswers p
  where p.event_id = p_event_id;

  select exists (
    select 1
    from public.premiere_state p
    where p.event_id = p_event_id
      and p.media_url is not null
      and p.duration_seconds is not null
  ) into v_premiere_configured;

  select t.id into v_mk_tournament_id
  from public.mk_tournaments t
  where t.event_id = p_event_id;

  delete from public.screen_events
  where event_id = p_event_id;

  delete from public.carriage_calls
  where event_id = p_event_id;

  delete from public.quiz_votes
  where event_id = p_event_id;

  delete from public.quiz_rounds
  where event_id = p_event_id;
  get diagnostics v_deleted_quiz_rounds = row_count;

  delete from public.final_five_answers
  where event_id = p_event_id;

  delete from public.final_five_role_access
  where event_id = p_event_id;

  if v_mk_tournament_id is not null then
    delete from public.mk_matches
    where tournament_id = v_mk_tournament_id;

    delete from public.mk_registrations
    where tournament_id = v_mk_tournament_id;

    update public.mk_tournaments
    set state = 'registration',
        current_match_id = null,
        champion_guest_id = null,
        updated_at = now()
    where id = v_mk_tournament_id;
  end if;

  delete from public.bunker_final_attempts
  where event_id = p_event_id;
  get diagnostics v_deleted_bunker_attempts = row_count;

  delete from public.bunker_team_progress
  where event_id = p_event_id;
  get diagnostics v_deleted_bunker_progress = row_count;

  delete from public.bunker_guest_profiles
  where event_id = p_event_id;
  get diagnostics v_deleted_bunker_profiles = row_count;

  update public.bunker_state
  set status = 'idle',
      started_at = null,
      duration_seconds = 1800,
      phase = 'emergency',
      phase_started_at = null,
      unlocked_at = null,
      run_nonce = null,
      updated_at = now()
  where event_id = p_event_id;

  delete from public.guests
  where event_id = p_event_id;
  get diagnostics v_deleted_guests = row_count;

  update public.quiz_state
  set current_question_id = null,
      phase = 'idle',
      activated_at = null,
      revealed_at = null,
      couple_answer_revealed_at = null,
      final_five_revealed_at = null,
      present_on_main_screen = false,
      updated_at = now()
  where event_id = p_event_id;

  update public.premiere_state
  set status = 'idle',
      start_at = null,
      playback_anchor_at = null,
      playback_offset_seconds = 0,
      updated_at = now()
  where event_id = p_event_id;

  update public.event_state
  set current_module = 'idle',
      screen_mode = 'idle',
      screen_payload_id = null,
      screen_payload = null,
      screen_pinned = false,
      updated_at = now()
  where event_id = p_event_id;

  update public.events
  set registration_open = true,
      composition_locked = false,
      next_ticket_sequence = 1
  where id = p_event_id;

  delete from public.owner_action_log
  where event_id = p_event_id;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    p_event_id,
    v_owner,
    'test_data_reset',
    jsonb_build_object(
      'deletedGuests', v_deleted_guests,
      'deletedQuizRounds', v_deleted_quiz_rounds,
      'deletedBunkerProfiles', v_deleted_bunker_profiles,
      'deletedBunkerProgress', v_deleted_bunker_progress,
      'deletedBunkerAttempts', v_deleted_bunker_attempts,
      'preservedCoupleAnswers', v_preserved_couple_answers,
      'premiereConfigured', v_premiere_configured,
      'mortalKombatReset', v_mk_tournament_id is not null,
      'bunkerReset', true
    )
  );

  return jsonb_build_object(
    'status', 'reset',
    'deletedGuests', v_deleted_guests,
    'deletedQuizRounds', v_deleted_quiz_rounds,
    'deletedBunkerProfiles', v_deleted_bunker_profiles,
    'deletedBunkerProgress', v_deleted_bunker_progress,
    'deletedBunkerAttempts', v_deleted_bunker_attempts,
    'preservedCoupleAnswers', v_preserved_couple_answers,
    'premiereConfigured', v_premiere_configured,
    'mortalKombatReset', v_mk_tournament_id is not null,
    'bunkerReset', true,
    'registrationOpen', true,
    'nextTicketSequence', 1
  );
end;
$$;

revoke all on function public.owner_reset_event_test_data(uuid, text) from public, anon;
grant execute on function public.owner_reset_event_test_data(uuid, text) to authenticated;