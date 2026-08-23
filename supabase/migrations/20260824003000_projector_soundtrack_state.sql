create or replace function public.get_projector_soundtrack_state(p_event_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_current_module text;
  v_screen_mode text;
  v_screen_pinned boolean;
  v_updated_at timestamptz;
  v_bunker_status text;
  v_bunker_global_game_state text;
  v_bunker_sound_enabled boolean;
  v_bunker_updated_at timestamptz;
  v_premiere_status text;
  v_premiere_updated_at timestamptz;
  v_quiz_phase text;
  v_quiz_updated_at timestamptz;
begin
  select
    e.id,
    es.current_module,
    es.screen_mode,
    es.screen_pinned,
    es.updated_at,
    bs.status,
    bs.global_game_state,
    bs.sound_enabled,
    bs.updated_at,
    ps.status,
    ps.updated_at,
    qs.phase,
    qs.updated_at
  into
    v_event_id,
    v_current_module,
    v_screen_mode,
    v_screen_pinned,
    v_updated_at,
    v_bunker_status,
    v_bunker_global_game_state,
    v_bunker_sound_enabled,
    v_bunker_updated_at,
    v_premiere_status,
    v_premiere_updated_at,
    v_quiz_phase,
    v_quiz_updated_at
  from public.events e
  join public.event_state es on es.event_id = e.id
  left join public.bunker_state bs on bs.event_id = e.id
  left join public.premiere_state ps on ps.event_id = e.id
  left join public.quiz_state qs on qs.event_id = e.id
  where e.slug = public._normalize_spaces(p_event_slug)
  limit 1;

  if v_event_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- Match the projector ownership order used by the React screen guards.  The
  -- soundtrack therefore follows the real server stage, not the director's
  -- local runbook cursor and not a stale event_state row.
  if coalesce(v_bunker_status, 'idle') = 'active' then
    v_current_module := 'bunker';
    v_screen_mode := case v_bunker_global_game_state
      when 'FINAL_30' then 'bunker_emergency'
      when 'UNKNOWN_PASSENGER' then 'bunker_unknown_passenger'
      when 'BUNKER_OPEN' then 'bunker_open'
      when 'FINISHED' then 'bunker_results'
      when 'BREAK' then 'bunker_break'
      when 'BREAK_BEFORE_FINAL' then 'bunker_break'
      when 'LOBBY' then 'bunker_lobby'
      when 'CHARACTERS_READY' then 'bunker_characters_ready'
      else 'bunker_mission'
    end;
    v_screen_pinned := true;
    v_updated_at := coalesce(v_bunker_updated_at, v_updated_at, now());
  elsif coalesce(v_premiere_status, 'idle') in ('standby', 'countdown', 'playing', 'paused', 'black') then
    v_current_module := 'premiere';
    v_screen_mode := case v_premiere_status
      when 'standby' then 'premiere_standby'
      when 'countdown' then 'premiere_countdown'
      when 'black' then 'black'
      else 'premiere_playback'
    end;
    v_screen_pinned := true;
    v_updated_at := coalesce(v_premiere_updated_at, v_updated_at, now());
  elsif coalesce(v_screen_pinned, false)
    and coalesce(v_current_module, 'idle') = 'mortal_kombat' then
    v_current_module := 'mortal_kombat';
    v_screen_mode := 'mortal_kombat';
  elsif coalesce(v_quiz_phase, 'idle') in ('voting', 'results') then
    v_current_module := 'quiz';
    v_screen_mode := 'quiz_' || v_quiz_phase;
    v_updated_at := coalesce(v_quiz_updated_at, v_updated_at, now());
  elsif coalesce(v_current_module, 'idle') in ('bunker', 'premiere', 'mortal_kombat') then
    v_current_module := 'idle';
    v_screen_mode := 'idle';
    v_screen_pinned := false;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'currentModule', coalesce(v_current_module, 'idle'),
    'screenMode', coalesce(v_screen_mode, 'idle'),
    'screenPinned', coalesce(v_screen_pinned, false),
    'globalGameState', case
      when coalesce(v_current_module, 'idle') = 'bunker' then v_bunker_global_game_state
      else null
    end,
    'soundEnabled', case
      when coalesce(v_current_module, 'idle') = 'bunker' then coalesce(v_bunker_sound_enabled, true)
      else true
    end,
    'updatedAt', coalesce(v_updated_at, now())
  );
end;
$$;

revoke all on function public.get_projector_soundtrack_state(text) from public;
grant execute on function public.get_projector_soundtrack_state(text) to anon, authenticated;
