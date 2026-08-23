create table if not exists public.wedding_message_capsule_settings (
  event_id uuid primary key references public.events(id) on delete cascade,
  is_open boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.wedding_message_capsule (
  event_id uuid not null references public.events(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  message text not null check (char_length(btrim(message)) between 1 and 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, guest_id)
);

alter table public.wedding_message_capsule_settings enable row level security;
alter table public.wedding_message_capsule enable row level security;

revoke all on table public.wedding_message_capsule_settings from public, anon, authenticated;
revoke all on table public.wedding_message_capsule from public, anon, authenticated;

create or replace function public.get_guest_message_capsule(
  p_event_slug text,
  p_device_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_guest_id uuid;
  v_open boolean := true;
  v_message text;
  v_updated_at timestamptz;
begin
  if length(coalesce(p_device_key, '')) < 8 then
    return jsonb_build_object('status', 'not_registered');
  end if;

  select e.id into v_event_id
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug);

  if v_event_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select b.guest_id into v_guest_id
  from public.guest_device_bindings b
  where b.event_id = v_event_id
    and b.device_key_hash = public._device_hash(p_device_key);

  if v_guest_id is null then
    return jsonb_build_object('status', 'not_registered');
  end if;

  select s.is_open into v_open
  from public.wedding_message_capsule_settings s
  where s.event_id = v_event_id;
  v_open := coalesce(v_open, true);

  select m.message, m.updated_at
  into v_message, v_updated_at
  from public.wedding_message_capsule m
  where m.event_id = v_event_id
    and m.guest_id = v_guest_id;

  return jsonb_build_object(
    'status', 'ready',
    'open', v_open,
    'maxLength', 280,
    'message', v_message,
    'updatedAt', v_updated_at
  );
end;
$$;

create or replace function public.save_guest_message_capsule(
  p_event_slug text,
  p_device_key text,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_guest_id uuid;
  v_open boolean := true;
  v_message text := btrim(coalesce(p_message, ''));
  v_updated_at timestamptz := clock_timestamp();
begin
  if length(coalesce(p_device_key, '')) < 8 then
    raise exception 'registered guest required' using errcode = '42501';
  end if;

  if char_length(v_message) < 1 or char_length(v_message) > 280 then
    raise exception 'message must contain 1 to 280 characters' using errcode = '22023';
  end if;

  select e.id into v_event_id
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug);

  if v_event_id is null then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  select b.guest_id into v_guest_id
  from public.guest_device_bindings b
  where b.event_id = v_event_id
    and b.device_key_hash = public._device_hash(p_device_key);

  if v_guest_id is null then
    raise exception 'registered guest required' using errcode = '42501';
  end if;

  select s.is_open into v_open
  from public.wedding_message_capsule_settings s
  where s.event_id = v_event_id;
  v_open := coalesce(v_open, true);

  if not v_open then
    return jsonb_build_object('status', 'closed');
  end if;

  insert into public.wedding_message_capsule(event_id, guest_id, message, created_at, updated_at)
  values (v_event_id, v_guest_id, v_message, v_updated_at, v_updated_at)
  on conflict (event_id, guest_id) do update
  set message = excluded.message,
      updated_at = excluded.updated_at;

  return jsonb_build_object(
    'status', 'saved',
    'message', v_message,
    'updatedAt', v_updated_at
  );
end;
$$;

create or replace function public.owner_get_message_capsule(p_event_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_event_id uuid;
  v_open boolean := true;
  v_messages jsonb := '[]'::jsonb;
  v_count integer := 0;
begin
  if v_owner is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;

  select e.id into v_event_id
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug)
    and e.owner_user_id = v_owner;

  if v_event_id is null then
    raise exception 'owner access required or event not found' using errcode = '42501';
  end if;

  select s.is_open into v_open
  from public.wedding_message_capsule_settings s
  where s.event_id = v_event_id;
  v_open := coalesce(v_open, true);

  select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'guestId', m.guest_id,
          'displayName', g.first_name || ' ' || upper(left(g.last_name, 1)) || '.',
          'carriage', c.label,
          'message', m.message,
          'updatedAt', m.updated_at
        ) order by m.updated_at desc
      ),
      '[]'::jsonb
    ),
    count(*)::integer
  into v_messages, v_count
  from public.wedding_message_capsule m
  join public.guests g on g.id = m.guest_id and g.event_id = m.event_id
  join public.carriages c on c.id = g.carriage_id
  where m.event_id = v_event_id;

  return jsonb_build_object(
    'status', 'ok',
    'open', v_open,
    'count', v_count,
    'messages', v_messages
  );
end;
$$;

create or replace function public.owner_set_message_capsule_open(
  p_event_slug text,
  p_open boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_event_id uuid;
begin
  if v_owner is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;

  select e.id into v_event_id
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug)
    and e.owner_user_id = v_owner;

  if v_event_id is null then
    raise exception 'owner access required or event not found' using errcode = '42501';
  end if;

  insert into public.wedding_message_capsule_settings(event_id, is_open, updated_at)
  values (v_event_id, p_open, now())
  on conflict (event_id) do update
  set is_open = excluded.is_open,
      updated_at = excluded.updated_at;

  return jsonb_build_object('status', 'ok', 'open', p_open);
end;
$$;

create or replace function public.owner_publish_message_capsule(
  p_event_slug text,
  p_limit integer default 7
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_event_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 7), 1), 7);
  v_messages jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_event_row_id uuid;
begin
  if v_owner is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;

  select e.id into v_event_id
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug)
    and e.owner_user_id = v_owner;

  if v_event_id is null then
    raise exception 'owner access required or event not found' using errcode = '42501';
  end if;

  with picked as (
    select
      g.first_name || ' ' || upper(left(g.last_name, 1)) || '.' as display_name,
      c.label as carriage,
      m.message
    from public.wedding_message_capsule m
    join public.guests g on g.id = m.guest_id and g.event_id = m.event_id
    join public.carriages c on c.id = g.carriage_id
    where m.event_id = v_event_id
    order by random()
    limit v_limit
  )
  select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'displayName', picked.display_name,
          'carriage', picked.carriage,
          'message', picked.message
        )
      ),
      '[]'::jsonb
    ),
    count(*)::integer
  into v_messages, v_count
  from picked;

  if v_count = 0 then
    return jsonb_build_object('status', 'empty', 'publishedCount', 0);
  end if;

  insert into public.screen_events(event_id, event_slug, kind, payload, public_visible, expires_at)
  values (
    v_event_id,
    public._normalize_spaces(p_event_slug),
    'capsule_showcase',
    jsonb_build_object('messages', v_messages),
    true,
    now() + interval '60 seconds'
  )
  returning id into v_event_row_id;

  return jsonb_build_object(
    'status', 'published',
    'eventId', v_event_row_id,
    'publishedCount', v_count
  );
end;
$$;

revoke all on function public.get_guest_message_capsule(text, text) from public;
revoke all on function public.save_guest_message_capsule(text, text, text) from public;
revoke all on function public.owner_get_message_capsule(text) from public, anon;
revoke all on function public.owner_set_message_capsule_open(text, boolean) from public, anon;
revoke all on function public.owner_publish_message_capsule(text, integer) from public, anon;

grant execute on function public.get_guest_message_capsule(text, text) to anon, authenticated;
grant execute on function public.save_guest_message_capsule(text, text, text) to anon, authenticated;
grant execute on function public.owner_get_message_capsule(text) to authenticated;
grant execute on function public.owner_set_message_capsule_open(text, boolean) to authenticated;
grant execute on function public.owner_publish_message_capsule(text, integer) to authenticated;
