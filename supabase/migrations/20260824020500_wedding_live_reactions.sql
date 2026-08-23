create table if not exists public.wedding_live_reaction_state (
  event_id uuid not null references public.events(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  last_reacted_at timestamptz not null,
  primary key (event_id, guest_id)
);

alter table public.wedding_live_reaction_state enable row level security;

revoke all on table public.wedding_live_reaction_state from public, anon, authenticated;

create or replace function public.submit_guest_live_reaction(
  p_event_slug text,
  p_device_key text,
  p_reaction text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_guest_id uuid;
  v_hash text;
  v_last_reacted_at timestamptz;
  v_now timestamptz;
  v_event_row_id uuid;
  v_retry_after_ms integer;
begin
  if length(coalesce(p_device_key, '')) < 8 then
    raise exception 'invalid device key' using errcode = '22023';
  end if;

  if p_reaction not in ('heart', 'laugh', 'fire', 'clap', 'wow') then
    raise exception 'invalid wedding reaction' using errcode = '22023';
  end if;

  select e.id
  into v_event_id
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug);

  if v_event_id is null then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  v_hash := public._device_hash(p_device_key);

  select b.guest_id
  into v_guest_id
  from public.guest_device_bindings b
  where b.event_id = v_event_id
    and b.device_key_hash = v_hash;

  if v_guest_id is null then
    raise exception 'registered guest required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_event_id::text || ':' || v_guest_id::text, 0));
  v_now := clock_timestamp();

  select s.last_reacted_at
  into v_last_reacted_at
  from public.wedding_live_reaction_state s
  where s.event_id = v_event_id
    and s.guest_id = v_guest_id;

  if v_last_reacted_at is not null and v_last_reacted_at > v_now - interval '5 seconds' then
    v_retry_after_ms := greatest(
      0,
      ceil(extract(epoch from ((v_last_reacted_at + interval '5 seconds') - v_now)) * 1000)::integer
    );
    return jsonb_build_object(
      'status', 'cooldown',
      'retryAfterMs', v_retry_after_ms
    );
  end if;

  insert into public.wedding_live_reaction_state(event_id, guest_id, last_reacted_at)
  values (v_event_id, v_guest_id, v_now)
  on conflict (event_id, guest_id) do update
  set last_reacted_at = excluded.last_reacted_at;

  insert into public.screen_events(
    event_id,
    event_slug,
    kind,
    payload,
    public_visible,
    created_at,
    expires_at
  )
  values (
    v_event_id,
    public._normalize_spaces(p_event_slug),
    'guest_reaction',
    jsonb_build_object('reaction', p_reaction),
    true,
    v_now,
    v_now + interval '8 seconds'
  )
  returning id into v_event_row_id;

  return jsonb_build_object(
    'status', 'accepted',
    'reactionId', v_event_row_id,
    'createdAt', v_now,
    'cooldownMs', 5000
  );
end;
$$;

revoke all on function public.submit_guest_live_reaction(text, text, text) from public;
grant execute on function public.submit_guest_live_reaction(text, text, text) to anon, authenticated;
