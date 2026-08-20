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
  v_distinct_seeds integer := 0;
  v_position integer;
  v_seed_order integer[] := array[1,16,8,9,5,12,4,13,6,11,3,14,7,10,2,15];
  v_seed1 integer;
  v_seed2 integer;
  v_player1 uuid;
  v_player2 uuid;
  v_winner uuid;
  v_status text;
  v_source1 public.mk_matches%rowtype;
  v_source2 public.mk_matches%rowtype;
  v_source_round text;
  v_round text;
  v_round_count integer;
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

  if v_count < 2 or v_count > 16 then
    raise exception 'between 2 and 16 active players required' using errcode = '55000';
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

  delete from public.mk_matches
  where tournament_id = v_tournament.id;

  -- Keep the stable 16-slot tree internally. Missing seeds are byes.
  for v_position in 1..8 loop
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
      v_tournament.id, 'r16-' || v_position, 'r16', v_position,
      v_player1, v_player2, v_winner, v_status
    );
  end loop;

  -- Derive every later round from the two upstream branches. A branch is a
  -- true bye only when BOTH upstream matches are already settled.
  foreach v_round in array array['qf','sf','final'] loop
    if v_round = 'qf' then
      v_source_round := 'r16';
      v_round_count := 4;
    elsif v_round = 'sf' then
      v_source_round := 'qf';
      v_round_count := 2;
    else
      v_source_round := 'sf';
      v_round_count := 1;
    end if;

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

  -- With 2..16 standard-seeded players the final cannot be auto-complete.
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
      'internalMatches', 15
    )
  );

  return jsonb_build_object(
    'status', 'active',
    'players', v_count,
    'fights', v_count - 1,
    'matches', 15
  );
end;
$$;

revoke all on function public.owner_finalize_mk_draw(uuid) from public, anon;
grant execute on function public.owner_finalize_mk_draw(uuid) to authenticated;
