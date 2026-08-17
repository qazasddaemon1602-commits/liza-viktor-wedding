create extension if not exists pgcrypto with schema extensions;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  wedding_date date not null default '2026-08-29',
  event_date date not null default '2026-08-30',
  expected_guest_count integer not null default 40 check (expected_guest_count > 0),
  registration_open boolean not null default true,
  composition_locked boolean not null default false,
  owner_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.event_state (
  event_id uuid primary key references public.events(id) on delete cascade,
  active_module text not null default 'idle',
  screen_mode text not null default 'idle',
  updated_at timestamptz not null default now()
);

create table public.carriages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  number integer not null check (number > 0),
  label text not null,
  accent_hex text not null,
  visual_mark text not null,
  sort_order integer not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (event_id, number)
);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  affiliation_type text not null check (
    affiliation_type in ('liza', 'viktor', 'common', 'family', 'colleagues', 'other')
  ),
  affiliation_detail text,
  carriage_id uuid not null references public.carriages(id),
  ticket_number text not null,
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (event_id, ticket_number)
);

create table public.guest_device_bindings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  device_key_hash text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (event_id, device_key_hash)
);

create table public.owner_action_log (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id),
  action_type text not null,
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index guests_event_carriage_idx on public.guests(event_id, carriage_id);
create index guests_event_affiliation_idx on public.guests(event_id, affiliation_type);
create index guest_device_bindings_guest_idx on public.guest_device_bindings(guest_id);
create index owner_action_log_event_created_idx on public.owner_action_log(event_id, created_at desc);

alter table public.events enable row level security;
alter table public.event_state enable row level security;
alter table public.carriages enable row level security;
alter table public.guests enable row level security;
alter table public.guest_device_bindings enable row level security;
alter table public.owner_action_log enable row level security;

create policy "owner reads own event"
on public.events for select to authenticated
using (owner_user_id = auth.uid());

create policy "owner updates own event"
on public.events for update to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy "owner reads own event state"
on public.event_state for select to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = event_state.event_id and e.owner_user_id = auth.uid()
  )
);

create policy "owner updates own event state"
on public.event_state for update to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = event_state.event_id and e.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.events e
    where e.id = event_state.event_id and e.owner_user_id = auth.uid()
  )
);

create policy "owner reads carriages"
on public.carriages for select to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = carriages.event_id and e.owner_user_id = auth.uid()
  )
);

create policy "owner manages carriages"
on public.carriages for all to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = carriages.event_id and e.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.events e
    where e.id = carriages.event_id and e.owner_user_id = auth.uid()
  )
);

create policy "owner reads all guests"
on public.guests for select to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = guests.event_id and e.owner_user_id = auth.uid()
  )
);

create policy "owner updates guests"
on public.guests for update to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = guests.event_id and e.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.events e
    where e.id = guests.event_id and e.owner_user_id = auth.uid()
  )
);

create policy "owner deletes guests"
on public.guests for delete to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = guests.event_id and e.owner_user_id = auth.uid()
  )
);

create policy "owner reads device bindings"
on public.guest_device_bindings for select to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = guest_device_bindings.event_id and e.owner_user_id = auth.uid()
  )
);

create policy "owner reads action log"
on public.owner_action_log for select to authenticated
using (owner_user_id = auth.uid());

create or replace function public.register_guest(
  p_event_id uuid,
  p_device_key text,
  p_first_name text,
  p_last_name text,
  p_affiliation_type text,
  p_affiliation_detail text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_event public.events%rowtype;
  v_existing_guest public.guests%rowtype;
  v_carriage public.carriages%rowtype;
  v_guest public.guests%rowtype;
  v_device_hash text;
  v_ticket_number text;
  v_sequence integer;
begin
  if coalesce(btrim(p_device_key), '') = '' then
    raise exception 'device key is required' using errcode = '22023';
  end if;

  if coalesce(btrim(p_first_name), '') = '' or coalesce(btrim(p_last_name), '') = '' then
    raise exception 'first and last name are required' using errcode = '22023';
  end if;

  if p_affiliation_type not in ('liza', 'viktor', 'common', 'family', 'colleagues', 'other') then
    raise exception 'invalid affiliation type' using errcode = '22023';
  end if;

  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  if not v_event.registration_open then
    raise exception 'registration is closed' using errcode = 'P0001';
  end if;

  v_device_hash := encode(digest(p_device_key, 'sha256'), 'hex');

  select g.* into v_existing_guest
  from public.guest_device_bindings b
  join public.guests g on g.id = b.guest_id
  where b.event_id = p_event_id
    and b.device_key_hash = v_device_hash;

  if found then
    update public.guest_device_bindings
    set last_seen_at = now()
    where event_id = p_event_id and device_key_hash = v_device_hash;

    update public.guests set last_seen_at = now() where id = v_existing_guest.id;

    select g.* into v_existing_guest from public.guests g where g.id = v_existing_guest.id;

    return jsonb_build_object(
      'guest', to_jsonb(v_existing_guest),
      'carriage', (
        select to_jsonb(c) from public.carriages c where c.id = v_existing_guest.carriage_id
      ),
      'restored', true
    );
  end if;

  select c.* into v_carriage
  from public.carriages c
  where c.event_id = p_event_id
    and c.enabled
  order by
    (select count(*) from public.guests g where g.event_id = p_event_id and g.carriage_id = c.id) asc,
    (select count(*) from public.guests g where g.event_id = p_event_id and g.carriage_id = c.id and g.affiliation_type = p_affiliation_type) asc,
    random()
  limit 1;

  if not found then
    raise exception 'no enabled carriages' using errcode = 'P0001';
  end if;

  select count(*)::integer + 1 into v_sequence
  from public.guests
  where event_id = p_event_id;

  v_ticket_number := 'LV-' || lpad(v_sequence::text, 3, '0');

  insert into public.guests (
    event_id,
    first_name,
    last_name,
    affiliation_type,
    affiliation_detail,
    carriage_id,
    ticket_number
  ) values (
    p_event_id,
    regexp_replace(btrim(p_first_name), '\s+', ' ', 'g'),
    regexp_replace(btrim(p_last_name), '\s+', ' ', 'g'),
    p_affiliation_type,
    nullif(regexp_replace(btrim(coalesce(p_affiliation_detail, '')), '\s+', ' ', 'g'), ''),
    v_carriage.id,
    v_ticket_number
  ) returning * into v_guest;

  insert into public.guest_device_bindings (event_id, guest_id, device_key_hash)
  values (p_event_id, v_guest.id, v_device_hash);

  return jsonb_build_object(
    'guest', to_jsonb(v_guest),
    'carriage', to_jsonb(v_carriage),
    'restored', false
  );
end;
$$;

create or replace function public.restore_guest(
  p_event_id uuid,
  p_device_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_device_hash text;
  v_guest public.guests%rowtype;
  v_carriage public.carriages%rowtype;
begin
  if coalesce(btrim(p_device_key), '') = '' then
    return null;
  end if;

  v_device_hash := encode(digest(p_device_key, 'sha256'), 'hex');

  select g.* into v_guest
  from public.guest_device_bindings b
  join public.guests g on g.id = b.guest_id
  where b.event_id = p_event_id
    and b.device_key_hash = v_device_hash;

  if not found then
    return null;
  end if;

  select * into v_carriage from public.carriages where id = v_guest.carriage_id;

  update public.guest_device_bindings
  set last_seen_at = now()
  where event_id = p_event_id and device_key_hash = v_device_hash;
  update public.guests set last_seen_at = now() where id = v_guest.id;

  return jsonb_build_object(
    'guest', to_jsonb(v_guest),
    'carriage', to_jsonb(v_carriage)
  );
end;
$$;

create or replace function public.owner_reassign_guest(
  p_guest_id uuid,
  p_carriage_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest public.guests%rowtype;
  v_carriage public.carriages%rowtype;
  v_owner uuid;
begin
  select * into v_guest from public.guests where id = p_guest_id;
  if not found then
    raise exception 'guest not found' using errcode = 'P0002';
  end if;

  select owner_user_id into v_owner from public.events where id = v_guest.event_id;
  if auth.uid() is null or auth.uid() <> v_owner then
    raise exception 'owner access required' using errcode = '42501';
  end if;

  select * into v_carriage
  from public.carriages
  where id = p_carriage_id and event_id = v_guest.event_id and enabled;
  if not found then
    raise exception 'carriage not found for event' using errcode = '22023';
  end if;

  update public.guests set carriage_id = v_carriage.id where id = v_guest.id
  returning * into v_guest;

  insert into public.owner_action_log(event_id, owner_user_id, action_type, summary, payload)
  values (
    v_guest.event_id,
    v_owner,
    'guest_reassigned',
    format('%s %s → %s', v_guest.first_name, v_guest.last_name, v_carriage.label),
    jsonb_build_object('guest_id', v_guest.id, 'carriage_id', v_carriage.id)
  );

  return jsonb_build_object('guest', to_jsonb(v_guest), 'carriage', to_jsonb(v_carriage));
end;
$$;

revoke all on function public.register_guest(uuid, text, text, text, text, text) from public;
grant execute on function public.register_guest(uuid, text, text, text, text, text) to anon, authenticated;

revoke all on function public.restore_guest(uuid, text) from public;
grant execute on function public.restore_guest(uuid, text) to anon, authenticated;

revoke all on function public.owner_reassign_guest(uuid, uuid) from public;
grant execute on function public.owner_reassign_guest(uuid, uuid) to authenticated;
