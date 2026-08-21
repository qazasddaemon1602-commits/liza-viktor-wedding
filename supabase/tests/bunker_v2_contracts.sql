begin;

create extension if not exists pgtap with schema extensions;

select plan(55);

select has_column(
  'public', 'bunker_game_runs', 'contract_version',
  'runs declare their runtime contract version'
);
select has_column(
  'public', 'bunker_game_runs', 'plan_version',
  'V2 runs declare their immutable plan version'
);

select has_table('public', 'bunker_mission_instances', 'V2 mission instances exist');
select has_table('public', 'bunker_mission_members', 'V2 frozen mission members exist');
select has_table('public', 'bunker_mission_decisions', 'V2 decisions exist');
select has_table('public', 'bunker_ability_uses', 'V2 ability use proofs exist');
select has_table('public', 'bunker_inventory_transfers', 'V2 inventory transfers exist');
select has_table('public', 'bunker_archive_entitlements', 'V2 archive entitlements exist');
select has_table('public', 'bunker_final_parameters', 'V2 final parameters exist');
select has_table('public', 'bunker_command_receipts', 'V2 command receipts exist');

select has_column('public', 'bunker_game_events', 'sequence');
select has_column('public', 'bunker_game_events', 'command_id');
select has_column('public', 'bunker_game_events', 'instance_id');
select has_column('public', 'bunker_game_events', 'actor_id');
select has_column('public', 'bunker_game_events', 'correlation_id');
select has_column('public', 'bunker_game_events', 'schema_version');

select function_returns(
  'public', '_bunker_v2_plan', array['uuid', 'uuid'], 'jsonb',
  'the frozen V2 plan builder returns JSON'
);
select function_returns(
  'public', 'owner_prepare_bunker_v2', array['uuid', 'uuid'], 'jsonb',
  'the owner prepares one V2 run through a command RPC'
);
select function_returns(
  'public', 'owner_transition_bunker_v2', array['uuid', 'text', 'uuid'], 'jsonb',
  'the owner advances the V2 state machine through a command RPC'
);

select ok(
  (
    select bool_and(class.relrowsecurity)
    from pg_class class
    join pg_namespace namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relname = any(array[
        'bunker_mission_instances', 'bunker_mission_members',
        'bunker_mission_decisions', 'bunker_ability_uses',
        'bunker_inventory_transfers', 'bunker_archive_entitlements',
        'bunker_final_parameters', 'bunker_command_receipts'
      ])
  ),
  'RLS is enabled on every V2 projection table'
);
select is(
  (
    select count(*)::integer
    from (values
      ('bunker_mission_instances'), ('bunker_mission_members'),
      ('bunker_mission_decisions'), ('bunker_ability_uses'),
      ('bunker_inventory_transfers'), ('bunker_archive_entitlements'),
      ('bunker_final_parameters'), ('bunker_command_receipts')
    ) as tables(table_name)
    cross join (values ('anon'), ('authenticated')) as roles(role_name)
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) as privileges(privilege_name)
    where has_table_privilege(
      roles.role_name,
      format('public.%I', tables.table_name),
      privileges.privilege_name
    )
  ),
  0,
  'API roles have no direct DML privileges on V2 projection tables'
);

select ok(
  not has_function_privilege(
    'anon', 'public.owner_prepare_bunker_v2(uuid,uuid)', 'EXECUTE'
  ),
  'anonymous guests cannot prepare V2 runs'
);
select ok(
  has_function_privilege(
    'authenticated', 'public.owner_prepare_bunker_v2(uuid,uuid)', 'EXECUTE'
  ),
  'authenticated owner sessions can invoke guarded V2 preparation'
);
select ok(
  not has_function_privilege(
    'anon', 'public.owner_transition_bunker_v2(uuid,text,uuid)', 'EXECUTE'
  ),
  'anonymous guests cannot transition V2 runs'
);
select ok(
  has_function_privilege(
    'authenticated', 'public.owner_transition_bunker_v2(uuid,text,uuid)', 'EXECUTE'
  ),
  'authenticated owner sessions can invoke guarded V2 transitions'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public._bunker_v2_plan(uuid,uuid)', 'EXECUTE'
  ),
  'clients cannot invoke the internal V2 plan builder directly'
);
select is(
  (
    select count(*)::integer
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = any(array[
        '_bunker_v2_plan', 'owner_prepare_bunker_v2',
        'owner_transition_bunker_v2'
      ])
      and not ('search_path=""' = any(procedure.proconfig))
  ),
  0,
  'every V2 function has an immutable empty search path'
);

insert into auth.users(id)
values ('00000000-0000-4000-8000-000000000901');

insert into public.events(id, slug, name, owner_user_id)
values (
  '00000000-0000-4000-8000-000000000902',
  'bunker-v2-contracts',
  'Bunker V2 contracts',
  '00000000-0000-4000-8000-000000000901'
);

insert into public.event_state(event_id)
values ('00000000-0000-4000-8000-000000000902');

insert into public.carriages(
  id, event_id, number, label, accent_hex, visual_mark, sort_order, enabled
)
values
  ('00000000-0000-4000-8000-000000000921', '00000000-0000-4000-8000-000000000902', 1, 'ВАГОН №1', '#111111', 'I', 1, true),
  ('00000000-0000-4000-8000-000000000922', '00000000-0000-4000-8000-000000000902', 2, 'ВАГОН №2', '#222222', 'II', 2, true);

insert into public.guests(
  id, event_id, first_name, last_name, affiliation_type, carriage_id,
  ticket_sequence, ticket_number
)
select
  ('00000000-0000-4000-9000-' || lpad(sequence::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-000000000902',
  'Гость', sequence::text, 'common',
  case when mod(sequence, 2) = 1
    then '00000000-0000-4000-8000-000000000921'::uuid
    else '00000000-0000-4000-8000-000000000922'::uuid
  end,
  sequence,
  'V2-' || lpad(sequence::text, 3, '0')
from generate_series(1, 15) as registered(sequence);

insert into public.bunker_state(event_id)
values ('00000000-0000-4000-8000-000000000902');

select lives_ok(
  $$ update public.bunker_state
     set global_game_state = 'STORY_BUNKER'
     where event_id = '00000000-0000-4000-8000-000000000902' $$,
  'the transitional state constraint preserves STORY_BUNKER for V1 runs'
);
select lives_ok(
  $$ update public.bunker_state
     set global_game_state = 'UNKNOWN_PASSENGER'
     where event_id = '00000000-0000-4000-8000-000000000902' $$,
  'the transitional state constraint accepts UNKNOWN_PASSENGER for V2 runs'
);
update public.bunker_state
set global_game_state = 'LOBBY'
where event_id = '00000000-0000-4000-8000-000000000902';

select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$ select public.owner_prepare_bunker_v2(
    '00000000-0000-4000-8000-000000000902',
    '00000000-0000-4000-8000-000000000931'
  ) $$,
  '42501',
  'owner access required',
  'V2 preparation requires the event owner'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000901',
  true
);

create temporary table bunker_v2_prepare_result(result jsonb) on commit drop;
insert into bunker_v2_prepare_result(result)
select public.owner_prepare_bunker_v2(
  '00000000-0000-4000-8000-000000000902',
  '00000000-0000-4000-8000-000000000931'
);

select is(
  (select result->>'status' from bunker_v2_prepare_result),
  'prepared',
  'owner preparation returns a prepared receipt result'
);
select is(
  (select (result->>'contractVersion')::integer from bunker_v2_prepare_result),
  2,
  'owner preparation declares contract version two'
);
select is(
  (select contract_version from public.bunker_game_runs
   where event_id = '00000000-0000-4000-8000-000000000902'),
  2,
  'the authoritative run persists contract version two'
);
select is(
  (select plan_version from public.bunker_game_runs
   where event_id = '00000000-0000-4000-8000-000000000902'),
  1,
  'the authoritative run persists plan version one'
);
select ok(
  (
    select plan @> jsonb_build_object(
      'contractVersion', 2,
      'planVersion', 1,
      'guestCount', 15,
      'wagonCount', 2
    )
      and jsonb_array_length(plan->'activeWagonIds') = 2
      and jsonb_array_length(plan->'wagonSnapshots') = 2
    from public.bunker_game_runs
    where event_id = '00000000-0000-4000-8000-000000000902'
  ),
  'the frozen plan snapshots its contract, guests and active wagons'
);
select is(
  (
    select count(*)::integer
    from public.bunker_guest_profiles profile
    join public.bunker_game_runs run on run.run_nonce = profile.run_nonce
    where run.event_id = '00000000-0000-4000-8000-000000000902'
      and not profile.joined_late
  ),
  15,
  'preparation freezes one character assignment per registered guest'
);
select is(
  (
    select count(*)::integer
    from public.bunker_mission_instances instance
    where instance.event_id = '00000000-0000-4000-8000-000000000902'
  ),
  12,
  'preparation creates every wagon, group and global V2 mission instance'
);
select ok(
  (
    select count(*) > 0 and bool_and(member.frozen_snapshot ? 'guestId')
    from public.bunker_mission_members member
    where member.event_id = '00000000-0000-4000-8000-000000000902'
  ),
  'mission membership is materialized from frozen guest snapshots'
);
select is(
  (
    select count(*)::integer
    from public.bunker_final_parameters parameter
    where parameter.event_id = '00000000-0000-4000-8000-000000000902'
  ),
  5,
  'preparation stores all five authoritative final parameters'
);
select ok(
  (
    select receipt.request_hash ~ '^[0-9a-f]{64}$'
    from public.bunker_command_receipts receipt
    where receipt.event_id = '00000000-0000-4000-8000-000000000902'
      and receipt.command_id = '00000000-0000-4000-8000-000000000931'
  ),
  'the preparation receipt persists its SHA-256 request hash'
);
select ok(
  exists (
    select 1
    from public.bunker_game_events game_event
    where game_event.event_id = '00000000-0000-4000-8000-000000000902'
      and game_event.command_id = '00000000-0000-4000-8000-000000000931'
      and game_event.actor_id = '00000000-0000-4000-8000-000000000901'
      and game_event.schema_version = 2
  ),
  'preparation appends command, actor and schema metadata to the audit event'
);
select is(
  public.owner_prepare_bunker_v2(
    '00000000-0000-4000-8000-000000000902',
    '00000000-0000-4000-8000-000000000931'
  ),
  (select result from bunker_v2_prepare_result),
  'an exact preparation retry returns the stored receipt result'
);
select throws_ok(
  $$ select public.owner_prepare_bunker_v2(
    '00000000-0000-4000-8000-000000000902',
    '00000000-0000-4000-8000-000000000932'
  ) $$,
  '55000',
  'Bunker V2 run is already active',
  'a second command cannot replace the frozen active run'
);
select throws_ok(
  $$ select public.owner_advance_bunker_game_state(
    '00000000-0000-4000-8000-000000000902', 'CHARACTERS_READY'
  ) $$,
  '55000',
  'Bunker V2 runs require owner_transition_bunker_v2',
  'the legacy state RPC refuses a V2 run'
);
select throws_ok(
  $$ select public.owner_transition_bunker_v2(
    '00000000-0000-4000-8000-000000000902',
    'MISSION_03',
    '00000000-0000-4000-8000-000000000941'
  ) $$,
  '55000',
  'invalid Bunker V2 state transition: LOBBY -> MISSION_03',
  'the V2 state machine rejects skipped stages'
);
select throws_ok(
  $$ select public.owner_transition_bunker_v2(
    '00000000-0000-4000-8000-000000000902',
    'STORY_BUNKER',
    '00000000-0000-4000-8000-000000000942'
  ) $$,
  '55000',
  'STORY_BUNKER is not a V2 state',
  'V2 transitions reject the legacy STORY_BUNKER state'
);

create temporary table bunker_v2_transition_result(result jsonb) on commit drop;
insert into bunker_v2_transition_result(result)
select public.owner_transition_bunker_v2(
  '00000000-0000-4000-8000-000000000902',
  'CHARACTERS_READY',
  '00000000-0000-4000-8000-000000000943'
);

select is(
  (select result->>'globalGameState' from bunker_v2_transition_result),
  'CHARACTERS_READY',
  'the first V2 transition persists the next canonical state'
);
select is(
  public.owner_transition_bunker_v2(
    '00000000-0000-4000-8000-000000000902',
    'CHARACTERS_READY',
    '00000000-0000-4000-8000-000000000943'
  ),
  (select result from bunker_v2_transition_result),
  'an exact transition retry returns the stored receipt result'
);
select throws_ok(
  $$ select public.owner_transition_bunker_v2(
    '00000000-0000-4000-8000-000000000902',
    'MISSION_01',
    '00000000-0000-4000-8000-000000000943'
  ) $$,
  '55000',
  'idempotency_conflict',
  'command-id reuse with a different transition payload is rejected'
);

update public.bunker_state
set global_game_state = 'MISSION_06'
where event_id = '00000000-0000-4000-8000-000000000902';

select throws_ok(
  $$ select public.owner_transition_bunker_v2(
    '00000000-0000-4000-8000-000000000902',
    'STORY_BUNKER',
    '00000000-0000-4000-8000-000000000944'
  ) $$,
  '55000',
  'STORY_BUNKER is not a V2 state',
  'MISSION_06 cannot follow the legacy V1 story path in V2'
);
select is(
  public.owner_transition_bunker_v2(
    '00000000-0000-4000-8000-000000000902',
    'UNKNOWN_PASSENGER',
    '00000000-0000-4000-8000-000000000945'
  )->>'globalGameState',
  'UNKNOWN_PASSENGER',
  'MISSION_06 advances to UNKNOWN_PASSENGER in V2'
);
select is(
  (
    select count(*)::integer
    from public.bunker_command_receipts receipt
    where receipt.event_id = '00000000-0000-4000-8000-000000000902'
      and receipt.command_id = '00000000-0000-4000-8000-000000000943'
  ),
  1,
  'an exact transition retry never duplicates its receipt'
);

select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$ select public.owner_transition_bunker_v2(
    '00000000-0000-4000-8000-000000000902',
    'BREAK_BEFORE_FINAL',
    '00000000-0000-4000-8000-000000000946'
  ) $$,
  '42501',
  'owner access required',
  'V2 transition requires the event owner'
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000901',
  true
);

insert into public.events(id, slug, name, owner_user_id)
values (
  '00000000-0000-4000-8000-000000000903',
  'bunker-v2-too-small',
  'Bunker V2 too small',
  '00000000-0000-4000-8000-000000000901'
);
insert into public.event_state(event_id)
values ('00000000-0000-4000-8000-000000000903');
insert into public.carriages(
  id, event_id, number, label, accent_hex, visual_mark, sort_order, enabled
)
values
  ('00000000-0000-4000-8000-000000000923', '00000000-0000-4000-8000-000000000903', 1, 'ВАГОН №1', '#333333', 'I', 1, true),
  ('00000000-0000-4000-8000-000000000924', '00000000-0000-4000-8000-000000000903', 2, 'ВАГОН №2', '#444444', 'II', 2, true);
insert into public.guests(
  id, event_id, first_name, last_name, affiliation_type, carriage_id,
  ticket_sequence, ticket_number
)
select
  ('00000000-0000-4000-9100-' || lpad(sequence::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-000000000903',
  'Малый', sequence::text, 'common',
  case when mod(sequence, 2) = 1
    then '00000000-0000-4000-8000-000000000923'::uuid
    else '00000000-0000-4000-8000-000000000924'::uuid
  end,
  sequence,
  'SM-' || lpad(sequence::text, 3, '0')
from generate_series(1, 14) as registered(sequence);

select throws_ok(
  $$ select public.owner_prepare_bunker_v2(
    '00000000-0000-4000-8000-000000000903',
    '00000000-0000-4000-8000-000000000951'
  ) $$,
  '55000',
  'Bunker V2 requires between 15 and 40 guests',
  'V2 preparation rejects a run below fifteen guests'
);
select is(
  (
    select count(*)::integer
    from public.bunker_game_runs
    where event_id = '00000000-0000-4000-8000-000000000903'
  ),
  0,
  'failed preparation leaves no partial V2 run'
);

select * from finish();
rollback;
