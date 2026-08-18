create or replace function public.owner_get_mk_control(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.mk_tournaments%rowtype;
  v_registrations jsonb := '[]'::jsonb;
  v_matches jsonb := '[]'::jsonb;
  v_active_count integer := 0;
  v_waitlist_count integer := 0;
begin
  perform public._require_mk_owner(p_event_id);

  select t.* into v_tournament
  from public.mk_tournaments t
  where t.event_id = p_event_id;

  if v_tournament.id is null then
    return jsonb_build_object('status', 'idle');
  end if;

  select count(*) filter (where r.status = 'active')::integer,
         count(*) filter (where r.status = 'waitlist')::integer
  into v_active_count, v_waitlist_count
  from public.mk_registrations r
  where r.tournament_id = v_tournament.id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'registrationId', r.id,
      'guestId', r.guest_id,
      'displayName', r.display_name,
      'status', r.status,
      'seed', r.seed,
      'registeredAt', r.registered_at
    ) order by
      case r.status when 'active' then 1 when 'waitlist' then 2 else 3 end,
      coalesce(r.seed, 999), r.registered_at, r.id
  ), '[]'::jsonb)
  into v_registrations
  from public.mk_registrations r
  where r.tournament_id = v_tournament.id
    and r.status <> 'withdrawn';

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
    'status', 'owner',
    'tournamentId', v_tournament.id,
    'state', v_tournament.state,
    'activeCount', v_active_count,
    'waitlistCount', v_waitlist_count,
    'maxPlayers', v_tournament.max_players,
    'registrations', v_registrations,
    'matches', v_matches,
    'championGuestId', v_tournament.champion_guest_id
  );
end;
$$;

create or replace function public.owner_randomize_mk_seeds(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.mk_tournaments%rowtype;
  v_count integer := 0;
begin
  perform public._require_mk_owner(p_event_id);

  select t.* into v_tournament
  from public.mk_tournaments t
  where t.event_id = p_event_id
  for update;

  if v_tournament.id is null then
    raise exception 'MK tournament not found' using errcode = 'P0002';
  end if;
  if v_tournament.state not in ('registration', 'draw_ready') then
    raise exception 'MK draw is already locked' using errcode = '55000';
  end if;

  select count(*)::integer into v_count
  from public.mk_registrations r
  where r.tournament_id = v_tournament.id and r.status = 'active';

  if v_count = 0 then
    raise exception 'no active MK players' using errcode = '55000';
  end if;

  update public.mk_registrations
  set seed = null, updated_at = now()
  where tournament_id = v_tournament.id and status = 'active';

  with shuffled as (
    select r.id, row_number() over(order by random())::integer as next_seed
    from public.mk_registrations r
    where r.tournament_id = v_tournament.id and r.status = 'active'
  )
  update public.mk_registrations r
  set seed = s.next_seed, updated_at = now()
  from shuffled s
  where r.id = s.id;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (p_event_id, auth.uid(), 'mk_seeds_randomized', jsonb_build_object('activeCount', v_count));

  return jsonb_build_object('status', 'randomized', 'activeCount', v_count);
end;
$$;

create or replace function public.owner_swap_mk_seeds(
  p_registration_a uuid,
  p_registration_b uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a public.mk_registrations%rowtype;
  v_b public.mk_registrations%rowtype;
  v_event_id uuid;
  v_state text;
  v_seed_a integer;
  v_seed_b integer;
begin
  if p_registration_a = p_registration_b then
    raise exception 'two different registrations required' using errcode = '22023';
  end if;

  select r into v_a
  from public.mk_registrations r
  where r.id = p_registration_a
  for update;

  if v_a.id is null then
    raise exception 'MK registration not found' using errcode = 'P0002';
  end if;

  select t.event_id, t.state
  into v_event_id, v_state
  from public.mk_tournaments t
  where t.id = v_a.tournament_id;

  select r into v_b
  from public.mk_registrations r
  where r.id = p_registration_b
  for update;

  if v_b.id is null or v_a.tournament_id <> v_b.tournament_id then
    raise exception 'registrations must belong to one tournament' using errcode = '22023';
  end if;

  perform public._require_mk_owner(v_event_id);

  if v_state not in ('registration', 'draw_ready') then
    raise exception 'MK draw is already locked' using errcode = '55000';
  end if;
  if v_a.status <> 'active' or v_b.status <> 'active' then
    raise exception 'active players required' using errcode = '55000';
  end if;

  v_seed_a := v_a.seed;
  v_seed_b := v_b.seed;

  update public.mk_registrations
  set seed = null, updated_at = now()
  where id in (v_a.id, v_b.id);

  update public.mk_registrations set seed = v_seed_b, updated_at = now() where id = v_a.id;
  update public.mk_registrations set seed = v_seed_a, updated_at = now() where id = v_b.id;

  return jsonb_build_object('status', 'swapped', 'registrationA', v_a.id, 'registrationB', v_b.id);
end;
$$;

create or replace function public.owner_replace_mk_player(
  p_registration_id uuid,
  p_guest_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.mk_registrations%rowtype;
  v_event_id uuid;
  v_state text;
  v_guest public.guests%rowtype;
begin
  select r into v_registration
  from public.mk_registrations r
  where r.id = p_registration_id
  for update;

  if v_registration.id is null then
    raise exception 'MK registration not found' using errcode = 'P0002';
  end if;

  select t.event_id, t.state
  into v_event_id, v_state
  from public.mk_tournaments t
  where t.id = v_registration.tournament_id;

  perform public._require_mk_owner(v_event_id);

  if v_state not in ('registration', 'draw_ready') then
    raise exception 'cannot replace a player after tournament start' using errcode = '55000';
  end if;

  select g.* into v_guest
  from public.guests g
  where g.id = p_guest_id and g.event_id = v_event_id;

  if v_guest.id is null then
    raise exception 'replacement guest must be registered for this event' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.mk_registrations r
    where r.tournament_id = v_registration.tournament_id
      and r.guest_id = p_guest_id
      and r.id <> p_registration_id
      and r.status <> 'withdrawn'
  ) then
    raise exception 'replacement guest is already in MK' using errcode = '23505';
  end if;

  delete from public.mk_registrations r
  where r.tournament_id = v_registration.tournament_id
    and r.guest_id = p_guest_id
    and r.id <> p_registration_id
    and r.status = 'withdrawn';

  update public.mk_registrations
  set guest_id = p_guest_id,
      display_name = concat_ws(' ', v_guest.first_name, v_guest.last_name),
      updated_at = now()
  where id = p_registration_id;

  return jsonb_build_object('status', 'replaced', 'registrationId', p_registration_id, 'guestId', p_guest_id);
end;
$$;

create or replace function public.owner_finalize_mk_draw(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.mk_tournaments%rowtype;
  v_count integer := 0;
  v_seeded integer := 0;
  v_position integer;
  v_player1 uuid;
  v_player2 uuid;
begin
  perform public._require_mk_owner(p_event_id);

  select t.* into v_tournament
  from public.mk_tournaments t
  where t.event_id = p_event_id
  for update;

  if v_tournament.id is null then
    raise exception 'MK tournament not found' using errcode = 'P0002';
  end if;
  if v_tournament.state not in ('registration', 'draw_ready') then
    raise exception 'MK draw is already locked' using errcode = '55000';
  end if;

  select count(*)::integer,
         count(*) filter (where r.seed between 1 and 16)::integer
  into v_count, v_seeded
  from public.mk_registrations r
  where r.tournament_id = v_tournament.id and r.status = 'active';

  if v_count <> 16 then
    raise exception 'exactly 16 active players required' using errcode = '55000';
  end if;
  if v_seeded <> 16 then
    raise exception 'randomize or assign all 16 seeds before start' using errcode = '55000';
  end if;

  delete from public.mk_matches where tournament_id = v_tournament.id;

  for v_position in 1..8 loop
    select r.guest_id into v_player1
    from public.mk_registrations r
    where r.tournament_id = v_tournament.id and r.status = 'active' and r.seed = (v_position * 2 - 1);

    select r.guest_id into v_player2
    from public.mk_registrations r
    where r.tournament_id = v_tournament.id and r.status = 'active' and r.seed = (v_position * 2);

    insert into public.mk_matches(
      tournament_id, match_key, round, position,
      player1_guest_id, player2_guest_id, status
    ) values (
      v_tournament.id, 'r16-' || v_position, 'r16', v_position,
      v_player1, v_player2, 'ready'
    );
  end loop;

  for v_position in 1..4 loop
    insert into public.mk_matches(tournament_id, match_key, round, position, status)
    values (v_tournament.id, 'qf-' || v_position, 'qf', v_position, 'pending');
  end loop;

  for v_position in 1..2 loop
    insert into public.mk_matches(tournament_id, match_key, round, position, status)
    values (v_tournament.id, 'sf-' || v_position, 'sf', v_position, 'pending');
  end loop;

  insert into public.mk_matches(tournament_id, match_key, round, position, status)
  values (v_tournament.id, 'final-1', 'final', 1, 'pending');

  update public.mk_tournaments
  set state = 'active', current_match_id = null, champion_guest_id = null, updated_at = now()
  where id = v_tournament.id;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (p_event_id, auth.uid(), 'mk_draw_finalized', jsonb_build_object('players', 16, 'matches', 15));

  return jsonb_build_object('status', 'active', 'players', 16, 'matches', 15);
end;
$$;

revoke all on function public.owner_get_mk_control(uuid) from public, anon;
revoke all on function public.owner_randomize_mk_seeds(uuid) from public, anon;
revoke all on function public.owner_swap_mk_seeds(uuid, uuid) from public, anon;
revoke all on function public.owner_replace_mk_player(uuid, uuid) from public, anon;
revoke all on function public.owner_finalize_mk_draw(uuid) from public, anon;

grant execute on function public.owner_get_mk_control(uuid) to authenticated;
grant execute on function public.owner_randomize_mk_seeds(uuid) to authenticated;
grant execute on function public.owner_swap_mk_seeds(uuid, uuid) to authenticated;
grant execute on function public.owner_replace_mk_player(uuid, uuid) to authenticated;
grant execute on function public.owner_finalize_mk_draw(uuid) to authenticated;
