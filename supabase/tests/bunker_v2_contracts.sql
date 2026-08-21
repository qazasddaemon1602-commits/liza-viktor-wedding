begin;

create extension if not exists pgtap with schema extensions;

select plan(97);

select has_column(
  'public', 'bunker_game_runs', 'contract_version',
  'runs declare their runtime contract version'
);
select has_column(
  'public', 'bunker_game_runs', 'plan_version',
  'V2 runs declare their immutable plan version'
);
select has_column(
  'public', 'bunker_character_profiles', 'profile_version',
  'the character catalog versions every profile'
);
select has_column(
  'public', 'bunker_guest_profiles', 'profile_version',
  'every frozen assignment persists its catalog profile version'
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
select function_returns(
  'public', '_bunker_v2_match_repeats', array['uuid', 'jsonb', 'jsonb'], 'jsonb',
  'the deterministic global repeat matcher returns JSON assignments'
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
      and not coalesce('search_path=""' = any(procedure.proconfig), false)
  ),
  0,
  'every V2 function has an immutable empty search path'
);

select is(
  (
    select count(*)::integer
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = any(array[
        '_refresh_bunker_run_guest_plan_v1',
        '_bunker_run_guest_plan_is_stale_v1',
        '_ensure_late_bunker_guest_v1',
        '_create_bunker_game_plan_v1',
        '_owner_distribute_bunker_characters_v1'
      ])
      and (
        has_function_privilege('anon', procedure.oid, 'EXECUTE')
        or has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      )
  ),
  0,
  'renamed V1 implementation bodies are internal-only'
);

select ok(
  (
    select count(*) = 14
    from (values
      ('bunker_inventory_transfers', 'bunker_inventory_transfers_source_lot_run_fkey', 'FOREIGN KEY \(source_lot_id, event_id, run_nonce\) REFERENCES (public\.)?bunker_inventory_lots\(id, event_id, run_nonce\)'),
      ('bunker_inventory_transfers', 'bunker_inventory_transfers_accepted_lot_run_fkey', 'FOREIGN KEY \(accepted_lot_id, event_id, run_nonce\) REFERENCES (public\.)?bunker_inventory_lots\(id, event_id, run_nonce\)'),
      ('bunker_inventory_transfers', 'bunker_inventory_transfers_from_carriage_event_fkey', 'FOREIGN KEY \(from_carriage_id, event_id\) REFERENCES (public\.)?carriages\(id, event_id\)'),
      ('bunker_inventory_transfers', 'bunker_inventory_transfers_to_carriage_event_fkey', 'FOREIGN KEY \(to_carriage_id, event_id\) REFERENCES (public\.)?carriages\(id, event_id\)'),
      ('bunker_inventory_transfers', 'bunker_inventory_transfers_guest_event_fkey', 'FOREIGN KEY \(proposed_by_guest_id, event_id\) REFERENCES (public\.)?guests\(id, event_id\)'),
      ('bunker_archive_entitlements', 'bunker_archive_entitlements_archive_run_fkey', 'FOREIGN KEY \(archive_entry_id, event_id, run_nonce\) REFERENCES (public\.)?bunker_archive_entries\(id, event_id, run_nonce\)'),
      ('bunker_archive_entitlements', 'bunker_archive_entitlements_carriage_event_fkey', 'FOREIGN KEY \(carriage_id, event_id\) REFERENCES (public\.)?carriages\(id, event_id\)'),
      ('bunker_archive_entitlements', 'bunker_archive_entitlements_source_run_fkey', 'FOREIGN KEY \(source_entitlement_id, event_id, run_nonce\) REFERENCES (public\.)?bunker_archive_entitlements\(id, event_id, run_nonce\)'),
      ('bunker_archive_entitlements', 'bunker_archive_entitlements_transfer_run_fkey', 'FOREIGN KEY \(source_transfer_id, event_id, run_nonce\) REFERENCES (public\.)?bunker_inventory_transfers\(id, event_id, run_nonce\)'),
      ('bunker_final_parameters', 'bunker_final_parameters_source_instance_run_fkey', 'FOREIGN KEY \(source_instance_id, event_id, run_nonce\) REFERENCES (public\.)?bunker_mission_instances\(id, event_id, run_nonce\)'),
      ('bunker_mission_members', 'bunker_mission_members_guest_event_fkey', 'FOREIGN KEY \(guest_id, event_id\) REFERENCES (public\.)?guests\(id, event_id\)'),
      ('bunker_mission_members', 'bunker_mission_members_carriage_event_fkey', 'FOREIGN KEY \(carriage_id, event_id\) REFERENCES (public\.)?carriages\(id, event_id\)'),
      ('bunker_ability_uses', 'bunker_ability_uses_guest_event_fkey', 'FOREIGN KEY \(guest_id, event_id\) REFERENCES (public\.)?guests\(id, event_id\)'),
      ('bunker_game_events', 'bunker_game_events_instance_run_fkey', 'FOREIGN KEY \(instance_id, event_id, run_nonce\) REFERENCES (public\.)?bunker_mission_instances\(id, event_id, run_nonce\)')
    ) expected(table_name, constraint_name, definition_pattern)
    join pg_constraint constraint_row
      on constraint_row.conrelid = to_regclass('public.' || expected.table_name)
     and constraint_row.conname = expected.constraint_name
     and constraint_row.contype = 'f'
     and pg_get_constraintdef(constraint_row.oid) ~ expected.definition_pattern
  ),
  'authoritative references declare named same-event/run foreign keys'
);

select ok(
  (
    select
      definition.body ~ 'from public\.bunker_state state(.|\n)*for update;(.|\n)*from public\.events event(.|\n)*event\.owner_user_id = v_owner;'
      and definition.body !~ 'from public\.bunker_state state(.|\n)*for update;(.|\n)*from public\.events event(.|\n)*for update;'
      and (
        select count(*)
        from regexp_matches(
          definition.body, 'event\.owner_user_id = v_owner', 'g'
        )
      ) = 2
    from (select pg_get_functiondef(
      'public.owner_prepare_bunker_v2(uuid,uuid)'::regprocedure
    ) as body) definition
  ),
  'V2 preparation rechecks ownership after state lock without locking events'
);
select ok(
  (
    select
      definition.body ~ 'from public\.bunker_state state(.|\n)*for update;(.|\n)*from public\.events event(.|\n)*event\.owner_user_id = v_owner;'
      and definition.body !~ 'from public\.bunker_state state(.|\n)*for update;(.|\n)*from public\.events event(.|\n)*for update;'
      and (
        select count(*)
        from regexp_matches(
          definition.body, 'event\.owner_user_id = v_owner', 'g'
        )
      ) = 2
    from (select pg_get_functiondef(
      'public.owner_transition_bunker_v2(uuid,text,uuid)'::regprocedure
    ) as body) definition
  ),
  'V2 transition rechecks ownership after state lock without locking events'
);

select ok(
  to_regclass('public.carriages_id_event_uidx') is not null
    and to_regclass('public.guests_id_event_uidx') is not null
    and to_regclass('public.bunker_inventory_lots_id_event_run_uidx') is not null
    and to_regclass('public.bunker_archive_entries_id_event_run_uidx') is not null
    and exists (
      select 1
      from pg_constraint constraint_row
      where constraint_row.conrelid = 'public.bunker_mission_instances'::regclass
        and constraint_row.contype = 'u'
        and pg_get_constraintdef(constraint_row.oid)
          = 'UNIQUE (id, event_id, run_nonce)'
    ),
  'composite FK parents expose matching unique indexes'
);

select ok(
  (
    select attnotnull
    from pg_attribute
    where attrelid = 'public.bunker_character_profiles'::regclass
      and attname = 'profile_version'
  ) and (
    select attnotnull
    from pg_attribute
    where attrelid = 'public.bunker_guest_profiles'::regclass
      and attname = 'profile_version'
  ),
  'catalog and frozen assignment profile versions are non-null'
);
select col_has_check(
  'public', 'bunker_character_profiles', 'profile_version',
  'catalog profile versions must be positive'
);
select col_has_check(
  'public', 'bunker_guest_profiles', 'profile_version',
  'frozen assignment profile versions must be positive'
);

select is(
  public._bunker_v2_match_repeats(
    '10000000-0000-4000-8000-000000000001',
    '[
      {"profileKey":"p1","carriageId":"10000000-0000-4000-8000-000000000011","ordinal":1},
      {"profileKey":"p2","carriageId":"10000000-0000-4000-8000-000000000012","ordinal":2},
      {"profileKey":"p3","carriageId":"10000000-0000-4000-8000-000000000011","ordinal":3}
    ]'::jsonb,
    '[
      {"guestId":"10000000-0000-4000-8000-000000000021","carriageId":"10000000-0000-4000-8000-000000000011","repeatIndex":1}
    ]'::jsonb
  )->0->>'profileKey',
  'p2',
  'global repeat matching finds cross-wagon separation outside the old residue class'
);

set local role authenticated;
select throws_ok(
  $$ select public._refresh_bunker_run_guest_plan_v1(null, null) $$,
  '42501', 'permission denied for function _refresh_bunker_run_guest_plan_v1',
  'authenticated clients cannot direct-call the renamed refresh body'
);
select throws_ok(
  $$ select public._bunker_run_guest_plan_is_stale_v1(null, null) $$,
  '42501', 'permission denied for function _bunker_run_guest_plan_is_stale_v1',
  'authenticated clients cannot direct-call the renamed stale-check body'
);
select throws_ok(
  $$ select public._ensure_late_bunker_guest_v1(null, null, null) $$,
  '42501', 'permission denied for function _ensure_late_bunker_guest_v1',
  'authenticated clients cannot direct-call the renamed late-guest body'
);
select throws_ok(
  $$ select public._create_bunker_game_plan_v1(null, null) $$,
  '42501', 'permission denied for function _create_bunker_game_plan_v1',
  'authenticated clients cannot direct-call the renamed plan body'
);
select throws_ok(
  $$ select public._owner_distribute_bunker_characters_v1(null) $$,
  '42501', 'permission denied for function _owner_distribute_bunker_characters_v1',
  'authenticated clients cannot direct-call the renamed distributor body'
);
reset role;

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

create temporary table bunker_v2_frozen_baseline(
  plan_hash text,
  member_count integer
) on commit drop;
insert into bunker_v2_frozen_baseline(plan_hash, member_count)
select md5(run.plan::text), (
  select count(*)::integer
  from public.bunker_mission_members member
  where member.run_nonce = run.run_nonce
)
from public.bunker_game_runs run
where run.event_id = '00000000-0000-4000-8000-000000000902';

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
      'catalogVersion', 1,
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
select ok(
  (
    select count(*) = 15 and bool_and(profile.profile_version = 1)
    from public.bunker_guest_profiles profile
    where profile.event_id = '00000000-0000-4000-8000-000000000902'
  ),
  'every V2 assignment freezes the current profile catalog version'
);
select ok(
  (
    select count(*) > 0
      and bool_and((member.frozen_snapshot->>'profileVersion')::integer = 1)
    from public.bunker_mission_members member
    where member.event_id = '00000000-0000-4000-8000-000000000902'
  ),
  'every mission-member snapshot persists its profile version'
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
  $$ select public.owner_distribute_bunker_characters(
    '00000000-0000-4000-8000-000000000902'
  ) $$,
  '55000', 'legacy character distribution requires contract version 1',
  'the legacy character distributor rejects an authoritative V2 run'
);
select throws_ok(
  $$ select public._refresh_bunker_run_guest_plan(
    '00000000-0000-4000-8000-000000000902',
    (select run_nonce from public.bunker_state
     where event_id = '00000000-0000-4000-8000-000000000902')
  ) $$,
  '55000', 'Bunker V2 run plan is frozen',
  'the callable legacy refresh boundary rejects a V2 run'
);
select is(
  public._bunker_run_guest_plan_is_stale(
    '00000000-0000-4000-8000-000000000902',
    (select run_nonce from public.bunker_state
     where event_id = '00000000-0000-4000-8000-000000000902')
  ),
  false,
  'the legacy poll repair path never considers a V2 frozen plan stale'
);
select throws_ok(
  $$ select public._create_bunker_game_plan(
    '00000000-0000-4000-8000-000000000902',
    (select run_nonce from public.bunker_state
     where event_id = '00000000-0000-4000-8000-000000000902')
  ) $$,
  '55000', 'Bunker V2 run plan is frozen',
  'the legacy plan builder cannot replace a V2 frozen plan'
);

insert into public.guests(
  id, event_id, first_name, last_name, affiliation_type, carriage_id,
  ticket_sequence, ticket_number
) values (
  '00000000-0000-4000-9000-000000000016',
  '00000000-0000-4000-8000-000000000902',
  'Поздний', 'Гость', 'common',
  '00000000-0000-4000-8000-000000000921', 16, 'V2-016'
);
select is(
  public._ensure_late_bunker_guest(
    '00000000-0000-4000-8000-000000000902',
    (select run_nonce from public.bunker_state
     where event_id = '00000000-0000-4000-8000-000000000902'),
    '00000000-0000-4000-9000-000000000016'
  ),
  false,
  'the guarded late-guest helper cannot mutate a V2 assignment set'
);
select is(
  (
    select md5(run.plan::text)
    from public.bunker_game_runs run
    where run.event_id = '00000000-0000-4000-8000-000000000902'
  ),
  (select plan_hash from bunker_v2_frozen_baseline),
  'a V2 late guest cannot mutate the frozen plan'
);
select is(
  (
    select count(*)::integer
    from public.bunker_mission_members member
    where member.event_id = '00000000-0000-4000-8000-000000000902'
  ),
  (select member_count from bunker_v2_frozen_baseline),
  'a V2 late guest cannot mutate frozen mission membership'
);
select is(
  (
    select count(*)::integer
    from public.bunker_guest_profiles profile
    where profile.guest_id = '00000000-0000-4000-9000-000000000016'
  ),
  0,
  'Task 2 leaves the V2 late guest unassigned without changing frozen data'
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

select lives_ok(
  $test$
    do $chain$
    declare
      v_state text;
      v_ordinal integer := 0;
    begin
      foreach v_state in array array[
        'MISSION_01', 'BREAK', 'MISSION_02', 'MISSION_03',
        'MISSION_04', 'MISSION_05', 'MISSION_06'
      ]::text[] loop
        v_ordinal := v_ordinal + 1;
        perform public.owner_transition_bunker_v2(
          '00000000-0000-4000-8000-000000000902', v_state,
          ('00000000-0000-4000-8001-'
            || lpad(v_ordinal::text, 12, '0'))::uuid
        );
      end loop;
    end;
    $chain$
  $test$,
  'the V2 transition RPC advances through every pre-story state in order'
);

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

select lives_ok(
  $test$
    do $chain$
    declare
      v_state text;
      v_ordinal integer := 0;
    begin
      foreach v_state in array array[
        'BREAK_BEFORE_FINAL', 'FINAL_30', 'BUNKER_OPEN', 'FINISHED'
      ]::text[] loop
        v_ordinal := v_ordinal + 1;
        perform public.owner_transition_bunker_v2(
          '00000000-0000-4000-8000-000000000902', v_state,
          ('00000000-0000-4000-8002-'
            || lpad(v_ordinal::text, 12, '0'))::uuid
        );
      end loop;
    end;
    $chain$
  $test$,
  'the V2 transition RPC completes the canonical post-story chain'
);
select is(
  (
    select global_game_state
    from public.bunker_state
    where event_id = '00000000-0000-4000-8000-000000000902'
  ),
  'FINISHED',
  'the full transition chain finishes the authoritative V2 run'
);

create temporary table bunker_v2_matrix(
  guest_count integer primary key,
  wagon_count integer not null,
  event_id uuid not null,
  run_nonce uuid not null
) on commit drop;

do $matrix$
declare
  v_guest_count integer;
  v_wagon_count integer;
  v_event_id uuid;
  v_run_nonce uuid;
  v_wagon integer;
begin
  for v_guest_count in 15..40 loop
    v_wagon_count := 2 + mod(v_guest_count - 15, 4);
    v_event_id := md5('bunker-v2-matrix-event-' || v_guest_count)::uuid;

    insert into public.events(id, slug, name, owner_user_id)
    values (
      v_event_id,
      'bunker-v2-matrix-' || v_guest_count,
      'Bunker V2 matrix ' || v_guest_count,
      '00000000-0000-4000-8000-000000000901'
    );
    insert into public.event_state(event_id) values (v_event_id);

    for v_wagon in 1..v_wagon_count loop
      insert into public.carriages(
        id, event_id, number, label, accent_hex, visual_mark, sort_order, enabled
      ) values (
        md5('bunker-v2-matrix-carriage-' || v_guest_count || '-' || v_wagon)::uuid,
        v_event_id, v_wagon, 'ВАГОН №' || v_wagon, '#123456',
        v_wagon::text, v_wagon, true
      );
    end loop;

    insert into public.guests(
      id, event_id, first_name, last_name, affiliation_type, carriage_id,
      ticket_sequence, ticket_number
    )
    select
      md5('bunker-v2-matrix-guest-' || v_guest_count || '-' || sequence)::uuid,
      v_event_id,
      'Матрица', sequence::text, 'common',
      md5(
        'bunker-v2-matrix-carriage-' || v_guest_count || '-'
          || (1 + mod(sequence - 1, v_wagon_count))
      )::uuid,
      sequence,
      'MX-' || v_guest_count || '-' || sequence
    from generate_series(1, v_guest_count) as registered(sequence);

    insert into public.bunker_state(event_id) values (v_event_id);
    v_run_nonce := (
      public.owner_prepare_bunker_v2(
        v_event_id,
        md5('bunker-v2-matrix-command-' || v_guest_count)::uuid
      )->>'runNonce'
    )::uuid;

    insert into bunker_v2_matrix(guest_count, wagon_count, event_id, run_nonce)
    values (v_guest_count, v_wagon_count, v_event_id, v_run_nonce);
  end loop;
end;
$matrix$;

select is(
  (select count(*)::integer from bunker_v2_matrix),
  26,
  'the parameterized preparation matrix covers every guest count from 15 to 40'
);
select ok(
  (
    select bool_and(assignment_count = matrix.guest_count)
    from bunker_v2_matrix matrix
    cross join lateral (
      select count(*)::integer as assignment_count
      from public.bunker_guest_profiles profile
      where profile.run_nonce = matrix.run_nonce
    ) assigned
  ),
  'every N=15..40 fixture freezes exactly one assignment per guest'
);
select ok(
  not exists (
    select 1
    from bunker_v2_matrix matrix
    cross join lateral (values
      ('technical'::text, case when matrix.guest_count <= 20 then 2 else 3 end),
      ('medical', case when matrix.guest_count <= 18 then 1 else 2 end),
      ('information', case when matrix.guest_count <= 20 then 1 else 2 end),
      ('communication', case when matrix.guest_count <= 20 then 2 else 3 end),
      ('analytical', case when matrix.guest_count <= 20 then 2 else 3 end),
      ('bunker', case when matrix.guest_count <= 20 then 1 else 2 end),
      ('navigation', case when matrix.guest_count <= 20 then 1 else 2 end)
    ) target(category, target_count)
    cross join lateral (
      select count(*)::integer as actual_count
      from public.bunker_guest_profiles assigned
      where assigned.run_nonce = matrix.run_nonce
        and case target.category
          when 'technical' then assigned.character_profile_key = any(array[
            'power_engineer', 'electrician', 'mechanic', 'military_engineer'
          ]::text[])
          when 'medical' then assigned.character_profile_key = any(array[
            'surgeon', 'paramedic'
          ]::text[])
          when 'information' then assigned.character_profile_key = any(array[
            'cybersecurity_specialist', 'programmer', 'student'
          ]::text[])
          when 'communication' then assigned.character_profile_key = any(array[
            'signal_operator', 'radio_amateur', 'diplomat', 'psychologist'
          ]::text[])
          when 'analytical' then assigned.character_profile_key = any(array[
            'cartographer', 'cybersecurity_specialist', 'lawyer',
            'journalist', 'teacher', 'astronomer'
          ]::text[])
          when 'bunker' then assigned.character_profile_key = any(array[
            'unemployed', 'architect', 'security_guard',
            'journalist', 'military_engineer'
          ]::text[])
          when 'navigation' then assigned.character_profile_key = any(array[
            'geologist', 'cartographer', 'train_driver', 'driver'
          ]::text[])
        end
    ) actual
    where actual.actual_count < target.target_count
  ),
  'every N=15..40 fixture satisfies its parameterized category quotas'
);
select is(
  (
    select count(*)::integer
    from (
      select
        profile.character_profile_key,
        row_number() over (
          order by md5(matrix.run_nonce::text || ':guest:' || guest.id::text)
        ) as assignment_ordinal
      from bunker_v2_matrix matrix
      join public.guests guest on guest.event_id = matrix.event_id
      join public.bunker_guest_profiles profile
        on profile.run_nonce = matrix.run_nonce and profile.guest_id = guest.id
      where matrix.guest_count = 18
    ) assignment
    where assignment.assignment_ordinal <= 10
      and assignment.character_profile_key = any(array[
        'surgeon', 'paramedic'
      ]::text[])
  ),
  1,
  'N=18 deterministically reserves one medical profile in the quota prefix'
);
select is(
  (
    select count(*)::integer
    from (
      select
        profile.character_profile_key,
        row_number() over (
          order by md5(matrix.run_nonce::text || ':guest:' || guest.id::text)
        ) as assignment_ordinal
      from bunker_v2_matrix matrix
      join public.guests guest on guest.event_id = matrix.event_id
      join public.bunker_guest_profiles profile
        on profile.run_nonce = matrix.run_nonce and profile.guest_id = guest.id
      where matrix.guest_count = 19
    ) assignment
    where assignment.assignment_ordinal <= 11
      and assignment.character_profile_key = any(array[
        'surgeon', 'paramedic'
      ]::text[])
  ),
  2,
  'N=19 deterministically reserves two medical profiles in the quota prefix'
);
select ok(
  not exists (
    select 1
    from bunker_v2_matrix matrix
    cross join lateral (
      select
        count(distinct profile.character_profile_key)::integer as distinct_count,
        max(frequency.usage_count)::integer as max_frequency,
        count(*) filter (where frequency.usage_count = 2)::integer as repeat_keys
      from public.bunker_guest_profiles profile
      cross join lateral (
        select count(*)::integer as usage_count
        from public.bunker_guest_profiles same_profile
        where same_profile.run_nonce = matrix.run_nonce
          and same_profile.character_profile_key = profile.character_profile_key
      ) frequency
      where profile.run_nonce = matrix.run_nonce
    ) distribution
    where matrix.guest_count between 30 and 40
      and (
        distribution.distinct_count <> least(matrix.guest_count, 36)
        or distribution.max_frequency > 2
        or distribution.repeat_keys <> greatest(matrix.guest_count - 36, 0) * 2
      )
  ),
  'N=30..40 uses all distinct profiles before distinct frequency-two repeats'
);
select ok(
  not exists (
    select 1
    from bunker_v2_matrix matrix
    join public.bunker_guest_profiles profile
      on profile.run_nonce = matrix.run_nonce
    join public.guests guest on guest.id = profile.guest_id
    where matrix.guest_count between 37 and 40
    group by matrix.run_nonce, profile.character_profile_key
    having count(*) = 2 and count(distinct guest.carriage_id) < 2
  ),
  'adversarial N=37..40 repeats are separated across wagons when feasible'
);
select ok(
  (
    select min(wagon_count) = 2 and max(wagon_count) = 5
      and bool_and((run.plan->>'wagonCount')::integer = matrix.wagon_count)
    from bunker_v2_matrix matrix
    join public.bunker_game_runs run on run.run_nonce = matrix.run_nonce
  ),
  'the parameterized matrix covers 2..5 wagons and freezes each wagon count'
);
select ok(
  (
    select bool_and(
      (run.plan->>'catalogVersion')::integer = 1
      and not exists (
        select 1
        from public.bunker_guest_profiles profile
        where profile.run_nonce = matrix.run_nonce
          and profile.profile_version is null
      )
    )
    from bunker_v2_matrix matrix
    join public.bunker_game_runs run on run.run_nonce = matrix.run_nonce
  ),
  'every matrix plan and assignment persists a non-null catalog version'
);

create temporary table bunker_v2_reset_baseline as
select
  matrix.event_id,
  matrix.run_nonce,
  to_jsonb(event) as event_snapshot,
  to_jsonb(event_state) as event_state_snapshot,
  (select count(*)::integer from public.guests guest
   where guest.event_id = matrix.event_id) as guest_count,
  (select count(*)::integer from public.carriages carriage
   where carriage.event_id = matrix.event_id) as carriage_count
from bunker_v2_matrix matrix
join public.events event on event.id = matrix.event_id
join public.event_state event_state on event_state.event_id = matrix.event_id
where matrix.guest_count = 15;

insert into public.bunker_archive_entries(
  id, event_id, run_nonce, artifact_key, content_type, content
)
select
  '20000000-0000-4000-8000-000000000001',
  baseline.event_id,
  baseline.run_nonce,
  'reset-graph',
  'document',
  '{"fixture":true}'::jsonb
from bunker_v2_reset_baseline baseline;

insert into public.bunker_inventory_transfers(
  id, event_id, run_nonce, instance_id, source_lot_id, accepted_lot_id,
  from_carriage_id, to_carriage_id, proposed_by_guest_id,
  item_key, quantity, status, command_id, settled_at
)
select
  '20000000-0000-4000-8000-000000000002',
  baseline.event_id,
  baseline.run_nonce,
  instance.id,
  lot.id,
  lot.id,
  carriage_ids.ids[1],
  carriage_ids.ids[2],
  guest.id,
  lot.item_key,
  1,
  'accepted',
  '20000000-0000-4000-8000-000000000003',
  clock_timestamp()
from bunker_v2_reset_baseline baseline
cross join lateral (
  select array_agg(carriage.id order by carriage.sort_order) as ids
  from public.carriages carriage
  where carriage.event_id = baseline.event_id
) carriage_ids
cross join lateral (
  select instance.id
  from public.bunker_mission_instances instance
  where instance.run_nonce = baseline.run_nonce
  order by instance.id
  limit 1
) instance
cross join lateral (
  select lot.id, lot.item_key
  from public.bunker_inventory_lots lot
  where lot.run_nonce = baseline.run_nonce
    and lot.carriage_id = carriage_ids.ids[1]
  order by lot.id
  limit 1
) lot
cross join lateral (
  select guest.id
  from public.guests guest
  where guest.event_id = baseline.event_id
    and guest.carriage_id = carriage_ids.ids[1]
  order by guest.id
  limit 1
) guest;

insert into public.bunker_inventory_lots(
  id, event_id, run_nonce, carriage_id,
  item_key, quantity, source_lot_id, metadata
)
select
  '20000000-0000-4000-8000-000000000006',
  baseline.event_id,
  baseline.run_nonce,
  source.carriage_id,
  source.item_key,
  1,
  source.id,
  '{"resetChild":true}'::jsonb
from bunker_v2_reset_baseline baseline
cross join lateral (
  select lot.id, lot.carriage_id, lot.item_key
  from public.bunker_inventory_lots lot
  where lot.run_nonce = baseline.run_nonce
  order by lot.id
  limit 1
) source;

insert into public.bunker_archive_entitlements(
  id, event_id, run_nonce, archive_entry_id,
  owner_scope_kind, owner_scope_key, status, transferred_at
)
select
  '20000000-0000-4000-8000-000000000004',
  baseline.event_id,
  baseline.run_nonce,
  '20000000-0000-4000-8000-000000000001',
  'global',
  'reset-root',
  'transferred',
  clock_timestamp()
from bunker_v2_reset_baseline baseline;

insert into public.bunker_archive_entitlements(
  id, event_id, run_nonce, archive_entry_id,
  owner_scope_kind, owner_scope_key,
  source_entitlement_id, source_transfer_id
)
select
  '20000000-0000-4000-8000-000000000005',
  baseline.event_id,
  baseline.run_nonce,
  '20000000-0000-4000-8000-000000000001',
  'global',
  'reset-child',
  '20000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000002'
from bunker_v2_reset_baseline baseline;

update public.bunker_final_parameters parameter
set source_instance_id = source.instance_id
from (
  select baseline.run_nonce, instance.id as instance_id
  from bunker_v2_reset_baseline baseline
  cross join lateral (
    select candidate.id
    from public.bunker_mission_instances candidate
    where candidate.run_nonce = baseline.run_nonce
    order by candidate.id
    limit 1
  ) instance
) source
where parameter.run_nonce = source.run_nonce
  and parameter.parameter_key = 'coordinates';

select lives_ok(
  $$ update public.bunker_state
     set run_nonce = null
     where event_id = (select event_id from bunker_v2_reset_baseline) $$,
  'a populated V2 provenance graph resets without RESTRICT-order failures'
);
select is(
  (
    select sum(runtime_rows)::integer
    from (
      select count(*) as runtime_rows from public.bunker_game_runs run
        join bunker_v2_reset_baseline baseline on baseline.run_nonce = run.run_nonce
      union all select count(*) from public.bunker_mission_instances row
        join bunker_v2_reset_baseline baseline on baseline.run_nonce = row.run_nonce
      union all select count(*) from public.bunker_mission_members row
        join bunker_v2_reset_baseline baseline on baseline.run_nonce = row.run_nonce
      union all select count(*) from public.bunker_inventory_transfers row
        join bunker_v2_reset_baseline baseline on baseline.run_nonce = row.run_nonce
      union all select count(*) from public.bunker_archive_entitlements row
        join bunker_v2_reset_baseline baseline on baseline.run_nonce = row.run_nonce
      union all select count(*) from public.bunker_final_parameters row
        join bunker_v2_reset_baseline baseline on baseline.run_nonce = row.run_nonce
    ) remaining
  ),
  0,
  'the reset removes the authoritative V2 run and its projection graph'
);
select ok(
  (
    select
      to_jsonb(event) = baseline.event_snapshot
      and to_jsonb(event_state) = baseline.event_state_snapshot
      and (select count(*) from public.guests guest
           where guest.event_id = baseline.event_id) = baseline.guest_count
      and (select count(*) from public.carriages carriage
           where carriage.event_id = baseline.event_id) = baseline.carriage_count
    from bunker_v2_reset_baseline baseline
    join public.events event on event.id = baseline.event_id
    join public.event_state event_state on event_state.event_id = baseline.event_id
  ),
  'the Bunker reset preserves wedding configuration, carriages and guests'
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
