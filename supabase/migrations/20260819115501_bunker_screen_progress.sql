create or replace function public.get_bunker_screen_state(p_event_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_state public.bunker_state%rowtype;
  v_now timestamptz := clock_timestamp();
  v_remaining integer := 0;
  v_teams jsonb := '[]'::jsonb;
begin
  select e.id into v_event_id
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug);

  if v_event_id is null then
    return jsonb_build_object('status', 'not_found', 'serverNow', v_now);
  end if;

  select b.* into v_state
  from public.bunker_state b
  where b.event_id = v_event_id;

  if v_state.event_id is null or v_state.status <> 'active' or v_state.started_at is null then
    return jsonb_build_object(
      'status', 'idle',
      'teams', '[]'::jsonb,
      'serverNow', v_now
    );
  end if;

  v_remaining := greatest(
    0,
    v_state.duration_seconds - floor(extract(epoch from (v_now - v_state.started_at)))::integer
  );

  if v_state.run_nonce is not null then
    select coalesce(jsonb_agg(team_row order by carriage_number), '[]'::jsonb)
    into v_teams
    from (
      select
        c.number as carriage_number,
        jsonb_build_object(
          'carriageNumber', c.number,
          'label', c.label,
          'missionAComplete', pa.completed_at is not null,
          'missionBComplete', pb.completed_at is not null
        ) as team_row
      from public.carriages c
      left join public.bunker_team_progress pa
        on pa.run_nonce = v_state.run_nonce
       and pa.carriage_id = c.id
       and pa.stage = 'mission_a'
      left join public.bunker_team_progress pb
        on pb.run_nonce = v_state.run_nonce
       and pb.carriage_id = c.id
       and pb.stage = 'mission_b'
      where c.event_id = v_event_id
        and c.enabled
    ) teams;
  end if;

  return jsonb_build_object(
    'status', 'active',
    'startedAt', v_state.started_at,
    'durationSeconds', v_state.duration_seconds,
    'remainingSeconds', v_remaining,
    'soundEnabled', v_state.sound_enabled,
    'phase', v_state.phase,
    'unlocked', v_state.unlocked_at is not null,
    'teams', v_teams,
    'serverNow', v_now
  );
end;
$$;

revoke all on function public.get_bunker_screen_state(text) from public;
grant execute on function public.get_bunker_screen_state(text) to anon, authenticated;
