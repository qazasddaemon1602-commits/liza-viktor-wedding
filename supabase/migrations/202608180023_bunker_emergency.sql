create table public.bunker_state (
  event_id uuid primary key references public.events(id) on delete cascade,
  status text not null default 'idle' check (status in ('idle', 'active')),
  started_at timestamptz,
  duration_seconds integer not null default 1800 check (duration_seconds between 60 and 7200),
  sound_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.bunker_state enable row level security;
revoke all on table public.bunker_state from public, anon, authenticated;

create or replace function public._require_bunker_owner(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.events e
    where e.id = p_event_id and e.owner_user_id = auth.uid()
  ) then
    raise exception 'owner access required' using errcode = '42501';
  end if;
end;
$$;

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

  if v_state.status = 'active' and v_state.started_at is not null then
    v_remaining := greatest(
      0,
      v_state.duration_seconds - floor(extract(epoch from (v_now - v_state.started_at)))::integer
    );
  end if;

  return jsonb_build_object(
    'status', case when v_state.status = 'active' and v_remaining > 0 then 'active' else 'idle' end,
    'startedAt', case when v_state.status = 'active' and v_remaining > 0 then v_state.started_at else null end,
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

  if v_remaining = 0 then
    return jsonb_build_object('status', 'idle', 'serverNow', v_now);
  end if;

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
begin
  perform public._require_bunker_owner(p_event_id);

  if p_duration_seconds is null or p_duration_seconds not between 60 and 7200 then
    raise exception 'bunker duration must be between 60 and 7200 seconds' using errcode = '22023';
  end if;

  insert into public.bunker_state(event_id, status, started_at, duration_seconds, updated_at)
  values (p_event_id, 'active', v_started_at, p_duration_seconds, now())
  on conflict (event_id) do update
  set status = 'active',
      started_at = excluded.started_at,
      duration_seconds = excluded.duration_seconds,
      updated_at = now();

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
    jsonb_build_object('startedAt', v_started_at, 'durationSeconds', p_duration_seconds)
  );

  return jsonb_build_object(
    'status', 'active',
    'startedAt', v_started_at,
    'durationSeconds', p_duration_seconds,
    'remainingSeconds', p_duration_seconds
  );
end;
$$;

create or replace function public.owner_stop_bunker(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._require_bunker_owner(p_event_id);

  insert into public.bunker_state(event_id, status, started_at, duration_seconds, updated_at)
  values (p_event_id, 'idle', null, 1800, now())
  on conflict (event_id) do update
  set status = 'idle', started_at = null, updated_at = now();

  update public.event_state
  set current_module = 'idle',
      screen_mode = 'idle',
      screen_pinned = false,
      updated_at = now()
  where event_id = p_event_id;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (p_event_id, auth.uid(), 'bunker_stopped', '{}'::jsonb);

  return jsonb_build_object('status', 'idle');
end;
$$;

create or replace function public.owner_set_bunker_sound(p_event_id uuid, p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._require_bunker_owner(p_event_id);

  insert into public.bunker_state(event_id, sound_enabled, updated_at)
  values (p_event_id, coalesce(p_enabled, true), now())
  on conflict (event_id) do update
  set sound_enabled = excluded.sound_enabled, updated_at = now();

  return jsonb_build_object('status', 'updated', 'soundEnabled', coalesce(p_enabled, true));
end;
$$;

revoke all on function public._require_bunker_owner(uuid) from public, anon, authenticated;
revoke all on function public.owner_get_bunker_control(uuid) from public, anon;
revoke all on function public.get_bunker_screen_state(text) from public;
revoke all on function public.owner_start_bunker(uuid, integer) from public, anon;
revoke all on function public.owner_stop_bunker(uuid) from public, anon;
revoke all on function public.owner_set_bunker_sound(uuid, boolean) from public, anon;

grant execute on function public.owner_get_bunker_control(uuid) to authenticated;
grant execute on function public.get_bunker_screen_state(text) to anon, authenticated;
grant execute on function public.owner_start_bunker(uuid, integer) to authenticated;
grant execute on function public.owner_stop_bunker(uuid) to authenticated;
grant execute on function public.owner_set_bunker_sound(uuid, boolean) to authenticated;
