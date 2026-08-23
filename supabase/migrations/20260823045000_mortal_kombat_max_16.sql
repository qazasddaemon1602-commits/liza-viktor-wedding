-- Return Mortal Kombat to the event-day maximum of sixteen without deleting guests.
-- Pre-start overflow is repaired deterministically; unsafe live legacy brackets abort.
create or replace function public._repair_mk_max_16_data()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform t.id
  from public.mk_tournaments t
  for update;

  if exists (
    select 1
    from public.mk_tournaments t
    where t.state in ('active', 'complete')
      and (
        (select count(*) from public.mk_registrations r
         where r.tournament_id = t.id and r.status = 'active') > 16
        or exists (
          select 1 from public.mk_matches m
          where m.tournament_id = t.id and m.round in ('r64', 'r32')
        )
      )
  ) then
    raise exception 'MK_MAX_16_REQUIRES_RESET' using errcode = '55000';
  end if;

  update public.mk_registrations r
  set seed = null, updated_at = now()
  from public.mk_tournaments t
  where t.id = r.tournament_id
    and t.state in ('registration', 'draw_ready')
    and r.status in ('active', 'waitlist')
    and r.seed is not null;

  with ranked as (
    select r.id,
           row_number() over (
             partition by r.tournament_id
             order by r.registered_at, r.id
           ) as registration_rank
    from public.mk_registrations r
    join public.mk_tournaments t on t.id = r.tournament_id
    where t.state in ('registration', 'draw_ready')
      and r.status = 'active'
  )
  update public.mk_registrations r
  set status = 'waitlist', seed = null, updated_at = now()
  from ranked
  where ranked.id = r.id
    and ranked.registration_rank > 16;

  delete from public.mk_matches m
  using public.mk_tournaments t
  where t.id = m.tournament_id
    and t.state in ('registration', 'draw_ready');
end;
$$;

revoke all on function public._repair_mk_max_16_data() from public, anon, authenticated;

select public._repair_mk_max_16_data();

alter table public.mk_tournaments
  drop constraint if exists mk_tournaments_max_players_check;
alter table public.mk_tournaments
  alter column max_players set default 16;
update public.mk_tournaments set max_players = 16 where max_players <> 16;
alter table public.mk_tournaments
  add constraint mk_tournaments_max_players_check check (max_players = 16);

alter table public.mk_registrations
  drop constraint if exists mk_registrations_seed_check;
alter table public.mk_registrations
  add constraint mk_registrations_seed_check check (seed is null or seed between 1 and 16);

alter table public.mk_matches
  drop constraint if exists mk_matches_round_check;
alter table public.mk_matches
  add constraint mk_matches_round_check check (round in ('r16', 'qf', 'sf', 'final'));

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
  values (p_event_id, 'registration', 16, now())
  on conflict (event_id) do update
  set state = case
        when mk_tournaments.state in ('active', 'complete') then mk_tournaments.state
        else 'registration'
      end,
      max_players = 16,
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

create or replace function public.owner_randomize_mk_seeds(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
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
  if v_count > 16 then
    raise exception 'between 1 and 16 active players required' using errcode = '55000';
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

create or replace function public._mk_next_match(p_round text, p_position integer)
returns table(next_round text, next_position integer, next_slot text)
language sql
immutable
set search_path = ''
as $$
  select
    case p_round
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
  v_rounds text[] := array['r16', 'qf', 'sf', 'final'];
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
  where r.tournament_id = v_tournament.id and r.status = 'active';

  if v_count < 2 or v_count > 16 then
    raise exception 'between 2 and 16 active players required' using errcode = '55000';
  end if;

  select
    count(*) filter (where r.seed between 1 and v_count)::integer,
    count(distinct r.seed) filter (where r.seed between 1 and v_count)::integer
  into v_seeded, v_distinct_seeds
  from public.mk_registrations r
  where r.tournament_id = v_tournament.id and r.status = 'active';

  if v_seeded <> v_count or v_distinct_seeds <> v_count then
    raise exception 'randomize or assign every active player a unique seed from 1 to %', v_count using errcode = '55000';
  end if;

  while v_bracket_size < v_count loop
    v_bracket_size := v_bracket_size * 2;
  end loop;

  if v_bracket_size = 16 then
    v_seed_order := array[1,16,8,9,5,12,4,13,6,11,3,14,7,10,2,15];
    v_current_seed_size := 16;
  else
    v_current_seed_size := 2;
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
  end if;

  v_first_round_index := case v_bracket_size
    when 16 then 1
    when 8 then 2
    when 4 then 3
    else 4
  end;

  delete from public.mk_matches where tournament_id = v_tournament.id;

  v_round := v_rounds[v_first_round_index];
  v_round_count := v_bracket_size / 2;
  for v_position in 1..v_round_count loop
    v_seed1 := v_seed_order[(v_position - 1) * 2 + 1];
    v_seed2 := v_seed_order[(v_position - 1) * 2 + 2];
    select r.guest_id into v_player1 from public.mk_registrations r
      where r.tournament_id = v_tournament.id and r.status = 'active' and r.seed = v_seed1;
    select r.guest_id into v_player2 from public.mk_registrations r
      where r.tournament_id = v_tournament.id and r.status = 'active' and r.seed = v_seed2;
    v_winner := null;
    if v_player1 is not null and v_player2 is not null then v_status := 'ready';
    elsif v_player1 is not null then v_status := 'complete'; v_winner := v_player1;
    elsif v_player2 is not null then v_status := 'complete'; v_winner := v_player2;
    else v_status := 'complete';
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
        select m.* into v_source1 from public.mk_matches m
          where m.tournament_id = v_tournament.id and m.round = v_source_round and m.position = v_position * 2 - 1;
        select m.* into v_source2 from public.mk_matches m
          where m.tournament_id = v_tournament.id and m.round = v_source_round and m.position = v_position * 2;
        v_player1 := v_source1.winner_guest_id;
        v_player2 := v_source2.winner_guest_id;
        v_winner := null;
        if v_source1.status = 'complete' and v_source2.status = 'complete' then
          if v_player1 is not null and v_player2 is not null then v_status := 'ready';
          elsif v_player1 is not null then v_status := 'complete'; v_winner := v_player1;
          elsif v_player2 is not null then v_status := 'complete'; v_winner := v_player2;
          else v_status := 'complete';
          end if;
        else v_status := 'pending';
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
    where m.tournament_id = v_tournament.id and m.round = 'final' and m.position = 1 and m.status = 'complete'
  ) then
    raise exception 'invalid MK bracket: final resolved during draw' using errcode = '55000';
  end if;

  update public.mk_tournaments
  set state = 'active', current_match_id = null, champion_guest_id = null, max_players = 16, updated_at = now()
  where id = v_tournament.id;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (p_event_id, auth.uid(), 'mk_draw_finalized', jsonb_build_object(
    'players', v_count, 'fights', v_count - 1, 'bracketSize', v_bracket_size, 'internalMatches', v_bracket_size - 1
  ));

  return jsonb_build_object(
    'status', 'active', 'players', v_count, 'fights', v_count - 1,
    'bracketSize', v_bracket_size, 'matches', v_bracket_size - 1
  );
end;
$$;

create or replace function public.owner_reset_mk_tournament(p_event_id uuid, p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament_id uuid;
  v_registrations_removed integer := 0;
  v_matches_removed integer := 0;
begin
  perform public._require_mk_owner(p_event_id);
  if p_confirmation is distinct from 'СБРОСИТЬ ТУРНИР' then
    raise exception 'Для сброса введите: СБРОСИТЬ ТУРНИР' using errcode = '22023';
  end if;

  select t.id into v_tournament_id from public.mk_tournaments t
  where t.event_id = p_event_id for update;
  if v_tournament_id is null then
    return jsonb_build_object('status', 'idle', 'registrationsRemoved', 0, 'matchesRemoved', 0);
  end if;

  select count(*)::integer into v_matches_removed from public.mk_matches where tournament_id = v_tournament_id;
  select count(*)::integer into v_registrations_removed from public.mk_registrations where tournament_id = v_tournament_id;
  delete from public.mk_matches where tournament_id = v_tournament_id;
  delete from public.mk_registrations where tournament_id = v_tournament_id;
  update public.mk_tournaments
  set state = 'registration', max_players = 16, current_match_id = null,
      champion_guest_id = null, updated_at = now()
  where id = v_tournament_id;

  update public.event_state
  set current_module = 'idle', screen_mode = 'idle', screen_payload_id = null,
      screen_payload = null, screen_pinned = false, updated_at = now()
  where event_id = p_event_id and current_module = 'mortal_kombat';

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (p_event_id, auth.uid(), 'mk_tournament_reset', jsonb_build_object(
    'registrationsRemoved', v_registrations_removed, 'matchesRemoved', v_matches_removed
  ));

  return jsonb_build_object(
    'status', 'reset', 'registrationsRemoved', v_registrations_removed, 'matchesRemoved', v_matches_removed
  );
end;
$$;

revoke all on function public.owner_open_mk_registration(uuid) from public, anon;
revoke all on function public.owner_randomize_mk_seeds(uuid) from public, anon;
revoke all on function public.owner_finalize_mk_draw(uuid) from public, anon;
revoke all on function public.owner_reset_mk_tournament(uuid, text) from public, anon;
revoke all on function public._mk_next_match(text, integer) from public, anon, authenticated;
grant execute on function public.owner_open_mk_registration(uuid) to authenticated;
grant execute on function public.owner_randomize_mk_seeds(uuid) to authenticated;
grant execute on function public.owner_finalize_mk_draw(uuid) to authenticated;
grant execute on function public.owner_reset_mk_tournament(uuid, text) to authenticated;
