create table public.screen_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  event_slug text not null,
  kind text not null check (length(btrim(kind)) > 0),
  payload jsonb not null default '{}'::jsonb,
  public_visible boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index screen_events_slug_created_idx
  on public.screen_events(event_slug, created_at desc);
create index screen_events_expiry_idx
  on public.screen_events(expires_at);

alter table public.screen_events enable row level security;

revoke all on table public.screen_events from anon, authenticated;
grant select on table public.screen_events to anon, authenticated;

create policy "public reads active presentation events"
on public.screen_events
for select
to anon, authenticated
using (
  public_visible
  and expires_at > now()
);

create or replace function public._emit_guest_registration_screen_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_slug text;
  v_carriage public.carriages%rowtype;
begin
  select e.slug into v_event_slug
  from public.events e
  where e.id = new.event_id;

  select c.* into v_carriage
  from public.carriages c
  where c.id = new.carriage_id;

  if v_event_slug is null or v_carriage.id is null then
    return new;
  end if;

  delete from public.screen_events
  where event_id = new.event_id
    and expires_at < now() - interval '5 minutes';

  insert into public.screen_events (
    event_id,
    event_slug,
    kind,
    payload,
    public_visible,
    expires_at
  ) values (
    new.event_id,
    v_event_slug,
    'guest_registered',
    jsonb_build_object(
      'displayName', concat_ws(' ', new.first_name, new.last_name),
      'carriage', jsonb_build_object(
        'id', v_carriage.id,
        'number', v_carriage.number,
        'label', v_carriage.label,
        'accentHex', v_carriage.accent_hex,
        'visualMark', v_carriage.visual_mark
      )
    ),
    true,
    now() + interval '45 seconds'
  );

  return new;
end;
$$;

create trigger guest_registration_screen_event
after insert on public.guests
for each row
execute function public._emit_guest_registration_screen_event();

alter publication supabase_realtime add table public.screen_events;
