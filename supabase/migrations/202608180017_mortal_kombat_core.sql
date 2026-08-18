create table public.mk_tournaments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  state text not null default 'registration' check (state in ('registration', 'draw_ready', 'active', 'complete')),
  max_players integer not null default 16 check (max_players = 16),
  current_match_id uuid,
  champion_guest_id uuid references public.guests(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mk_registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.mk_tournaments(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) > 0),
  status text not null check (status in ('active', 'waitlist', 'withdrawn')),
  seed integer check (seed is null or seed between 1 and 16),
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, guest_id)
);

create unique index mk_registrations_tournament_seed_unique
  on public.mk_registrations(tournament_id, seed)
  where seed is not null;

create table public.mk_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.mk_tournaments(id) on delete cascade,
  match_key text not null,
  round text not null check (round in ('r16', 'qf', 'sf', 'final')),
  position integer not null check (position > 0),
  player1_guest_id uuid references public.guests(id) on delete set null,
  player2_guest_id uuid references public.guests(id) on delete set null,
  winner_guest_id uuid references public.guests(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'ready', 'complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, match_key),
  unique (tournament_id, round, position)
);

alter table public.mk_tournaments
  add constraint mk_current_match_fk
  foreign key (current_match_id) references public.mk_matches(id) on delete set null;

create index mk_registrations_tournament_status_idx
  on public.mk_registrations(tournament_id, status, registered_at);
create index mk_matches_tournament_round_idx
  on public.mk_matches(tournament_id, round, position);

alter table public.mk_tournaments enable row level security;
alter table public.mk_registrations enable row level security;
alter table public.mk_matches enable row level security;

revoke all on table public.mk_tournaments from anon, authenticated;
revoke all on table public.mk_registrations from anon, authenticated;
revoke all on table public.mk_matches from anon, authenticated;

grant select, insert, update, delete on table public.mk_tournaments to authenticated;
grant select, insert, update, delete on table public.mk_registrations to authenticated;
grant select, insert, update, delete on table public.mk_matches to authenticated;

create policy "owner manages own MK tournament"
on public.mk_tournaments
for all
to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = mk_tournaments.event_id
      and e.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.events e
    where e.id = mk_tournaments.event_id
      and e.owner_user_id = auth.uid()
  )
);

create policy "owner manages own MK registrations"
on public.mk_registrations
for all
to authenticated
using (
  exists (
    select 1
    from public.mk_tournaments t
    join public.events e on e.id = t.event_id
    where t.id = mk_registrations.tournament_id
      and e.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.mk_tournaments t
    join public.events e on e.id = t.event_id
    where t.id = mk_registrations.tournament_id
      and e.owner_user_id = auth.uid()
  )
);

create policy "owner manages own MK matches"
on public.mk_matches
for all
to authenticated
using (
  exists (
    select 1
    from public.mk_tournaments t
    join public.events e on e.id = t.event_id
    where t.id = mk_matches.tournament_id
      and e.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.mk_tournaments t
    join public.events e on e.id = t.event_id
    where t.id = mk_matches.tournament_id
      and e.owner_user_id = auth.uid()
  )
);

create or replace function public._require_mk_owner(p_event_id uuid)
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

create or replace function public.owner_open_mk_registration(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_id uuid;
begin
  perform public._require_mk_owner(p_event_id);

  insert into public.mk_tournaments(event_id, state, max_players, updated_at)
  values (p_event_id, 'registration', 16, now())
  on conflict (event_id) do update
  set state = case
        when mk_tournaments.state in ('active', 'complete') then mk_tournaments.state
        else 'registration'
      end,
      updated_at = now()
  returning id into v_tournament_id;

  if exists (
    select 1 from public.mk_tournaments t
    where t.id = v_tournament_id and t.state in ('active', 'complete')
  ) then
    raise exception 'started tournament cannot reopen registration' using errcode = '55000';
  end if;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (p_event_id, auth.uid(), 'mk_registration_opened', '{}'::jsonb);

  return jsonb_build_object('status', 'registration', 'tournamentId', v_tournament_id, 'maxPlayers', 16);
end;
$$;

create or replace function public.owner_close_mk_registration(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_id uuid;
  v_active_count integer := 0;
begin
  perform public._require_mk_owner(p_event_id);

  select t.id into v_tournament_id
  from public.mk_tournaments t
  where t.event_id = p_event_id
  for update;

  if v_tournament_id is null then
    raise exception 'MK tournament not found' using errcode = 'P0002';
  end if;

  select count(*)::integer into v_active_count
  from public.mk_registrations r
  where r.tournament_id = v_tournament_id and r.status = 'active';

  update public.mk_tournaments
  set state = 'draw_ready', updated_at = now()
  where id = v_tournament_id and state = 'registration';

  if not found then
    raise exception 'MK registration is not open' using errcode = '55000';
  end if;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (p_event_id, auth.uid(), 'mk_registration_closed', jsonb_build_object('activeCount', v_active_count));

  return jsonb_build_object('status', 'draw_ready', 'activeCount', v_active_count, 'maxPlayers', 16);
end;
$$;

create or replace function public.join_mk_tournament(
  p_event_slug text,
  p_device_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_tournament public.mk_tournaments%rowtype;
  v_guest public.guests%rowtype;
  v_existing public.mk_registrations%rowtype;
  v_status text;
  v_active_count integer := 0;
  v_waitlist_position integer := 0;
begin
  if length(coalesce(p_device_key, '')) < 8 then
    raise exception 'registered guest required' using errcode = '42501';
  end if;

  select e.id into v_event_id
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug);

  if v_event_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select g.* into v_guest
  from public.guest_device_bindings b
  join public.guests g on g.id = b.guest_id and g.event_id = b.event_id
  where b.event_id = v_event_id
    and b.device_key_hash = public._device_hash(p_device_key);

  if v_guest.id is null then
    raise exception 'registered guest required' using errcode = '42501';
  end if;

  select t.* into v_tournament
  from public.mk_tournaments t
  where t.event_id = v_event_id
  for update;

  if v_tournament.id is null or v_tournament.state <> 'registration' then
    return jsonb_build_object('status', 'closed');
  end if;

  select r.* into v_existing
  from public.mk_registrations r
  where r.tournament_id = v_tournament.id
    and r.guest_id = v_guest.id;

  if v_existing.id is not null and v_existing.status <> 'withdrawn' then
    select count(*)::integer into v_active_count
    from public.mk_registrations r
    where r.tournament_id = v_tournament.id and r.status = 'active';

    if v_existing.status = 'waitlist' then
      select count(*)::integer into v_waitlist_position
      from public.mk_registrations r
      where r.tournament_id = v_tournament.id
        and r.status = 'waitlist'
        and (r.registered_at, r.id) <= (v_existing.registered_at, v_existing.id);
    end if;

    return jsonb_build_object(
      'status', 'already_joined',
      'registrationStatus', v_existing.status,
      'activeCount', v_active_count,
      'maxPlayers', v_tournament.max_players,
      'waitlistPosition', case when v_existing.status = 'waitlist' then v_waitlist_position else null end
    );
  end if;

  select count(*)::integer into v_active_count
  from public.mk_registrations r
  where r.tournament_id = v_tournament.id and r.status = 'active';

  v_status := case when v_active_count < v_tournament.max_players then 'active' else 'waitlist' end;

  insert into public.mk_registrations(
    tournament_id, guest_id, display_name, status, seed, registered_at, updated_at
  ) values (
    v_tournament.id,
    v_guest.id,
    concat_ws(' ', v_guest.first_name, v_guest.last_name),
    v_status,
    null,
    now(),
    now()
  )
  on conflict (tournament_id, guest_id) do update
  set display_name = excluded.display_name,
      status = excluded.status,
      seed = null,
      registered_at = now(),
      updated_at = now()
  returning * into v_existing;

  select count(*)::integer into v_active_count
  from public.mk_registrations r
  where r.tournament_id = v_tournament.id and r.status = 'active';

  if v_status = 'waitlist' then
    select count(*)::integer into v_waitlist_position
    from public.mk_registrations r
    where r.tournament_id = v_tournament.id
      and r.status = 'waitlist'
      and (r.registered_at, r.id) <= (v_existing.registered_at, v_existing.id);
  end if;

  return jsonb_build_object(
    'status', 'joined',
    'registrationStatus', v_status,
    'activeCount', v_active_count,
    'maxPlayers', v_tournament.max_players,
    'waitlistPosition', case when v_status = 'waitlist' then v_waitlist_position else null end
  );
end;
$$;

create or replace function public.owner_promote_mk_waitlist(p_registration_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.mk_registrations%rowtype;
  v_event_id uuid;
  v_active_count integer := 0;
begin
  select r into v_registration
  from public.mk_registrations r
  where r.id = p_registration_id
  for update;

  if v_registration.id is null then
    raise exception 'MK registration not found' using errcode = 'P0002';
  end if;

  select t.event_id into v_event_id
  from public.mk_tournaments t
  where t.id = v_registration.tournament_id;

  perform public._require_mk_owner(v_event_id);

  if v_registration.status <> 'waitlist' then
    raise exception 'waitlisted player required' using errcode = '55000';
  end if;

  select count(*)::integer into v_active_count
  from public.mk_registrations r
  where r.tournament_id = v_registration.tournament_id and r.status = 'active';

  if v_active_count >= 16 then
    raise exception 'active bracket is full' using errcode = '55000';
  end if;

  update public.mk_registrations
  set status = 'active', seed = null, updated_at = now()
  where id = p_registration_id;

  return jsonb_build_object('status', 'active', 'registrationId', p_registration_id);
end;
$$;

create or replace function public.owner_remove_mk_player(p_registration_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.mk_registrations%rowtype;
  v_event_id uuid;
  v_tournament_state text;
begin
  select r into v_registration
  from public.mk_registrations r
  where r.id = p_registration_id
  for update;

  if v_registration.id is null then
    raise exception 'MK registration not found' using errcode = 'P0002';
  end if;

  select t.event_id, t.state
  into v_event_id, v_tournament_state
  from public.mk_tournaments t
  where t.id = v_registration.tournament_id;

  perform public._require_mk_owner(v_event_id);

  if v_tournament_state in ('active', 'complete') then
    raise exception 'use bracket correction after tournament start' using errcode = '55000';
  end if;

  update public.mk_registrations
  set status = 'withdrawn', seed = null, updated_at = now()
  where id = p_registration_id;

  return jsonb_build_object('status', 'withdrawn', 'registrationId', p_registration_id);
end;
$$;

create or replace function public.get_mk_tournament_state(
  p_event_slug text,
  p_device_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_tournament public.mk_tournaments%rowtype;
  v_guest_id uuid;
  v_own_status text;
  v_waitlist_position integer;
  v_active_count integer := 0;
  v_players jsonb := '[]'::jsonb;
  v_matches jsonb := '[]'::jsonb;
begin
  select e.id into v_event_id
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug);

  if v_event_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select t.* into v_tournament
  from public.mk_tournaments t
  where t.event_id = v_event_id;

  if v_tournament.id is null then
    return jsonb_build_object('status', 'idle');
  end if;

  if length(coalesce(p_device_key, '')) >= 8 then
    select b.guest_id into v_guest_id
    from public.guest_device_bindings b
    where b.event_id = v_event_id
      and b.device_key_hash = public._device_hash(p_device_key);
  end if;

  if v_guest_id is not null then
    select r.status into v_own_status
    from public.mk_registrations r
    where r.tournament_id = v_tournament.id and r.guest_id = v_guest_id;

    if v_own_status = 'waitlist' then
      select count(*)::integer into v_waitlist_position
      from public.mk_registrations mine
      join public.mk_registrations r
        on r.tournament_id = mine.tournament_id
       and r.status = 'waitlist'
       and (r.registered_at, r.id) <= (mine.registered_at, mine.id)
      where mine.tournament_id = v_tournament.id and mine.guest_id = v_guest_id;
    end if;
  end if;

  select count(*)::integer into v_active_count
  from public.mk_registrations r
  where r.tournament_id = v_tournament.id and r.status = 'active';

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'registrationId', r.id,
      'guestId', r.guest_id,
      'displayName', r.display_name,
      'seed', r.seed
    ) order by coalesce(r.seed, 999), r.registered_at, r.id
  ), '[]'::jsonb)
  into v_players
  from public.mk_registrations r
  where r.tournament_id = v_tournament.id and r.status = 'active';

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'matchKey', m.match_key,
      'round', m.round,
      'position', m.position,
      'player1GuestId', m.player1_guest_id,
      'player2GuestId', m.player2_guest_id,
      'winnerGuestId', m.winner_guest_id,
      'status', m.status,
      'current', m.id = v_tournament.current_match_id
    ) order by
      case m.round when 'r16' then 1 when 'qf' then 2 when 'sf' then 3 else 4 end,
      m.position
  ), '[]'::jsonb)
  into v_matches
  from public.mk_matches m
  where m.tournament_id = v_tournament.id;

  return jsonb_build_object(
    'status', 'active',
    'tournamentId', v_tournament.id,
    'state', v_tournament.state,
    'activeCount', v_active_count,
    'maxPlayers', v_tournament.max_players,
    'ownRegistrationStatus', v_own_status,
    'waitlistPosition', v_waitlist_position,
    'players', v_players,
    'matches', v_matches,
    'championGuestId', v_tournament.champion_guest_id
  );
end;
$$;

revoke all on function public._require_mk_owner(uuid) from public, anon, authenticated;
revoke all on function public.owner_open_mk_registration(uuid) from public, anon;
revoke all on function public.owner_close_mk_registration(uuid) from public, anon;
revoke all on function public.owner_promote_mk_waitlist(uuid) from public, anon;
revoke all on function public.owner_remove_mk_player(uuid) from public, anon;
revoke all on function public.join_mk_tournament(text, text) from public;
revoke all on function public.get_mk_tournament_state(text, text) from public;

grant execute on function public.owner_open_mk_registration(uuid) to authenticated;
grant execute on function public.owner_close_mk_registration(uuid) to authenticated;
grant execute on function public.owner_promote_mk_waitlist(uuid) to authenticated;
grant execute on function public.owner_remove_mk_player(uuid) to authenticated;
grant execute on function public.join_mk_tournament(text, text) to anon, authenticated;
grant execute on function public.get_mk_tournament_state(text, text) to anon, authenticated;
