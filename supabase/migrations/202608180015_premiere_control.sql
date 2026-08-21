create table public.premiere_state (
  event_id uuid primary key references public.events(id) on delete cascade,
  media_url text,
  duration_seconds numeric(10,3) check (duration_seconds is null or duration_seconds > 0),
  status text not null default 'idle' check (status in ('idle', 'standby', 'countdown', 'playing', 'paused', 'black')),
  start_at timestamptz,
  playback_anchor_at timestamptz,
  playback_offset_seconds numeric(10,3) not null default 0 check (playback_offset_seconds >= 0),
  countdown_seconds integer not null default 10 check (countdown_seconds between 1 and 60),
  countdown_sound_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.premiere_state enable row level security;
revoke all on table public.premiere_state from anon, authenticated;

create or replace function public._require_premiere_owner(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.owner_user_id = auth.uid()
  ) then
    raise exception 'owner access required or event not found' using errcode = '42501';
  end if;
end;
$$;

create or replace function public._premiere_clamp_position(
  p_position numeric,
  p_duration numeric
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select greatest(
    0::numeric,
    least(coalesce(p_duration, greatest(0::numeric, p_position)), greatest(0::numeric, p_position))
  );
$$;

create or replace function public.owner_set_premiere_media(
  p_event_id uuid,
  p_media_url text,
  p_duration_seconds numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text := btrim(coalesce(p_media_url, ''));
begin
  perform public._require_premiere_owner(p_event_id);

  if v_url = '' or v_url !~* '^https://[^[:space:]]+$' then
    raise exception 'HTTPS premiere media URL required' using errcode = '22023';
  end if;
  if p_duration_seconds is null or p_duration_seconds <= 0 then
    raise exception 'positive premiere duration required' using errcode = '22023';
  end if;

  insert into public.premiere_state(
    event_id, media_url, duration_seconds, status,
    start_at, playback_anchor_at, playback_offset_seconds, updated_at
  ) values (
    p_event_id, v_url, p_duration_seconds, 'idle',
    null, null, 0, now()
  )
  on conflict (event_id) do update
  set media_url = excluded.media_url,
      duration_seconds = excluded.duration_seconds,
      status = case when premiere_state.status = 'black' then 'black' else 'idle' end,
      start_at = null,
      playback_anchor_at = null,
      playback_offset_seconds = 0,
      updated_at = now();

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (p_event_id, auth.uid(), 'premiere_media_set', jsonb_build_object('durationSeconds', p_duration_seconds));

  return jsonb_build_object('status', 'configured', 'durationSeconds', p_duration_seconds);
end;
$$;

create or replace function public.owner_get_premiere_control(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state public.premiere_state%rowtype;
  v_effective_status text;
  v_position numeric := 0;
  v_now timestamptz := clock_timestamp();
begin
  perform public._require_premiere_owner(p_event_id);

  select p.* into v_state
  from public.premiere_state p
  where p.event_id = p_event_id;

  if v_state.event_id is null then
    return jsonb_build_object(
      'status', 'idle',
      'configured', false,
      'serverNow', v_now,
      'countdownSoundEnabled', true,
      'countdownSeconds', 10
    );
  end if;

  v_effective_status := v_state.status;
  if v_state.status = 'countdown' and v_state.start_at is not null and v_now >= v_state.start_at then
    v_effective_status := 'playing';
    v_position := public._premiere_clamp_position(
      v_state.playback_offset_seconds + extract(epoch from (v_now - v_state.start_at)),
      v_state.duration_seconds
    );
  elsif v_state.status = 'playing' and v_state.playback_anchor_at is not null then
    v_position := public._premiere_clamp_position(
      v_state.playback_offset_seconds + extract(epoch from (v_now - v_state.playback_anchor_at)),
      v_state.duration_seconds
    );
  else
    v_position := public._premiere_clamp_position(v_state.playback_offset_seconds, v_state.duration_seconds);
  end if;

  return jsonb_build_object(
    'status', v_effective_status,
    'configured', v_state.media_url is not null and v_state.duration_seconds is not null,
    'mediaUrl', v_state.media_url,
    'durationSeconds', v_state.duration_seconds,
    'startAt', v_state.start_at,
    'playbackAnchorAt', case when v_effective_status = 'playing' and v_state.status = 'countdown' then v_state.start_at else v_state.playback_anchor_at end,
    'playbackOffsetSeconds', v_state.playback_offset_seconds,
    'positionSeconds', v_position,
    'countdownSeconds', v_state.countdown_seconds,
    'countdownSoundEnabled', v_state.countdown_sound_enabled,
    'serverNow', v_now
  );
end;
$$;

create or replace function public.owner_set_premiere_standby(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._require_premiere_owner(p_event_id);

  if not exists (
    select 1 from public.premiere_state p
    where p.event_id = p_event_id and p.media_url is not null and p.duration_seconds is not null
  ) then
    raise exception 'premiere media is not configured' using errcode = '55000';
  end if;

  update public.premiere_state
  set status = 'standby', start_at = null, playback_anchor_at = null,
      playback_offset_seconds = 0, updated_at = now()
  where event_id = p_event_id;

  update public.event_state
  set current_module = 'premiere', screen_mode = 'premiere_standby', screen_pinned = true, updated_at = now()
  where event_id = p_event_id;

  return jsonb_build_object('status', 'standby');
end;
$$;

create or replace function public.owner_start_premiere(
  p_event_id uuid,
  p_countdown_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start_at timestamptz;
begin
  perform public._require_premiere_owner(p_event_id);

  if p_countdown_seconds is null or p_countdown_seconds not between 1 and 60 then
    raise exception 'countdown must be between 1 and 60 seconds' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.premiere_state p
    where p.event_id = p_event_id and p.media_url is not null and p.duration_seconds is not null
  ) then
    raise exception 'premiere media is not configured' using errcode = '55000';
  end if;

  v_start_at := clock_timestamp() + make_interval(secs => p_countdown_seconds);

  update public.premiere_state
  set status = 'countdown',
      countdown_seconds = p_countdown_seconds,
      start_at = v_start_at,
      playback_anchor_at = v_start_at,
      playback_offset_seconds = 0,
      updated_at = now()
  where event_id = p_event_id;

  update public.event_state
  set current_module = 'premiere', screen_mode = 'premiere_countdown', screen_pinned = true, updated_at = now()
  where event_id = p_event_id;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (p_event_id, auth.uid(), 'premiere_started', jsonb_build_object('startAt', v_start_at, 'countdownSeconds', p_countdown_seconds));

  return jsonb_build_object('status', 'countdown', 'startAt', v_start_at, 'countdownSeconds', p_countdown_seconds);
end;
$$;

create or replace function public.owner_cancel_premiere(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._require_premiere_owner(p_event_id);

  update public.premiere_state
  set status = case when media_url is null then 'idle' else 'standby' end,
      start_at = null,
      playback_anchor_at = null,
      playback_offset_seconds = 0,
      updated_at = now()
  where event_id = p_event_id;

  update public.event_state
  set current_module = 'premiere', screen_mode = 'premiere_standby', screen_pinned = true, updated_at = now()
  where event_id = p_event_id;

  return jsonb_build_object('status', 'standby');
end;
$$;

create or replace function public.owner_pause_premiere(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state public.premiere_state%rowtype;
  v_now timestamptz := clock_timestamp();
  v_position numeric := 0;
begin
  perform public._require_premiere_owner(p_event_id);

  select p.* into v_state
  from public.premiere_state p
  where p.event_id = p_event_id
  for update;

  if v_state.event_id is null then
    raise exception 'premiere state not found' using errcode = 'P0002';
  end if;

  if v_state.status = 'paused' then
    return jsonb_build_object('status', 'paused', 'positionSeconds', v_state.playback_offset_seconds);
  end if;

  if v_state.status = 'countdown' then
    if v_state.start_at is null or v_now < v_state.start_at then
      raise exception 'countdown has not finished; cancel it instead' using errcode = '55000';
    end if;
    v_position := v_state.playback_offset_seconds + extract(epoch from (v_now - v_state.start_at));
  elsif v_state.status = 'playing' and v_state.playback_anchor_at is not null then
    v_position := v_state.playback_offset_seconds + extract(epoch from (v_now - v_state.playback_anchor_at));
  else
    raise exception 'premiere is not playing' using errcode = '55000';
  end if;

  v_position := public._premiere_clamp_position(v_position, v_state.duration_seconds);

  update public.premiere_state
  set status = 'paused', start_at = null, playback_anchor_at = null,
      playback_offset_seconds = v_position, updated_at = now()
  where event_id = p_event_id;

  return jsonb_build_object('status', 'paused', 'positionSeconds', v_position);
end;
$$;

create or replace function public.owner_resume_premiere(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anchor timestamptz := clock_timestamp();
  v_offset numeric;
begin
  perform public._require_premiere_owner(p_event_id);

  select playback_offset_seconds into v_offset
  from public.premiere_state
  where event_id = p_event_id and status = 'paused'
  for update;

  if v_offset is null then
    raise exception 'premiere is not paused' using errcode = '55000';
  end if;

  update public.premiere_state
  set status = 'playing', start_at = null, playback_anchor_at = v_anchor, updated_at = now()
  where event_id = p_event_id;

  return jsonb_build_object('status', 'playing', 'playbackAnchorAt', v_anchor, 'playbackOffsetSeconds', v_offset);
end;
$$;

create or replace function public.owner_seek_premiere(
  p_event_id uuid,
  p_position_seconds numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state public.premiere_state%rowtype;
  v_position numeric;
  v_anchor timestamptz;
begin
  perform public._require_premiere_owner(p_event_id);

  select p.* into v_state
  from public.premiere_state p
  where p.event_id = p_event_id
  for update;

  if v_state.event_id is null or v_state.duration_seconds is null then
    raise exception 'premiere media is not configured' using errcode = '55000';
  end if;

  v_position := public._premiere_clamp_position(coalesce(p_position_seconds, 0), v_state.duration_seconds);
  v_anchor := case when v_state.status = 'playing' then clock_timestamp() else null end;

  update public.premiere_state
  set playback_offset_seconds = v_position,
      playback_anchor_at = v_anchor,
      start_at = null,
      status = case when status = 'countdown' then 'paused' else status end,
      updated_at = now()
  where event_id = p_event_id;

  return jsonb_build_object('status', 'seeked', 'positionSeconds', v_position);
end;
$$;

create or replace function public.owner_restart_premiere(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anchor timestamptz := clock_timestamp();
begin
  perform public._require_premiere_owner(p_event_id);

  if not exists (
    select 1 from public.premiere_state p
    where p.event_id = p_event_id and p.media_url is not null
  ) then
    raise exception 'premiere media is not configured' using errcode = '55000';
  end if;

  update public.premiere_state
  set status = 'playing', start_at = null, playback_anchor_at = v_anchor,
      playback_offset_seconds = 0, updated_at = now()
  where event_id = p_event_id;

  update public.event_state
  set current_module = 'premiere', screen_mode = 'premiere_playback', screen_pinned = true, updated_at = now()
  where event_id = p_event_id;

  return jsonb_build_object('status', 'playing', 'playbackAnchorAt', v_anchor, 'playbackOffsetSeconds', 0);
end;
$$;

create or replace function public.owner_set_premiere_black(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._require_premiere_owner(p_event_id);

  insert into public.premiere_state(event_id, status)
  values (p_event_id, 'black')
  on conflict (event_id) do update
  set status = 'black', start_at = null, playback_anchor_at = null, updated_at = now();

  update public.event_state
  set current_module = 'premiere', screen_mode = 'black', screen_pinned = true, updated_at = now()
  where event_id = p_event_id;

  return jsonb_build_object('status', 'black');
end;
$$;

create or replace function public.owner_return_main_screen(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._require_premiere_owner(p_event_id);

  update public.premiere_state
  set status = 'idle', start_at = null, playback_anchor_at = null,
      playback_offset_seconds = 0, updated_at = now()
  where event_id = p_event_id;

  update public.event_state
  set current_module = 'idle', screen_mode = 'idle', screen_pinned = false,
      screen_payload_id = null, screen_payload = null, updated_at = now()
  where event_id = p_event_id;

  return jsonb_build_object('status', 'idle');
end;
$$;

create or replace function public.owner_set_premiere_countdown_sound(
  p_event_id uuid,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._require_premiere_owner(p_event_id);

  insert into public.premiere_state(event_id, countdown_sound_enabled)
  values (p_event_id, coalesce(p_enabled, true))
  on conflict (event_id) do update
  set countdown_sound_enabled = coalesce(p_enabled, true), updated_at = now();

  return jsonb_build_object('status', 'ok', 'countdownSoundEnabled', coalesce(p_enabled, true));
end;
$$;

create or replace function public.get_premiere_screen_state(p_event_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_state public.premiere_state%rowtype;
  v_now timestamptz := clock_timestamp();
  v_effective_status text;
  v_position numeric := 0;
  v_anchor timestamptz;
begin
  select e.id into v_event_id
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug);

  if v_event_id is null then
    return jsonb_build_object('status', 'not_found', 'serverNow', v_now);
  end if;

  select p.* into v_state
  from public.premiere_state p
  where p.event_id = v_event_id;

  if v_state.event_id is null or v_state.status = 'idle' then
    return jsonb_build_object('status', 'idle', 'serverNow', v_now);
  end if;

  if v_state.status = 'black' then
    return jsonb_build_object('status', 'black', 'serverNow', v_now);
  end if;

  v_effective_status := v_state.status;
  v_anchor := v_state.playback_anchor_at;

  if v_state.status = 'countdown' and v_state.start_at is not null and v_now >= v_state.start_at then
    v_effective_status := 'playing';
    v_anchor := v_state.start_at;
    v_position := public._premiere_clamp_position(
      v_state.playback_offset_seconds + extract(epoch from (v_now - v_state.start_at)),
      v_state.duration_seconds
    );
  elsif v_state.status = 'playing' and v_state.playback_anchor_at is not null then
    v_position := public._premiere_clamp_position(
      v_state.playback_offset_seconds + extract(epoch from (v_now - v_state.playback_anchor_at)),
      v_state.duration_seconds
    );
  else
    v_position := public._premiere_clamp_position(v_state.playback_offset_seconds, v_state.duration_seconds);
  end if;

  return jsonb_build_object(
    'status', v_effective_status,
    'mediaUrl', v_state.media_url,
    'durationSeconds', v_state.duration_seconds,
    'startAt', case when v_state.status = 'countdown' and v_effective_status = 'countdown' then v_state.start_at else null end,
    'playbackAnchorAt', case when v_effective_status = 'playing' then v_anchor else null end,
    'playbackOffsetSeconds', v_state.playback_offset_seconds,
    'positionSeconds', v_position,
    'countdownSeconds', v_state.countdown_seconds,
    'countdownSoundEnabled', v_state.countdown_sound_enabled,
    'serverNow', v_now
  );
end;
$$;

revoke all on function public._require_premiere_owner(uuid) from public, anon, authenticated;
revoke all on function public._premiere_clamp_position(numeric, numeric) from public, anon, authenticated;
revoke all on function public.owner_set_premiere_media(uuid, text, numeric) from public, anon;
revoke all on function public.owner_get_premiere_control(uuid) from public, anon;
revoke all on function public.owner_set_premiere_standby(uuid) from public, anon;
revoke all on function public.owner_start_premiere(uuid, integer) from public, anon;
revoke all on function public.owner_cancel_premiere(uuid) from public, anon;
revoke all on function public.owner_pause_premiere(uuid) from public, anon;
revoke all on function public.owner_resume_premiere(uuid) from public, anon;
revoke all on function public.owner_seek_premiere(uuid, numeric) from public, anon;
revoke all on function public.owner_restart_premiere(uuid) from public, anon;
revoke all on function public.owner_set_premiere_black(uuid) from public, anon;
revoke all on function public.owner_return_main_screen(uuid) from public, anon;
revoke all on function public.owner_set_premiere_countdown_sound(uuid, boolean) from public, anon;
revoke all on function public.get_premiere_screen_state(text) from public;

grant execute on function public.owner_set_premiere_media(uuid, text, numeric) to authenticated;
grant execute on function public.owner_get_premiere_control(uuid) to authenticated;
grant execute on function public.owner_set_premiere_standby(uuid) to authenticated;
grant execute on function public.owner_start_premiere(uuid, integer) to authenticated;
grant execute on function public.owner_cancel_premiere(uuid) to authenticated;
grant execute on function public.owner_pause_premiere(uuid) to authenticated;
grant execute on function public.owner_resume_premiere(uuid) to authenticated;
grant execute on function public.owner_seek_premiere(uuid, numeric) to authenticated;
grant execute on function public.owner_restart_premiere(uuid) to authenticated;
grant execute on function public.owner_set_premiere_black(uuid) to authenticated;
grant execute on function public.owner_return_main_screen(uuid) to authenticated;
grant execute on function public.owner_set_premiere_countdown_sound(uuid, boolean) to authenticated;
grant execute on function public.get_premiere_screen_state(text) to anon, authenticated;
