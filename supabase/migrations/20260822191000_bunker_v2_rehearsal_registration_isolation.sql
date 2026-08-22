-- Keep rehearsal-only synthetic passengers isolated from real wedding registration.
-- Test rows may share public.guests so the V2 planner can exercise the real path,
-- but they must not consume real capacity, skew real wagon allocation, or advance
-- the real ticket sequence.

create or replace function public.register_guest(
  p_event_slug text,
  p_device_key text,
  p_first_name text,
  p_last_name text,
  p_affiliation_type text,
  p_affiliation_detail text default null,
  p_confirm_duplicate boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_hash text;
  v_existing_guest_id uuid;
  v_duplicate_guest_id uuid;
  v_carriage_id uuid;
  v_ticket_sequence bigint;
  v_ticket_number text;
  v_guest_id uuid;
  v_guest_count integer;
  v_first_name text := public._normalize_spaces(p_first_name);
  v_last_name text := public._normalize_spaces(p_last_name);
  v_detail text := nullif(public._normalize_spaces(p_affiliation_detail), '');
begin
  if length(coalesce(p_device_key, '')) < 8 then
    raise exception 'invalid device key' using errcode = '22023';
  end if;
  if v_first_name = '' then
    raise exception 'first name is required' using errcode = '22023';
  end if;
  if v_last_name = '' then
    raise exception 'last name is required' using errcode = '22023';
  end if;
  if p_affiliation_type not in ('liza', 'viktor', 'common', 'family', 'colleagues', 'other') then
    raise exception 'invalid affiliation type' using errcode = '22023';
  end if;

  select * into v_event
  from public.events
  where slug = public._normalize_spaces(p_event_slug)
  for update;

  if v_event.id is null then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  v_hash := public._device_hash(p_device_key);

  select guest_id into v_existing_guest_id
  from public.guest_device_bindings
  where event_id = v_event.id and device_key_hash = v_hash;

  if v_existing_guest_id is not null then
    update public.guests set last_seen_at = now() where id = v_existing_guest_id;
    return jsonb_build_object(
      'status', 'restored',
      'guest', public._guest_profile_json(v_existing_guest_id)
    );
  end if;

  if not v_event.registration_open then
    raise exception 'registration is closed' using errcode = '55000';
  end if;

  -- Rehearsal passengers are capacity-neutral. Only genuine registrations count
  -- against expected_guest_count and the hard forty-real-guest ceiling.
  select count(*)::integer into v_guest_count
  from public.guests
  where event_id = v_event.id
    and coalesce(affiliation_detail, '') <> '__BUNKER_TEST__';

  if v_guest_count >= least(v_event.expected_guest_count, 40) then
    raise exception 'registration capacity reached' using errcode = '55000';
  end if;

  if not p_confirm_duplicate then
    select id into v_duplicate_guest_id
    from public.guests
    where event_id = v_event.id
      and coalesce(affiliation_detail, '') <> '__BUNKER_TEST__'
      and lower(first_name) = lower(v_first_name)
      and lower(last_name) = lower(v_last_name)
    limit 1;

    if v_duplicate_guest_id is not null then
      return jsonb_build_object(
        'status', 'duplicate_warning',
        'publicName', v_first_name || ' ' || upper(left(v_last_name, 1)) || '.'
      );
    end if;
  end if;

  -- Synthetic rehearsal rows must not influence which wagon a real guest gets.
  select c.id into v_carriage_id
  from public.carriages c
  left join public.guests g
    on g.carriage_id = c.id
   and g.event_id = v_event.id
   and coalesce(g.affiliation_detail, '') <> '__BUNKER_TEST__'
  where c.event_id = v_event.id and c.enabled
  group by c.id, c.sort_order
  order by
    count(g.id) asc,
    count(g.id) filter (where g.affiliation_type = p_affiliation_type) asc,
    random()
  limit 1;

  if v_carriage_id is null then
    raise exception 'no enabled carriages available' using errcode = '55000';
  end if;

  v_ticket_sequence := v_event.next_ticket_sequence;
  update public.events
  set next_ticket_sequence = next_ticket_sequence + 1
  where id = v_event.id;

  v_ticket_number := 'LV-' || lpad(v_ticket_sequence::text, 3, '0');

  insert into public.guests(
    event_id,
    first_name,
    last_name,
    affiliation_type,
    affiliation_detail,
    carriage_id,
    ticket_sequence,
    ticket_number
  )
  values (
    v_event.id,
    v_first_name,
    v_last_name,
    p_affiliation_type,
    v_detail,
    v_carriage_id,
    v_ticket_sequence,
    v_ticket_number
  )
  returning id into v_guest_id;

  insert into public.guest_device_bindings(event_id, guest_id, device_key_hash)
  values (v_event.id, v_guest_id, v_hash);

  return jsonb_build_object(
    'status', 'registered',
    'guest', public._guest_profile_json(v_guest_id)
  );
end;
$$;

revoke all on function public.register_guest(
  text, text, text, text, text, text, boolean
) from public;
grant execute on function public.register_guest(
  text, text, text, text, text, text, boolean
) to anon, authenticated;

create or replace function public.owner_bunker_v2_seed_test_guests(
  p_event_id uuid,
  p_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.bunker_state%rowtype;
  v_real integer := 0;
  v_test_count integer := 0;
  v_wagons integer;
  v_i integer;
  v_carriage uuid;
begin
  perform public._require_bunker_owner(p_event_id);

  if p_count < 15 or p_count > 40 then
    raise exception 'test guest count must be 15..40' using errcode = '22023';
  end if;

  perform 1 from public.events e where e.id = p_event_id for update;
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  insert into public.bunker_state(event_id)
  values (p_event_id)
  on conflict (event_id) do nothing;

  select s.* into v_state
  from public.bunker_state s
  where s.event_id = p_event_id
  for update;

  if v_state.run_nonce is not null then
    raise exception 'reset Bunker progress before reseeding rehearsal guests'
      using errcode = '55000';
  end if;

  delete from public.guests g
  where g.event_id = p_event_id
    and coalesce(g.affiliation_detail, '') = '__BUNKER_TEST__';

  select count(*)::integer into v_real
  from public.guests g
  where g.event_id = p_event_id
    and coalesce(g.affiliation_detail, '') <> '__BUNKER_TEST__';

  if v_real > p_count then
    raise exception 'registered guests already exceed requested rehearsal size (%)', p_count
      using errcode = '55000';
  end if;

  v_test_count := p_count - v_real;
  v_wagons := case
    when p_count <= 18 then 2
    when p_count <= 26 then 3
    when p_count <= 36 then 4
    else 5
  end;

  update public.carriages
  set enabled = number <= v_wagons
  where event_id = p_event_id;

  -- Preserve every valid real carriage assignment. Repair only unassigned,
  -- foreign, or now-disabled real assignments.
  with misplaced as (
    select
      g.id,
      row_number() over (
        order by coalesce(g.ticket_sequence, 2147483647), g.registered_at, g.id
      ) as rn
    from public.guests g
    left join public.carriages current_carriage
      on current_carriage.id = g.carriage_id
    where g.event_id = p_event_id
      and coalesce(g.affiliation_detail, '') <> '__BUNKER_TEST__'
      and (
        current_carriage.id is null
        or current_carriage.event_id <> p_event_id
        or current_carriage.number > v_wagons
      )
  ), assigned as (
    select
      misplaced.id,
      target.id as carriage_id
    from misplaced
    join public.carriages target
      on target.event_id = p_event_id
     and target.number = 1 + mod((misplaced.rn - 1)::integer, v_wagons)
  )
  update public.guests g
  set carriage_id = assigned.carriage_id
  from assigned
  where g.id = assigned.id;

  for v_i in 1..v_test_count loop
    select target.id
    into v_carriage
    from public.carriages target
    left join public.guests existing_guest
      on existing_guest.event_id = p_event_id
     and existing_guest.carriage_id = target.id
    where target.event_id = p_event_id
      and target.enabled
    group by target.id, target.number
    order by count(existing_guest.id), target.number
    limit 1;

    if v_carriage is null then
      raise exception 'active rehearsal wagon not found' using errcode = '55000';
    end if;

    insert into public.guests(
      event_id,
      first_name,
      last_name,
      affiliation_type,
      affiliation_detail,
      carriage_id,
      ticket_sequence,
      ticket_number
    ) values (
      p_event_id,
      'Тест ' || lpad(v_i::text, 2, '0'),
      'Пассажир',
      'common',
      '__BUNKER_TEST__',
      v_carriage,
      900000000 + v_i,
      'TST-' || lpad(v_i::text, 3, '0')
    );
  end loop;

  -- Rehearsal composition may open registration for continued testing, but it
  -- never owns the real ticket counter.
  update public.events
  set composition_locked = true,
      registration_open = true
  where id = p_event_id;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    p_event_id,
    auth.uid(),
    'bunker_test_guests_seeded',
    jsonb_build_object(
      'guestCount', p_count,
      'realGuestCount', v_real,
      'testGuestCount', v_test_count,
      'wagonCount', v_wagons
    )
  );

  return jsonb_build_object(
    'status', 'seeded',
    'guestCount', p_count,
    'realGuestCount', v_real,
    'testGuestCount', v_test_count,
    'wagonCount', v_wagons
  );
end;
$$;

revoke all on function public.owner_bunker_v2_seed_test_guests(uuid,integer)
  from public, anon, authenticated;
grant execute on function public.owner_bunker_v2_seed_test_guests(uuid,integer)
  to authenticated;

create or replace function public.owner_prepare_bunker_v2_test(
  p_event_id uuid,
  p_command_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_run uuid;
  v_guest_count integer;
  v_real_guest_count integer;
begin
  perform public._require_bunker_owner(p_event_id);

  select
    count(*)::integer,
    count(*) filter (
      where coalesce(g.affiliation_detail, '') <> '__BUNKER_TEST__'
    )::integer
  into v_guest_count, v_real_guest_count
  from public.guests g
  where g.event_id = p_event_id;

  if v_real_guest_count > 40 then
    raise exception 'real guest count exceeds Bunker V2 capacity'
      using errcode = '55000';
  end if;

  if v_guest_count < 15 then
    perform public.owner_bunker_v2_seed_test_guests(p_event_id, 15);
  elsif v_guest_count > 40 then
    -- A real guest can register after an earlier rehearsal roster was seeded.
    -- Normalize synthetic rows back to a valid total before preparing a new run.
    perform public.owner_bunker_v2_seed_test_guests(p_event_id, 40);
  end if;

  v_result := public.owner_prepare_bunker_v2(p_event_id, p_command_id);

  select s.run_nonce into v_run
  from public.bunker_state s
  where s.event_id = p_event_id
  for update;

  update public.bunker_state
  set game_mode = 'test',
      updated_at = now()
  where event_id = p_event_id;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    p_event_id,
    auth.uid(),
    'bunker_test_run_prepared',
    jsonb_build_object('runNonce', v_run)
  );

  return v_result || jsonb_build_object('gameMode', 'test');
end;
$$;

revoke all on function public.owner_prepare_bunker_v2_test(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.owner_prepare_bunker_v2_test(uuid,uuid)
  to authenticated;

create or replace function public.get_owner_bunker_v2_test_state(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_state public.bunker_state%rowtype;
  v_guests integer;
  v_real_guests integer;
  v_wagons integer;
begin
  perform public._require_bunker_owner(p_event_id);

  select s.* into v_state
  from public.bunker_state s
  where s.event_id = p_event_id;

  select
    count(*)::integer,
    count(*) filter (
      where coalesce(g.affiliation_detail, '') <> '__BUNKER_TEST__'
    )::integer
  into v_guests, v_real_guests
  from public.guests g
  where g.event_id = p_event_id;

  select count(*)::integer into v_wagons
  from public.carriages c
  where c.event_id = p_event_id and c.enabled;

  return jsonb_build_object(
    'gameMode', case when v_state.run_nonce is null then 'idle' else v_state.game_mode end,
    'globalState', case when v_state.run_nonce is null then null else v_state.global_game_state end,
    'runActive', v_state.run_nonce is not null,
    'guestCount', coalesce(v_guests, 0),
    'realGuestCount', coalesce(v_real_guests, 0),
    'wagonCount', coalesce(v_wagons, 0)
  );
end;
$$;

revoke all on function public.get_owner_bunker_v2_test_state(uuid)
  from public, anon, authenticated;
grant execute on function public.get_owner_bunker_v2_test_state(uuid)
  to authenticated;