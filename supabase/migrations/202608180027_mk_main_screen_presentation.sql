create or replace function public.owner_set_mk_main_screen(
  p_event_id uuid,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state text;
begin
  perform public._require_mk_owner(p_event_id);

  select t.state into v_state
  from public.mk_tournaments t
  where t.event_id = p_event_id;

  if v_state is null then
    raise exception 'MK tournament not found' using errcode = 'P0002';
  end if;

  if p_enabled and exists (
    select 1
    from public.bunker_state b
    where b.event_id = p_event_id and b.status = 'active'
  ) then
    raise exception 'Bunker emergency owns the shared projector' using errcode = '55000';
  end if;

  if p_enabled and exists (
    select 1
    from public.premiere_state p
    where p.event_id = p_event_id
      and p.status in ('standby', 'countdown', 'playing', 'paused', 'black')
  ) then
    raise exception 'Premiere owns the shared projector' using errcode = '55000';
  end if;

  if p_enabled then
    update public.event_state
    set current_module = 'mortal_kombat',
        screen_mode = 'mortal_kombat',
        screen_pinned = true,
        updated_at = now()
    where event_id = p_event_id;
  else
    update public.event_state
    set current_module = 'idle',
        screen_mode = 'idle',
        screen_payload_id = null,
        screen_payload = null,
        screen_pinned = false,
        updated_at = now()
    where event_id = p_event_id
      and current_module = 'mortal_kombat';
  end if;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    p_event_id,
    auth.uid(),
    case when p_enabled then 'mk_main_screen_shown' else 'mk_main_screen_hidden' end,
    jsonb_build_object('enabled', p_enabled)
  );

  return jsonb_build_object(
    'status', 'ok',
    'enabled', p_enabled
  );
end;
$$;

revoke all on function public.owner_set_mk_main_screen(uuid, boolean) from public, anon;
grant execute on function public.owner_set_mk_main_screen(uuid, boolean) to authenticated;

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
    'championGuestId', v_tournament.champion_guest_id,
    'presentOnMainScreen', v_present_on_main_screen
  );
end;
$$;

revoke all on function public.get_mk_tournament_state(text, text) from public;
grant execute on function public.get_mk_tournament_state(text, text) to anon, authenticated;
