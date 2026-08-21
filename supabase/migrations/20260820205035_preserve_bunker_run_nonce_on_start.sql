create or replace function public.owner_start_bunker(
  p_event_id uuid,
  p_duration_seconds integer default 1800
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_run_nonce uuid;
begin
  perform public._require_bunker_owner(p_event_id);

  if p_duration_seconds is null or p_duration_seconds not between 60 and 7200 then
    raise exception 'bunker duration must be between 60 and 7200 seconds' using errcode = '22023';
  end if;

  select b.run_nonce into v_run_nonce
  from public.bunker_state b
  where b.event_id = p_event_id
  for update;

  if v_run_nonce is null then
    v_run_nonce := gen_random_uuid();
  end if;

  insert into public.bunker_state(
    event_id, status, started_at, duration_seconds, phase, phase_started_at,
    unlocked_at, run_nonce, updated_at
  )
  values (
    p_event_id, 'active', v_started_at, p_duration_seconds, 'emergency', v_started_at,
    null, v_run_nonce, now()
  )
  on conflict (event_id) do update
  set status = 'active',
      started_at = excluded.started_at,
      duration_seconds = excluded.duration_seconds,
      phase = 'emergency',
      phase_started_at = excluded.phase_started_at,
      unlocked_at = null,
      run_nonce = coalesce(bunker_state.run_nonce, excluded.run_nonce),
      updated_at = now()
  returning run_nonce into v_run_nonce;

  update public.event_state
  set current_module = 'bunker',
      screen_mode = 'bunker_emergency',
      screen_pinned = true,
      updated_at = now()
  where event_id = p_event_id;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    p_event_id,
    auth.uid(),
    'bunker_started',
    jsonb_build_object(
      'startedAt', v_started_at,
      'durationSeconds', p_duration_seconds,
      'runNonce', v_run_nonce,
      'phase', 'emergency'
    )
  );

  return jsonb_build_object(
    'status', 'active',
    'startedAt', v_started_at,
    'durationSeconds', p_duration_seconds,
    'remainingSeconds', p_duration_seconds,
    'phase', 'emergency',
    'runNonce', v_run_nonce
  );
end;
$$;
