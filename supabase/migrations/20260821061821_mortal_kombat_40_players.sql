-- Expand the wedding arena without opening a tournament implicitly. Existing
-- tournament rows keep their lifecycle state; only their capacity contract is
-- upgraded so every RPC returns the same value.
alter table public.mk_tournaments
  drop constraint if exists mk_tournaments_max_players_check;

alter table public.mk_tournaments
  alter column max_players set default 40;

update public.mk_tournaments
set max_players = 40
where max_players <> 40;

alter table public.mk_tournaments
  add constraint mk_tournaments_max_players_check check (max_players = 40);

alter table public.mk_registrations
  drop constraint if exists mk_registrations_seed_check;

alter table public.mk_registrations
  add constraint mk_registrations_seed_check check (seed is null or seed between 1 and 40);

alter table public.mk_matches
  drop constraint if exists mk_matches_round_check;

alter table public.mk_matches
  add constraint mk_matches_round_check check (round in ('r64', 'r32', 'r16', 'qf', 'sf', 'final'));

create or replace function public.owner_open_mk_registration(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament_id uuid;
begin
  perform public._require_mk_owner(p_event_id);

  insert into public.mk_tournaments(event_id, state, max_players, updated_at)
  values (p_event_id, 'registration', 40, now())
  on conflict (event_id) do update
  set state = case
        when mk_tournaments.state in ('active', 'complete') then mk_tournaments.state
        else 'registration'
      end,
      max_players = 40,
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

  return jsonb_build_object('status', 'registration', 'tournamentId', v_tournament_id, 'maxPlayers', 40);
end;
$$;

create or replace function public.owner_get_mk_control(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
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
      case m.round
        when 'r64' then 1
        when 'r32' then 2
        when 'r16' then 3
        when 'qf' then 4
        when 'sf' then 5
        else 6
      end,
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

create or replace function public.owner_close_mk_registration(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament public.mk_tournaments%rowtype;
  v_active_count integer := 0;
begin
  perform public._require_mk_owner(p_event_id);

  select t.* into v_tournament
  from public.mk_tournaments t
  where t.event_id = p_event_id
  for update;

  if v_tournament.id is null then
    raise exception 'MK tournament not found' using errcode = 'P0002';
  end if;

  select count(*)::integer into v_active_count
  from public.mk_registrations r
  where r.tournament_id = v_tournament.id and r.status = 'active';

  if v_active_count < 2 then
    raise exception 'at least 2 active players required' using errcode = '55000';
  end if;

  update public.mk_tournaments
  set state = 'draw_ready', updated_at = now()
  where id = v_tournament.id and state = 'registration';

  if not found then
    raise exception 'MK registration is not open' using errcode = '55000';
  end if;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (p_event_id, auth.uid(), 'mk_registration_closed', jsonb_build_object('activeCount', v_active_count));

  return jsonb_build_object(
    'status', 'draw_ready',
    'activeCount', v_active_count,
    'maxPlayers', v_tournament.max_players
  );
end;
$$;

create or replace function public.get_mk_tournament_state(
  p_event_slug text,
  p_device_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
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
  v_present_on_main_screen boolean := false;
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

  select exists(
    select 1
    from public.event_state s
    where s.event_id = v_event_id
      and s.current_module = 'mortal_kombat'
      and s.screen_pinned
  ) into v_present_on_main_screen;

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
      case m.round
        when 'r64' then 1
        when 'r32' then 2
        when 'r16' then 3
        when 'qf' then 4
        when 'sf' then 5
        else 6
      end,
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
    'championGuestId', v_tournament.champion_guest_id,
    'presentOnMainScreen', v_present_on_main_screen
  );
end;
$$;

create or replace function public.owner_promote_mk_waitlist(p_registration_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registration public.mk_registrations%rowtype;
  v_tournament public.mk_tournaments%rowtype;
  v_active_count integer := 0;
begin
  select r.* into v_registration
  from public.mk_registrations r
  where r.id = p_registration_id
  for update;

  if v_registration.id is null then
    raise exception 'MK registration not found' using errcode = 'P0002';
  end if;

  select t.* into v_tournament
  from public.mk_tournaments t
  where t.id = v_registration.tournament_id
  for update;

  perform public._require_mk_owner(v_tournament.event_id);

  if v_registration.status <> 'waitlist' then
    raise exception 'waitlisted player required' using errcode = '55000';
  end if;

  if v_tournament.state not in ('registration', 'draw_ready') then
    raise exception 'MK draw is already locked' using errcode = '55000';
  end if;

  select count(*)::integer into v_active_count
  from public.mk_registrations r
  where r.tournament_id = v_registration.tournament_id and r.status = 'active';

  if v_active_count >= v_tournament.max_players then
    raise exception 'active bracket is full' using errcode = '55000';
  end if;

  update public.mk_registrations
  set status = 'active', seed = null, updated_at = now()
  where id = p_registration_id;

  return jsonb_build_object('status', 'active', 'registrationId', p_registration_id);
end;
$$;

create or replace function public._mk_next_match(
  p_round text,
  p_position integer
)
returns table(next_round text, next_position integer, next_slot text)
language sql
immutable
set search_path = ''
as $$
  select
    case p_round
      when 'r64' then 'r32'
      when 'r32' then 'r16'
      when 'r16' then 'qf'
      when 'qf' then 'sf'
      when 'sf' then 'final'
      else null
    end,
    case when p_round = 'final' then null else ceil(p_position / 2.0)::integer end,
    case when p_round = 'final' then null when p_position % 2 = 1 then 'player1' else 'player2' end;
$$;

create or replace function public.owner_finalize_mk_draw(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament public.mk_tournaments%rowtype;
  v_count integer := 0;
  v_seeded integer := 0;
  v_distinct_seeds integer := 0;
  v_bracket_size integer := 2;
  v_expanded_size integer;
  v_current_seed_size integer;
  v_seed_order integer[] := array[1, 2];
  v_next_seed_order integer[];
  v_rounds text[] := array['r64', 'r32', 'r16', 'qf', 'sf', 'final'];
  v_first_round_index integer;
  v_round_index integer;
  v_position integer;
  v_round text;
  v_source_round text;
  v_round_count integer;
  v_seed1 integer;
  v_seed2 integer;
  v_player1 uuid;
  v_player2 uuid;
  v_winner uuid;
  v_status text;
  v_source1 public.mk_matches%rowtype;
  v_source2 public.mk_matches%rowtype;
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
  where r.tournament_id = v_tournament.id
    and r.status = 'active';

  if v_count < 2 or v_count > v_tournament.max_players then
    raise exception 'between 2 and % active players required', v_tournament.max_players using errcode = '55000';
  end if;

  select
    count(*) filter (where r.seed between 1 and v_count)::integer,
    count(distinct r.seed) filter (where r.seed between 1 and v_count)::integer
  into v_seeded, v_distinct_seeds
  from public.mk_registrations r
  where r.tournament_id = v_tournament.id
    and r.status = 'active';

  if v_seeded <> v_count or v_distinct_seeds <> v_count then
    raise exception 'randomize or assign every active player a unique seed from 1 to %', v_count using errcode = '55000';
  end if;

  while v_bracket_size < v_count loop
    v_bracket_size := v_bracket_size * 2;
  end loop;

  if v_bracket_size >= 16 then
    v_seed_order := array[1,16,8,9,5,12,4,13,6,11,3,14,7,10,2,15];
    v_current_seed_size := 16;
  else
    v_seed_order := array[1,2];
    v_current_seed_size := 2;
  end if;

  while v_current_seed_size < v_bracket_size loop
    v_expanded_size := v_current_seed_size * 2;
    v_next_seed_order := array[]::integer[];
    for v_position in 1..array_length(v_seed_order, 1) loop
      v_next_seed_order := array_append(v_next_seed_order, v_seed_order[v_position]);
      v_next_seed_order := array_append(v_next_seed_order, v_expanded_size + 1 - v_seed_order[v_position]);
    end loop;
    v_seed_order := v_next_seed_order;
    v_current_seed_size := v_expanded_size;
  end loop;

  v_first_round_index := case v_bracket_size
    when 64 then 1
    when 32 then 2
    when 16 then 3
    when 8 then 4
    when 4 then 5
    else 6
  end;

  delete from public.mk_matches
  where tournament_id = v_tournament.id;

  v_round := v_rounds[v_first_round_index];
  v_round_count := v_bracket_size / 2;

  for v_position in 1..v_round_count loop
    v_seed1 := v_seed_order[(v_position - 1) * 2 + 1];
    v_seed2 := v_seed_order[(v_position - 1) * 2 + 2];
    v_player1 := null;
    v_player2 := null;
    v_winner := null;

    select r.guest_id into v_player1
    from public.mk_registrations r
    where r.tournament_id = v_tournament.id
      and r.status = 'active'
      and r.seed = v_seed1;

    select r.guest_id into v_player2
    from public.mk_registrations r
    where r.tournament_id = v_tournament.id
      and r.status = 'active'
      and r.seed = v_seed2;

    if v_player1 is not null and v_player2 is not null then
      v_status := 'ready';
    elsif v_player1 is not null then
      v_status := 'complete';
      v_winner := v_player1;
    elsif v_player2 is not null then
      v_status := 'complete';
      v_winner := v_player2;
    else
      v_status := 'complete';
    end if;

    insert into public.mk_matches(
      tournament_id, match_key, round, position,
      player1_guest_id, player2_guest_id, winner_guest_id, status
    ) values (
      v_tournament.id, v_round || '-' || v_position, v_round, v_position,
      v_player1, v_player2, v_winner, v_status
    );
  end loop;

  if v_first_round_index < array_length(v_rounds, 1) then
    for v_round_index in (v_first_round_index + 1)..array_length(v_rounds, 1) loop
      v_source_round := v_round;
      v_round := v_rounds[v_round_index];
      v_round_count := v_round_count / 2;

      for v_position in 1..v_round_count loop
        select m.* into v_source1
        from public.mk_matches m
        where m.tournament_id = v_tournament.id
          and m.round = v_source_round
          and m.position = (v_position * 2 - 1);

        select m.* into v_source2
        from public.mk_matches m
        where m.tournament_id = v_tournament.id
          and m.round = v_source_round
          and m.position = (v_position * 2);

        v_player1 := v_source1.winner_guest_id;
        v_player2 := v_source2.winner_guest_id;
        v_winner := null;

        if v_source1.status = 'complete' and v_source2.status = 'complete' then
          if v_player1 is not null and v_player2 is not null then
            v_status := 'ready';
          elsif v_player1 is not null then
            v_status := 'complete';
            v_winner := v_player1;
          elsif v_player2 is not null then
            v_status := 'complete';
            v_winner := v_player2;
          else
            v_status := 'complete';
          end if;
        else
          v_status := 'pending';
        end if;

        insert into public.mk_matches(
          tournament_id, match_key, round, position,
          player1_guest_id, player2_guest_id, winner_guest_id, status
        ) values (
          v_tournament.id, v_round || '-' || v_position, v_round, v_position,
          v_player1, v_player2, v_winner, v_status
        );
      end loop;
    end loop;
  end if;

  if exists (
    select 1 from public.mk_matches m
    where m.tournament_id = v_tournament.id
      and m.round = 'final'
      and m.position = 1
      and m.status = 'complete'
  ) then
    raise exception 'invalid MK bracket: final resolved during draw' using errcode = '55000';
  end if;

  update public.mk_tournaments
  set state = 'active',
      current_match_id = null,
      champion_guest_id = null,
      updated_at = now()
  where id = v_tournament.id;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    p_event_id,
    auth.uid(),
    'mk_draw_finalized',
    jsonb_build_object(
      'players', v_count,
      'fights', v_count - 1,
      'bracketSize', v_bracket_size,
      'internalMatches', v_bracket_size - 1
    )
  );

  return jsonb_build_object(
    'status', 'active',
    'players', v_count,
    'fights', v_count - 1,
    'bracketSize', v_bracket_size,
    'matches', v_bracket_size - 1
  );
end;
$$;

revoke all on function public.owner_open_mk_registration(uuid) from public, anon;
revoke all on function public.owner_close_mk_registration(uuid) from public, anon;
revoke all on function public.owner_promote_mk_waitlist(uuid) from public, anon;
revoke all on function public.owner_finalize_mk_draw(uuid) from public, anon;
revoke all on function public.owner_get_mk_control(uuid) from public, anon;
revoke all on function public.get_mk_tournament_state(text, text) from public;
revoke all on function public._mk_next_match(text, integer) from public, anon, authenticated;

grant execute on function public.owner_open_mk_registration(uuid) to authenticated;
grant execute on function public.owner_close_mk_registration(uuid) to authenticated;
grant execute on function public.owner_promote_mk_waitlist(uuid) to authenticated;
grant execute on function public.owner_finalize_mk_draw(uuid) to authenticated;
grant execute on function public.owner_get_mk_control(uuid) to authenticated;
grant execute on function public.get_mk_tournament_state(text, text) to anon, authenticated;
