-- Rehearsal seeding must preserve real registrations. The requested count is
-- the TOTAL rehearsal size (real + synthetic), not the number of synthetic rows.

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
  v_seq bigint;
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

  -- Old synthetic rows are replaceable; real wedding registrations are not.
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

  -- Rebalance only carriage assignment for rehearsal. Guest identity, answers,
  -- device bindings and all other registration data stay untouched.
  with ranked as (
    select
      g.id,
      row_number() over (
        order by coalesce(g.ticket_sequence, 2147483647), g.registered_at, g.id
      ) as rn
    from public.guests g
    where g.event_id = p_event_id
      and coalesce(g.affiliation_detail, '') <> '__BUNKER_TEST__'
  ), assigned as (
    select
      ranked.id,
      c.id as carriage_id
    from ranked
    join public.carriages c
      on c.event_id = p_event_id
     and c.number = 1 + mod((ranked.rn - 1)::integer, v_wagons)
  )
  update public.guests g
  set carriage_id = assigned.carriage_id
  from assigned
  where g.id = assigned.id;

  select coalesce(max(g.ticket_sequence), 0) + 1
  into v_seq
  from public.guests g
  where g.event_id = p_event_id;

  for v_i in 1..v_test_count loop
    select c.id into v_carriage
    from public.carriages c
    where c.event_id = p_event_id
      and c.number = 1 + mod(v_real + v_i - 1, v_wagons);

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
      v_seq,
      'TST-' || lpad(v_i::text, 3, '0')
    );
    v_seq := v_seq + 1;
  end loop;

  update public.events
  set composition_locked = true,
      registration_open = true,
      next_ticket_sequence = v_seq
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

-- One-button safety net: if the organiser presses "prepare test game" while
-- fewer than 15 real guests are registered, top the rehearsal up to 15 first.
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
begin
  perform public._require_bunker_owner(p_event_id);

  select count(*)::integer into v_guest_count
  from public.guests g
  where g.event_id = p_event_id;

  if v_guest_count < 15 then
    perform public.owner_bunker_v2_seed_test_guests(p_event_id, 15);
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
