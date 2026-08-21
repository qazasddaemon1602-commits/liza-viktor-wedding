begin;

create extension if not exists pgtap with schema extensions;

select plan(23);

select function_returns(
  'public', 'submit_bunker_command',
  array['text', 'text', 'uuid', 'text', 'jsonb'], 'jsonb',
  'guest devices submit authoritative Bunker V2 commands through one RPC'
);
select ok(
  has_function_privilege(
    'anon', 'public.submit_bunker_command(text,text,uuid,text,jsonb)', 'EXECUTE'
  ) and has_function_privilege(
    'authenticated', 'public.submit_bunker_command(text,text,uuid,text,jsonb)', 'EXECUTE'
  ),
  'guest command RPC is callable through both API roles'
);
select ok(
  (select prosecdef from pg_proc
   where oid = 'public.submit_bunker_command(text,text,uuid,text,jsonb)'::regprocedure)
  and coalesce(
    'search_path=""' = any((select proconfig from pg_proc
      where oid = 'public.submit_bunker_command(text,text,uuid,text,jsonb)'::regprocedure)),
    false
  ),
  'guest command RPC is SECURITY DEFINER with an empty search path'
);
select ok(
  pg_get_functiondef(
    'public.submit_bunker_command(text,text,uuid,text,jsonb)'::regprocedure
  ) ~ 'from public\.bunker_state state(.|\n)*for update;(.|\n)*from public\.bunker_mission_instances instance(.|\n)*for update;'
  and pg_get_functiondef(
    'public.submit_bunker_command(text,text,uuid,text,jsonb)'::regprocedure
  ) ~ 'from public\.bunker_mission_members member(.|\n)*for update;',
  'mission confirmation serializes concurrent contenders in global-instance-member order'
);

insert into auth.users(id)
values ('41000000-0000-4000-8000-000000000001');

insert into public.events(id, slug, name, owner_user_id, next_ticket_sequence)
values (
  '41000000-0000-4000-8000-000000000002',
  'bunker-v2-m01-m02',
  'Bunker V2 M01 M02',
  '41000000-0000-4000-8000-000000000001',
  17
);
insert into public.event_state(event_id)
values ('41000000-0000-4000-8000-000000000002');
insert into public.carriages(
  id, event_id, number, label, accent_hex, visual_mark, sort_order, enabled
)
values
  ('41000000-0000-4000-8000-000000000011', '41000000-0000-4000-8000-000000000002', 1, 'ВАГОН №1', '#111111', 'I', 1, true),
  ('41000000-0000-4000-8000-000000000012', '41000000-0000-4000-8000-000000000002', 2, 'ВАГОН №2', '#222222', 'II', 2, true);

insert into public.guests(
  id, event_id, first_name, last_name, affiliation_type, carriage_id,
  ticket_sequence, ticket_number
)
select
  ('41000000-0000-4000-9000-' || lpad(sequence::text, 12, '0'))::uuid,
  '41000000-0000-4000-8000-000000000002',
  case when sequence = 1 then 'Анна-Мария' else 'Гость' end,
  case when sequence = 1 then 'Очень-Длинная-Фамилия' else sequence::text end,
  'common',
  case when mod(sequence, 2) = 1
    then '41000000-0000-4000-8000-000000000011'::uuid
    else '41000000-0000-4000-8000-000000000012'::uuid
  end,
  sequence,
  'M01-' || lpad(sequence::text, 3, '0')
from generate_series(1, 15) registered(sequence);

insert into public.guest_device_bindings(event_id, guest_id, device_key_hash)
values
  ('41000000-0000-4000-8000-000000000002', '41000000-0000-4000-9000-000000000001', public._device_hash('m01-device-one')),
  ('41000000-0000-4000-8000-000000000002', '41000000-0000-4000-9000-000000000002', public._device_hash('m01-device-two'));

insert into public.bunker_state(event_id)
values ('41000000-0000-4000-8000-000000000002');

select set_config(
  'request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true
);
select public.owner_prepare_bunker_v2(
  '41000000-0000-4000-8000-000000000002',
  '41000000-0000-4000-8000-000000000020'
);
select public.owner_transition_bunker_v2(
  '41000000-0000-4000-8000-000000000002', 'CHARACTERS_READY',
  '41000000-0000-4000-8000-000000000021'
);
select public.owner_transition_bunker_v2(
  '41000000-0000-4000-8000-000000000002', 'MISSION_01',
  '41000000-0000-4000-8000-000000000022'
);

create temporary table bunker_m01_fixture on commit drop as
select
  run.run_nonce,
  instance.id as instance_id,
  instance.instance_version,
  (instance.definition->>'quota')::integer as quota,
  carriage.id as carriage_id
from public.bunker_game_runs run
join public.carriages carriage
  on carriage.event_id = run.event_id and carriage.number = 1
join public.bunker_mission_instances instance
  on instance.run_nonce = run.run_nonce
 and instance.mission_code = 'MISSION_01'
 and instance.scope_key = carriage.id::text
where run.event_id = '41000000-0000-4000-8000-000000000002';

create temporary table bunker_m01_selected on commit drop as
select member.guest_id
from bunker_m01_fixture fixture
join public.bunker_mission_members member on member.instance_id = fixture.instance_id
order by member.guest_id
limit 2;

select ok(
  public.get_guest_bunker_v2_runtime(
    'bunker-v2-m01-m02', 'm01-device-one'
  )#>>'{viewer,guest,realName}' = 'Анна-Мария Очень-Длинная-Фамилия'
  and not (public.get_guest_bunker_v2_runtime(
    'bunker-v2-m01-m02', 'm01-device-one'
  )->'character' ? 'hiddenTrait'),
  'the unrevealed runtime uses the registered full name and omits hidden trait'
);

create temporary table bunker_m01_late on commit drop as
select public.register_guest(
  'bunker-v2-m01-m02', 'm01-late-device',
  'Поздний', 'Пассажир', 'common', null, false
) as result;

select throws_ok(
  $$ select public.submit_bunker_command(
    'bunker-v2-m01-m02', 'm01-device-one',
    '41000000-0000-4000-8000-000000000030', 'mission_confirm',
    jsonb_build_object(
      'instanceId', (select instance_id from bunker_m01_fixture),
      'instanceVersion', 1,
      'selection', jsonb_build_array(
        (select guest_id from bunker_m01_selected order by guest_id limit 1)
      )
    )
  ) $$,
  '22023', 'M01 selection must exactly match frozen quota',
  'mission confirmation rejects a selection below the frozen quota'
);
select throws_ok(
  $$ select public.submit_bunker_command(
    'bunker-v2-m01-m02', 'm01-device-one',
    '41000000-0000-4000-8000-000000000031', 'mission_confirm',
    jsonb_build_object(
      'instanceId', (select instance_id from bunker_m01_fixture),
      'instanceVersion', 1,
      'selection', jsonb_build_array(
        (select guest_id from bunker_m01_selected order by guest_id limit 1),
        (select guest_id from bunker_m01_selected order by guest_id limit 1)
      )
    )
  ) $$,
  '22023', 'M01 selection contains duplicate guest ids',
  'mission confirmation rejects duplicate selected IDs'
);
select throws_ok(
  $$ select public.submit_bunker_command(
    'bunker-v2-m01-m02', 'm01-device-one',
    '41000000-0000-4000-8000-000000000032', 'mission_confirm',
    jsonb_build_object(
      'instanceId', (select instance_id from bunker_m01_fixture),
      'instanceVersion', 1,
      'selection', (
        select jsonb_agg(member.guest_id order by member.guest_id)
        from (
          select foreign_member.guest_id
          from public.bunker_mission_instances foreign_instance
          join public.bunker_mission_members foreign_member
            on foreign_member.instance_id = foreign_instance.id
          where foreign_instance.run_nonce = (select run_nonce from bunker_m01_fixture)
            and foreign_instance.mission_code = 'MISSION_01'
            and foreign_instance.scope_key <> (select carriage_id::text from bunker_m01_fixture)
          order by foreign_member.guest_id
          limit 2
        ) member
      )
    )
  ) $$,
  '42501', 'M01 selection must contain only frozen wagon members',
  'mission confirmation rejects IDs frozen for another wagon'
);
select throws_ok(
  $$ select public.submit_bunker_command(
    'bunker-v2-m01-m02', 'm01-device-two',
    '41000000-0000-4000-8000-000000000033', 'mission_confirm',
    jsonb_build_object(
      'instanceId', (select instance_id from bunker_m01_fixture),
      'instanceVersion', 1,
      'selection', (select jsonb_agg(guest_id order by guest_id) from bunker_m01_selected)
    )
  ) $$,
  '42501', 'M01 instance does not belong to the guest wagon',
  'a guest cannot confirm a foreign-wagon instance'
);
select throws_ok(
  $$ select public.submit_bunker_command(
    'bunker-v2-m01-m02', 'm01-late-device',
    '41000000-0000-4000-8000-000000000034', 'mission_confirm',
    jsonb_build_object(
      'instanceId', (
        select instance.id
        from public.bunker_mission_instances instance
        join public.guests guest
          on instance.scope_key = guest.carriage_id::text
        where instance.run_nonce = (select run_nonce from bunker_m01_fixture)
          and instance.mission_code = 'MISSION_01'
          and guest.id = ((select result#>>'{guest,id}' from bunker_m01_late))::uuid
      ),
      'instanceVersion', 1,
      'selection', '[]'::jsonb
    )
  ) $$,
  '42501', 'M01 confirmation requires a frozen wagon member',
  'a late guest cannot confirm the frozen wagon decision'
);
select throws_ok(
  $$ select public.submit_bunker_command(
    'bunker-v2-m01-m02', 'm01-device-one',
    '41000000-0000-4000-8000-000000000035', 'mission_confirm',
    jsonb_build_object(
      'instanceId', (select instance_id from bunker_m01_fixture),
      'instanceVersion', 1,
      'selection', jsonb_build_array(
        (select guest_id from bunker_m01_selected order by guest_id limit 1),
        ((select result#>>'{guest,id}' from bunker_m01_late))::uuid
      )
    )
  ) $$,
  '42501', 'M01 late guests cannot be selected',
  'a late guest cannot be inserted into the frozen selection'
);

create temporary table bunker_m01_confirm_result(result jsonb) on commit drop;
insert into bunker_m01_confirm_result(result)
select public.submit_bunker_command(
  'bunker-v2-m01-m02', 'm01-device-one',
  '41000000-0000-4000-8000-000000000040', 'mission_confirm',
  jsonb_build_object(
    'instanceId', (select instance_id from bunker_m01_fixture),
    'instanceVersion', 1,
    'selection', (select jsonb_agg(guest_id order by guest_id) from bunker_m01_selected)
  )
);

select is(
  (select result from bunker_m01_confirm_result),
  jsonb_build_object(
    'contractVersion', 2,
    'status', 'accepted',
    'commandId', '41000000-0000-4000-8000-000000000040'::uuid,
    'commandType', 'mission_confirm'
  ),
  'valid M01 confirmation returns the closed command receipt contract'
);
select is(
  (select count(*)::integer
   from public.bunker_mission_decisions decision
   where decision.instance_id = (select instance_id from bunker_m01_fixture)
     and decision.status = 'confirmed'),
  1,
  'M01 stores one immutable confirmed wagon decision'
);
select ok(
  (select bool_and(profile.character_status = 'excluded')
   from bunker_m01_selected selected
   join public.bunker_guest_profiles profile
     on profile.run_nonce = (select run_nonce from bunker_m01_fixture)
    and profile.guest_id = selected.guest_id),
  'selected character profiles become excluded'
);
select ok(
  (select bool_and(profile.character_status = 'saved')
   from public.bunker_mission_members member
   join public.bunker_guest_profiles profile
     on profile.run_nonce = member.run_nonce and profile.guest_id = member.guest_id
   where member.instance_id = (select instance_id from bunker_m01_fixture)
     and not exists (select 1 from bunker_m01_selected selected
                     where selected.guest_id = member.guest_id)),
  'remaining frozen member profiles become saved'
);
select ok(
  (select count(*) = 8 and bool_and(profile.hidden_trait_revealed)
   from public.bunker_mission_members member
   join public.bunker_guest_profiles profile
     on profile.run_nonce = member.run_nonce and profile.guest_id = member.guest_id
   where member.instance_id = (select instance_id from bunker_m01_fixture)),
  'confirmation reveals hidden traits for every frozen wagon member'
);
select ok(
  public.get_guest_bunker_v2_runtime(
    'bunker-v2-m01-m02', 'm01-device-one'
  )->>'status' = 'active'
  and public.get_guest_bunker_v2_runtime(
    'bunker-v2-m01-m02', 'm01-device-one'
  )#>>'{viewer,guest,realName}' = 'Анна-Мария Очень-Длинная-Фамилия'
  and public.get_guest_bunker_v2_runtime(
    'bunker-v2-m01-m02', 'm01-device-one'
  )->'character' ? 'hiddenTrait',
  'an excluded profile leaves the registered guest active with its real name and revealed trait'
);
select ok(
  (select profile.character_status = 'saved'
      and not profile.hidden_trait_revealed
   from bunker_m01_late late
   join public.bunker_guest_profiles profile
     on profile.run_nonce = (select run_nonce from bunker_m01_fixture)
    and profile.guest_id = (late.result#>>'{guest,id}')::uuid),
  'late guest profile stays saved and outside the frozen reveal'
);
select ok(
  (select instance.status = 'completed'
      and instance.completed_at is not null
      and instance.outcome = decision.outcome
      and instance.outcome->'selectedGuestIds'
        = (select jsonb_agg(guest_id order by guest_id) from bunker_m01_selected)
   from public.bunker_mission_instances instance
   join public.bunker_mission_decisions decision
     on decision.instance_id = instance.id and decision.status = 'confirmed'
   where instance.id = (select instance_id from bunker_m01_fixture)),
  'mission and decision persist one immutable canonical outcome'
);
select is(
  (select count(*)::integer
   from public.bunker_game_events game_event
   where game_event.instance_id = (select instance_id from bunker_m01_fixture)
     and game_event.command_id = '41000000-0000-4000-8000-000000000040'
     and game_event.event_type in ('decision_confirmed', 'mission_completed')),
  2,
  'decision_confirmed and mission_completed are appended by the confirmation transaction'
);
select is(
  public.submit_bunker_command(
    'bunker-v2-m01-m02', 'm01-device-one',
    '41000000-0000-4000-8000-000000000040', 'mission_confirm',
    jsonb_build_object(
      'instanceId', (select instance_id from bunker_m01_fixture),
      'instanceVersion', 1,
      'selection', (select jsonb_agg(guest_id order by guest_id) from bunker_m01_selected)
    )
  ),
  (select result from bunker_m01_confirm_result),
  'an exact command retry returns the original result idempotently'
);
select throws_ok(
  $$ select public.submit_bunker_command(
    'bunker-v2-m01-m02', 'm01-device-one',
    '41000000-0000-4000-8000-000000000040', 'mission_confirm',
    jsonb_build_object(
      'instanceId', (select instance_id from bunker_m01_fixture),
      'instanceVersion', 1,
      'selection', jsonb_build_array(
        (select guest_id from bunker_m01_selected order by guest_id limit 1)
      )
    )
  ) $$,
  '55000', 'idempotency_conflict',
  'the same command ID rejects a different request hash'
);
select throws_ok(
  $$ select public.submit_bunker_command(
    'bunker-v2-m01-m02', 'm01-device-one',
    '41000000-0000-4000-8000-000000000041', 'mission_confirm',
    jsonb_build_object(
      'instanceId', (select instance_id from bunker_m01_fixture),
      'instanceVersion', 1,
      'selection', (select jsonb_agg(guest_id order by guest_id) from bunker_m01_selected)
    )
  ) $$,
  '55000', 'M01 decision is already confirmed',
  'a duplicate or concurrent contender cannot replace the completed decision'
);

select * from finish();
rollback;
