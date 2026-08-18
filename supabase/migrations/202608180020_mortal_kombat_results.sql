create or replace function public._mk_next_match(
  p_round text,
  p_position integer
)
returns table(next_round text, next_position integer, next_slot text)
language sql
immutable
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

create or replace function public.owner_set_current_mk_match(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.mk_matches%rowtype;
  v_event_id uuid;
  v_tournament_state text;
begin
  select m, t.event_id, t.state
  into v_match, v_event_id, v_tournament_state
  from public.mk_matches m
  join public.mk_tournaments t on t.id=m.tournament_id
  where m.id=p_match_id;

  if v_match.id is null then
    raise exception 'MK match not found' using errcode='P0002';
  end if;
  perform public._require_mk_owner(v_event_id);

  if v_tournament_state <> 'active' then
    raise exception 'MK tournament is not active' using errcode='55000';
  end if;
  if v_match.player1_guest_id is null or v_match.player2_guest_id is null then
    raise exception 'MK match is not ready' using errcode='55000';
  end if;

  update public.mk_tournaments
  set current_match_id=p_match_id, updated_at=now()
  where id=v_match.tournament_id;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (v_event_id, auth.uid(), 'mk_current_match_set', jsonb_build_object('matchId', p_match_id, 'matchKey', v_match.match_key));

  return jsonb_build_object('status', 'current', 'matchId', p_match_id, 'matchKey', v_match.match_key);
end;
$$;

create or replace function public.owner_record_mk_winner(
  p_match_id uuid,
  p_winner_guest_id uuid,
  clear_completed_downstream boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.mk_matches%rowtype;
  v_next public.mk_matches%rowtype;
  v_event_id uuid;
  v_tournament_state text;
  v_round text;
  v_position integer;
  v_next_round text;
  v_next_position integer;
  v_next_slot text;
  v_affected jsonb := '[]'::jsonb;
  v_affected_count integer := 0;
begin
  select m, t.event_id, t.state
  into v_match, v_event_id, v_tournament_state
  from public.mk_matches m
  join public.mk_tournaments t on t.id=m.tournament_id
  where m.id=p_match_id
  for update of m;

  if v_match.id is null then
    raise exception 'MK match not found' using errcode='P0002';
  end if;
  perform public._require_mk_owner(v_event_id);

  if v_tournament_state not in ('active', 'complete') then
    raise exception 'MK tournament is not active' using errcode='55000';
  end if;
  if p_winner_guest_id is distinct from v_match.player1_guest_id
     and p_winner_guest_id is distinct from v_match.player2_guest_id then
    raise exception 'winner must be one of the current match players' using errcode='22023';
  end if;
  if v_match.player1_guest_id is null or v_match.player2_guest_id is null then
    raise exception 'MK match is not ready' using errcode='55000';
  end if;

  -- First pass: inspect completed matches in this branch without mutating anything.
  v_round := v_match.round;
  v_position := v_match.position;
  loop
    select x.next_round, x.next_position, x.next_slot
    into v_next_round, v_next_position, v_next_slot
    from public._mk_next_match(v_round, v_position) x;
    exit when v_next_round is null;

    select m.* into v_next
    from public.mk_matches m
    where m.tournament_id=v_match.tournament_id
      and m.round=v_next_round
      and m.position=v_next_position;

    if v_next.winner_guest_id is not null then
      v_affected := v_affected || jsonb_build_array(jsonb_build_object(
        'matchId', v_next.id,
        'matchKey', v_next.match_key,
        'round', v_next.round,
        'position', v_next.position
      ));
      v_affected_count := v_affected_count + 1;
    end if;

    v_round := v_next_round;
    v_position := v_next_position;
  end loop;

  if v_affected_count > 0 and not clear_completed_downstream then
    return jsonb_build_object(
      'status', 'impact',
      'matchId', p_match_id,
      'affectedMatches', v_affected
    );
  end if;

  -- Second pass: clear only this downstream branch so stale players/results cannot survive correction.
  v_round := v_match.round;
  v_position := v_match.position;
  loop
    select x.next_round, x.next_position, x.next_slot
    into v_next_round, v_next_position, v_next_slot
    from public._mk_next_match(v_round, v_position) x;
    exit when v_next_round is null;

    if v_next_slot = 'player1' then
      update public.mk_matches
      set player1_guest_id=null,
          winner_guest_id=null,
          status='pending',
          updated_at=now()
      where tournament_id=v_match.tournament_id
        and round=v_next_round
        and position=v_next_position;
    else
      update public.mk_matches
      set player2_guest_id=null,
          winner_guest_id=null,
          status='pending',
          updated_at=now()
      where tournament_id=v_match.tournament_id
        and round=v_next_round
        and position=v_next_position;
    end if;

    v_round := v_next_round;
    v_position := v_next_position;
  end loop;

  update public.mk_matches
  set winner_guest_id=p_winner_guest_id,
      status='complete',
      updated_at=now()
  where id=p_match_id;

  if v_match.round = 'final' then
    update public.mk_tournaments
    set champion_guest_id=p_winner_guest_id,
        state='complete',
        current_match_id=p_match_id,
        updated_at=now()
    where id=v_match.tournament_id;
  else
    select x.next_round, x.next_position, x.next_slot
    into v_next_round, v_next_position, v_next_slot
    from public._mk_next_match(v_match.round, v_match.position) x;

    if v_next_slot = 'player1' then
      update public.mk_matches
      set player1_guest_id=p_winner_guest_id,
          status=case when player2_guest_id is not null then 'ready' else 'pending' end,
          updated_at=now()
      where tournament_id=v_match.tournament_id
        and round=v_next_round
        and position=v_next_position;
    else
      update public.mk_matches
      set player2_guest_id=p_winner_guest_id,
          status=case when player1_guest_id is not null then 'ready' else 'pending' end,
          updated_at=now()
      where tournament_id=v_match.tournament_id
        and round=v_next_round
        and position=v_next_position;
    end if;

    update public.mk_tournaments
    set champion_guest_id=null,
        state='active',
        current_match_id=p_match_id,
        updated_at=now()
    where id=v_match.tournament_id;
  end if;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    v_event_id,
    auth.uid(),
    'mk_winner_recorded',
    jsonb_build_object(
      'matchId', p_match_id,
      'matchKey', v_match.match_key,
      'winnerGuestId', p_winner_guest_id,
      'clearedCompletedDownstream', clear_completed_downstream,
      'affectedMatches', v_affected
    )
  );

  return jsonb_build_object(
    'status', case when v_match.round='final' then 'champion' else 'recorded' end,
    'matchId', p_match_id,
    'winnerGuestId', p_winner_guest_id,
    'affectedMatches', v_affected
  );
end;
$$;

create or replace function public.owner_undo_mk_result(
  p_match_id uuid,
  clear_completed_downstream boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.mk_matches%rowtype;
  v_next public.mk_matches%rowtype;
  v_event_id uuid;
  v_round text;
  v_position integer;
  v_next_round text;
  v_next_position integer;
  v_next_slot text;
  v_affected jsonb := '[]'::jsonb;
  v_affected_count integer := 0;
begin
  select m, t.event_id
  into v_match, v_event_id
  from public.mk_matches m
  join public.mk_tournaments t on t.id=m.tournament_id
  where m.id=p_match_id
  for update of m;

  if v_match.id is null then
    raise exception 'MK match not found' using errcode='P0002';
  end if;
  perform public._require_mk_owner(v_event_id);

  if v_match.winner_guest_id is null then
    return jsonb_build_object('status', 'unchanged', 'matchId', p_match_id);
  end if;

  v_round := v_match.round;
  v_position := v_match.position;
  loop
    select x.next_round, x.next_position, x.next_slot
    into v_next_round, v_next_position, v_next_slot
    from public._mk_next_match(v_round, v_position) x;
    exit when v_next_round is null;

    select m.* into v_next
    from public.mk_matches m
    where m.tournament_id=v_match.tournament_id
      and m.round=v_next_round
      and m.position=v_next_position;

    if v_next.winner_guest_id is not null then
      v_affected := v_affected || jsonb_build_array(jsonb_build_object(
        'matchId', v_next.id,
        'matchKey', v_next.match_key,
        'round', v_next.round,
        'position', v_next.position
      ));
      v_affected_count := v_affected_count + 1;
    end if;
    v_round := v_next_round;
    v_position := v_next_position;
  end loop;

  if v_affected_count > 0 and not clear_completed_downstream then
    return jsonb_build_object('status', 'impact', 'matchId', p_match_id, 'affectedMatches', v_affected);
  end if;

  v_round := v_match.round;
  v_position := v_match.position;
  loop
    select x.next_round, x.next_position, x.next_slot
    into v_next_round, v_next_position, v_next_slot
    from public._mk_next_match(v_round, v_position) x;
    exit when v_next_round is null;

    if v_next_slot='player1' then
      update public.mk_matches
      set player1_guest_id=null, winner_guest_id=null, status='pending', updated_at=now()
      where tournament_id=v_match.tournament_id and round=v_next_round and position=v_next_position;
    else
      update public.mk_matches
      set player2_guest_id=null, winner_guest_id=null, status='pending', updated_at=now()
      where tournament_id=v_match.tournament_id and round=v_next_round and position=v_next_position;
    end if;

    v_round := v_next_round;
    v_position := v_next_position;
  end loop;

  update public.mk_matches
  set winner_guest_id = null,
      status=case when player1_guest_id is not null and player2_guest_id is not null then 'ready' else 'pending' end,
      updated_at=now()
  where id=p_match_id;

  update public.mk_tournaments
  set champion_guest_id=null,
      state='active',
      current_match_id=p_match_id,
      updated_at=now()
  where id=v_match.tournament_id;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    v_event_id,
    auth.uid(),
    'mk_result_undone',
    jsonb_build_object(
      'matchId', p_match_id,
      'matchKey', v_match.match_key,
      'clearedCompletedDownstream', clear_completed_downstream,
      'affectedMatches', v_affected
    )
  );

  return jsonb_build_object('status', 'undone', 'matchId', p_match_id, 'affectedMatches', v_affected);
end;
$$;

revoke all on function public._mk_next_match(text, integer) from public, anon, authenticated;
revoke all on function public.owner_set_current_mk_match(uuid) from public, anon;
revoke all on function public.owner_record_mk_winner(uuid, uuid, boolean) from public, anon;
revoke all on function public.owner_undo_mk_result(uuid, boolean) from public, anon;

grant execute on function public.owner_set_current_mk_match(uuid) to authenticated;
grant execute on function public.owner_record_mk_winner(uuid, uuid, boolean) to authenticated;
grant execute on function public.owner_undo_mk_result(uuid, boolean) to authenticated;
