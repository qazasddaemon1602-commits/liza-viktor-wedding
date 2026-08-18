create or replace function public.owner_get_bunker_control(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state public.bunker_state%rowtype;
  v_now timestamptz := clock_timestamp();
  v_remaining integer := 0;
  v_active boolean := false;
begin
  perform public._require_bunker_owner(p_event_id);

  select b.* into v_state
  from public.bunker_state b
  where b.event_id = p_event_id;

  if v_state.event_id is null then
    return jsonb_build_object(
      'status', 'idle',
      'durationSeconds', 1800,
      'soundEnabled', true,
      'serverNow', v_now
    );
  end if;

  v_active := v_state.status = 'active' and v_state.started_at is not null;

  if v_active then
    v_remaining := greatest(
      0,
      v_state.duration_seconds - floor(extract(epoch from (v_now - v_state.started_at)))::integer
    );
  end if;

  return jsonb_build_object(
    'status', case when v_active then 'active' else 'idle' end,
    'startedAt', case when v_active then v_state.started_at else null end,
    'durationSeconds', v_state.duration_seconds,
    'remainingSeconds', v_remaining,
    'soundEnabled', v_state.sound_enabled,
    'serverNow', v_now
  );
end;
$$;

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
    return jsonb_build_object('status', 'idle', 'serverNow', v_now);
  end if;

  v_remaining := greatest(
    0,
    v_state.duration_seconds - floor(extract(epoch from (v_now - v_state.started_at)))::integer
  );

  return jsonb_build_object(
    'status', 'active',
    'startedAt', v_state.started_at,
    'durationSeconds', v_state.duration_seconds,
    'remainingSeconds', v_remaining,
    'soundEnabled', v_state.sound_enabled,
    'serverNow', v_now
  );
end;
$$;

revoke all on function public.owner_get_bunker_control(uuid) from public, anon;
revoke all on function public.get_bunker_screen_state(text) from public;
grant execute on function public.owner_get_bunker_control(uuid) to authenticated;
grant execute on function public.get_bunker_screen_state(text) to anon, authenticated;
