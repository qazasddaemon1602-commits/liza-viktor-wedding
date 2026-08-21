begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

select function_returns(
  'public', 'get_guest_bunker_v2_runtime', array['text', 'text'], 'jsonb',
  'late guests reconnect through a device-authorized V2 runtime read'
);

select ok(
  not (select prosecdef from pg_proc
       where oid = 'public._ensure_late_bunker_guest(uuid,uuid,uuid)'::regprocedure),
  'the internal late-profile writer keeps invoker semantics'
);

select ok(
  not has_function_privilege(
    'anon', 'public._ensure_late_bunker_guest(uuid,uuid,uuid)', 'EXECUTE'
  ),
  'anonymous clients cannot forge a late profile'
);

select ok(
  not has_function_privilege(
    'authenticated', 'public._ensure_late_bunker_guest(uuid,uuid,uuid)', 'EXECUTE'
  ),
  'authenticated clients cannot forge a late profile'
);

select ok(
  has_function_privilege(
    'anon', 'public.get_guest_bunker_v2_runtime(text,text)', 'EXECUTE'
  ),
  'anonymous guest devices can reconnect through the guarded read RPC'
);

select ok(
  has_function_privilege(
    'authenticated', 'public.get_guest_bunker_v2_runtime(text,text)', 'EXECUTE'
  ),
  'authenticated guest devices can reconnect through the guarded read RPC'
);

select is(
  (
    select count(*)::integer
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        '_ensure_late_bunker_guest', '_assign_late_bunker_guest',
        'get_guest_bunker_v2_runtime', '_clear_bunker_game_run_on_reset',
        'owner_reset_bunker_progress'
      )
      and not coalesce('search_path=""' = any(procedure.proconfig), false)
  ),
  0,
  'late-guest and reset functions use an immutable empty search path'
);

select ok(
  pg_get_functiondef(
    'public._ensure_late_bunker_guest(uuid,uuid,uuid)'::regprocedure
  ) ~ 'character_status(.|\n)*saved'
    and pg_get_functiondef(
      'public._ensure_late_bunker_guest(uuid,uuid,uuid)'::regprocedure
    ) !~ '_refresh_bunker_run_guest_plan',
  'the V2 late-profile writer saves the character without refreshing the plan'
);

select has_trigger(
  'public', 'bunker_ability_uses', 'bunker_v2_ability_instance_incomplete',
  'ability use is guarded by the authoritative instance status'
);

select ok(
  pg_get_functiondef(
    'public._guard_bunker_v2_ability_instance()'::regprocedure
  ) ~ $$status not in \('planned', 'active'\)$$,
  'abilities are limited to incomplete current or future instances'
);

insert into auth.users(id)
values ('30000000-0000-4000-8000-000000000001');

insert into public.events(
  id, slug, name, owner_user_id, next_ticket_sequence
)
values (
  '30000000-0000-4000-8000-000000000002',
  'bunker-v2-late-reset',
  'Bunker V2 late/reset',
  '30000000-0000-4000-8000-000000000001',
  16
);
insert into public.event_state(event_id)
values ('30000000-0000-4000-8000-000000000002');
insert into public.carriages(
  id, event_id, number, label, accent_hex, visual_mark, sort_order, enabled
)
values
  ('30000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000002', 1, 'ВАГОН №1', '#111111', 'I', 1, true),
  ('30000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000002', 2, 'ВАГОН №2', '#222222', 'II', 2, true);
insert into public.guests(
  id, event_id, first_name, last_name, affiliation_type, carriage_id,
  ticket_sequence, ticket_number
)
select
  ('30000000-0000-4000-9000-' || lpad(sequence::text, 12, '0'))::uuid,
  '30000000-0000-4000-8000-000000000002',
  'Гость', sequence::text, 'common',
  case when mod(sequence, 2) = 1
    then '30000000-0000-4000-8000-000000000011'::uuid
    else '30000000-0000-4000-8000-000000000012'::uuid
  end,
  sequence,
  'LR-' || lpad(sequence::text, 3, '0')
from generate_series(1, 15) registered(sequence);
insert into public.bunker_state(event_id)
values ('30000000-0000-4000-8000-000000000002');

select set_config(
  'request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true
);
select is(
  public.owner_prepare_bunker_v2(
    '30000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000020'
  )->>'status',
  'prepared',
  'the fixture prepares one frozen V2 run'
);

create temporary table bunker_v2_late_baseline as
select
  run.run_nonce,
  md5(run.plan::text) as plan_hash,
  run.guest_count,
  (run.plan->>'guestCount')::integer as plan_guest_count,
  (select count(*)::integer from public.bunker_mission_members member
   where member.run_nonce = run.run_nonce) as member_count,
  (select count(*)::integer from public.bunker_mission_members member
   where member.run_nonce = run.run_nonce and member.member_role = 'operator') as operator_count,
  (select count(*)::integer from public.bunker_mission_members member
   where member.run_nonce = run.run_nonce and member.member_role = 'voter') as voter_count
from public.bunker_game_runs run
where run.event_id = '30000000-0000-4000-8000-000000000002';

create temporary table bunker_v2_late_results(
  stage text primary key,
  device_key text not null,
  result jsonb not null,
  runtime jsonb
) on commit drop;

insert into bunker_v2_late_results(stage, device_key, result)
values (
  'before_m01',
  'late-device-before-m01',
  public.register_guest(
    'bunker-v2-late-reset', 'late-device-before-m01',
    'До', 'Миссии', 'common', null, false
  )
);
update bunker_v2_late_results
set runtime = public.get_guest_bunker_runtime(
  'bunker-v2-late-reset', device_key
)
where stage = 'before_m01';

select public.owner_transition_bunker_v2(
  '30000000-0000-4000-8000-000000000002', 'CHARACTERS_READY',
  '30000000-0000-4000-8000-000000000021'
);
select public.owner_transition_bunker_v2(
  '30000000-0000-4000-8000-000000000002', 'MISSION_01',
  '30000000-0000-4000-8000-000000000022'
);

insert into bunker_v2_late_results(stage, device_key, result)
values (
  'during_m01',
  'late-device-during-m01',
  public.register_guest(
    'bunker-v2-late-reset', 'late-device-during-m01',
    'Во', 'Время', 'common', null, false
  )
);
update bunker_v2_late_results
set runtime = public.get_guest_bunker_runtime(
  'bunker-v2-late-reset', device_key
)
where stage = 'during_m01';

select public.owner_transition_bunker_v2(
  '30000000-0000-4000-8000-000000000002', 'BREAK',
  '30000000-0000-4000-8000-000000000023'
);

insert into bunker_v2_late_results(stage, device_key, result)
values (
  'after_m01',
  'late-device-after-m01',
  public.register_guest(
    'bunker-v2-late-reset', 'late-device-after-m01',
    'После', 'Миссии', 'common', null, false
  )
);
update bunker_v2_late_results
set runtime = public.get_guest_bunker_runtime(
  'bunker-v2-late-reset', device_key
)
where stage = 'after_m01';

grant select on bunker_v2_late_results to anon;
set local role anon;
select is(
  public.get_guest_bunker_runtime(
    'bunker-v2-late-reset', 'late-device-before-m01'
  )->>'status',
  'active',
  'an anonymous caller with a valid device binding can read its V2 runtime'
);
select is(
  public.get_guest_bunker_runtime(
    'bunker-v2-late-reset', 'wrong-device-key'
  )->>'status',
  'guest_not_found',
  'an anonymous caller with the wrong device key is rejected'
);
select ok(
  public.get_guest_bunker_runtime(
    'bunker-v2-late-reset', 'late-device-before-m01'
  )#>>'{viewer,guest,id}' = (
    select result#>>'{guest,id}' from bunker_v2_late_results
    where stage = 'before_m01'
  )
  and public.get_guest_bunker_runtime(
    'bunker-v2-late-reset', 'late-device-before-m01'
  )#>>'{viewer,guest,id}' <> (
    select result#>>'{guest,id}' from bunker_v2_late_results
    where stage = 'during_m01'
  ),
  'a valid device binding cannot read another guest identity'
);
reset role;

select ok(
  (select bool_and(result->>'status' = 'registered')
   from bunker_v2_late_results),
  'registration succeeds before, during and after M01'
);
select ok(
  (
    select count(*) = 3
      and bool_and(profile.joined_late)
      and bool_and(profile.character_status = 'saved')
      and bool_and(profile.profile_version > 0)
    from bunker_v2_late_results late
    join public.bunker_guest_profiles profile
      on profile.guest_id = (late.result#>>'{guest,id}')::uuid
  ),
  'each late registration creates exactly one saved versioned snapshot'
);
select ok(
  (select bool_and(
     runtime->>'contractVersion' = '2'
     and runtime->>'status' = 'active'
     and runtime->'character'->>'m01Eligibility' = 'late_joiner'
     and runtime->'character'->>'status' = 'saved'
     and not (runtime->'character' ? 'hiddenTrait')
   ) from bunker_v2_late_results),
  'every late guest reconnects to the strict private V2 runtime'
);
select is(
  (select runtime->>'state' from bunker_v2_late_results where stage = 'before_m01'),
  'LOBBY',
  'a post-prepare LOBBY registration already receives its saved runtime'
);
select ok(
  (select runtime->>'state' = 'MISSION_01'
      and runtime#>>'{currentMission,code}' = 'MISSION_01'
      and runtime#>>'{currentMission,status}' = 'active'
   from bunker_v2_late_results where stage = 'during_m01'),
  'a guest registered during M01 sees only the current incomplete instance'
);
select ok(
  (select runtime->>'state' = 'BREAK'
      and runtime->'currentMission' = 'null'::jsonb
   from bunker_v2_late_results where stage = 'after_m01'),
  'a guest registered after M01 cannot re-enter the completed instance'
);
select ok(
  (
    select md5(run.plan::text) = baseline.plan_hash
      and run.guest_count = baseline.guest_count
      and (run.plan->>'guestCount')::integer = baseline.plan_guest_count
    from bunker_v2_late_baseline baseline
    join public.bunker_game_runs run on run.run_nonce = baseline.run_nonce
  ),
  'late arrivals never mutate guestCount, M01 quota or any frozen plan field'
);
select ok(
  (
    select
      (select count(*) from public.bunker_mission_members member
       where member.run_nonce = baseline.run_nonce) = baseline.member_count
      and (select count(*) from public.bunker_mission_members member
       where member.run_nonce = baseline.run_nonce and member.member_role = 'operator')
        = baseline.operator_count
      and (select count(*) from public.bunker_mission_members member
       where member.run_nonce = baseline.run_nonce and member.member_role = 'voter')
        = baseline.voter_count
    from bunker_v2_late_baseline baseline
  ),
  'late arrivals never change members, M04 operators or M06 voters'
);
select ok(
  (
    select bool_and(not public._ensure_late_bunker_guest(
      '30000000-0000-4000-8000-000000000002',
      baseline.run_nonce,
      (late.result#>>'{guest,id}')::uuid
    ))
    from bunker_v2_late_results late
    cross join bunker_v2_late_baseline baseline
  ),
  'late-profile retries and reconnect repair are idempotent'
);

select lives_ok(
  $ability$
    insert into public.bunker_ability_uses(
      event_id, run_nonce, instance_id, guest_id, ability_key, command_id
    )
    select
      '30000000-0000-4000-8000-000000000002',
      baseline.run_nonce,
      instance.id,
      (late.result#>>'{guest,id}')::uuid,
      profile.special_ability,
      '30000000-0000-4000-8000-000000000024'
    from bunker_v2_late_results late
    cross join bunker_v2_late_baseline baseline
    join public.bunker_guest_profiles profile
      on profile.run_nonce = baseline.run_nonce
     and profile.guest_id = (late.result#>>'{guest,id}')::uuid
    join public.guests guest on guest.id = profile.guest_id
    join public.bunker_mission_instances instance
      on instance.run_nonce = baseline.run_nonce
     and instance.mission_code = 'MISSION_02'
     and instance.scope_key = guest.carriage_id::text
    where late.stage = 'after_m01'
  $ability$,
  'a late guest may use an ability in a future incomplete instance'
);
delete from public.bunker_ability_uses
where command_id = '30000000-0000-4000-8000-000000000024';
update public.bunker_mission_instances instance
set status = 'completed', started_at = now(), completed_at = now()
from bunker_v2_late_baseline baseline
where instance.run_nonce = baseline.run_nonce
  and instance.mission_code = 'MISSION_02';
select throws_ok(
  $ability$
    insert into public.bunker_ability_uses(
      event_id, run_nonce, instance_id, guest_id, ability_key, command_id
    )
    select
      '30000000-0000-4000-8000-000000000002',
      baseline.run_nonce,
      instance.id,
      (late.result#>>'{guest,id}')::uuid,
      profile.special_ability,
      '30000000-0000-4000-8000-000000000025'
    from bunker_v2_late_results late
    cross join bunker_v2_late_baseline baseline
    join public.bunker_guest_profiles profile
      on profile.run_nonce = baseline.run_nonce
     and profile.guest_id = (late.result#>>'{guest,id}')::uuid
    join public.guests guest on guest.id = profile.guest_id
    join public.bunker_mission_instances instance
      on instance.run_nonce = baseline.run_nonce
     and instance.mission_code = 'MISSION_02'
     and instance.scope_key = guest.carriage_id::text
    where late.stage = 'after_m01'
  $ability$,
  '55000', 'Bunker ability instance is complete',
  'a late guest cannot use an ability in a completed instance'
);

insert into public.questions(id, event_id, text, sort_order, enabled)
values (
  '30000000-0000-4000-8000-000000000026',
  '30000000-0000-4000-8000-000000000002',
  'Сохраняется ли анкета пары?', 1, true
);
insert into public.couple_preanswer_access(event_id, token_hash)
values ('30000000-0000-4000-8000-000000000002', 'preserve-on-bunker-reset');
insert into public.couple_preanswers(event_id, question_id, choice)
values (
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000026', 'viktor'
);
create temporary table bunker_v2_reset_preserved as
select
  to_jsonb(event) as event_snapshot,
  to_jsonb(event_state) as event_state_snapshot,
  (select count(*) from public.guests guest where guest.event_id = event.id) as guests,
  (select count(*) from public.guest_device_bindings binding where binding.event_id = event.id) as bindings,
  (select count(*) from public.carriages carriage where carriage.event_id = event.id) as carriages
from public.events event
join public.event_state event_state on event_state.event_id = event.id
where event.id = '30000000-0000-4000-8000-000000000002';

set local role authenticated;
select lives_ok(
  $$ select public.owner_reset_bunker_progress(
       '30000000-0000-4000-8000-000000000002',
       '30000000-0000-4000-8000-000000000027'
     ) $$,
  'the populated V2 run resets in dependency-safe order'
);
reset role;
select is(
  (
    select sum(rows)::integer from (
      select count(*) rows from public.bunker_game_runs row
        join bunker_v2_late_baseline baseline on baseline.run_nonce = row.run_nonce
      union all select count(*) from public.bunker_guest_profiles row
        join bunker_v2_late_baseline baseline on baseline.run_nonce = row.run_nonce
      union all select count(*) from public.bunker_mission_instances row
        join bunker_v2_late_baseline baseline on baseline.run_nonce = row.run_nonce
      union all select count(*) from public.bunker_mission_members row
        join bunker_v2_late_baseline baseline on baseline.run_nonce = row.run_nonce
      union all select count(*) from public.bunker_mission_decisions row
        join bunker_v2_late_baseline baseline on baseline.run_nonce = row.run_nonce
      union all select count(*) from public.bunker_ability_uses row
        join bunker_v2_late_baseline baseline on baseline.run_nonce = row.run_nonce
      union all select count(*) from public.bunker_inventory_transfers row
        join bunker_v2_late_baseline baseline on baseline.run_nonce = row.run_nonce
      union all select count(*) from public.bunker_archive_entitlements row
        join bunker_v2_late_baseline baseline on baseline.run_nonce = row.run_nonce
      union all select count(*) from public.bunker_final_parameters row
        join bunker_v2_late_baseline baseline on baseline.run_nonce = row.run_nonce
      union all select count(*) from public.bunker_command_receipts row
        join bunker_v2_late_baseline baseline on baseline.run_nonce = row.run_nonce
      union all select count(*) from public.bunker_game_events row
        join bunker_v2_late_baseline baseline on baseline.run_nonce = row.run_nonce
    ) remaining
  ),
  0,
  'reset removes the run, V2 projections, receipts and event log'
);
select ok(
  (
    select to_jsonb(event) = preserved.event_snapshot
      and to_jsonb(event_state) = preserved.event_state_snapshot
      and (select count(*) from public.guests guest where guest.event_id = event.id) = preserved.guests
      and (select count(*) from public.guest_device_bindings binding where binding.event_id = event.id) = preserved.bindings
      and (select count(*) from public.carriages carriage where carriage.event_id = event.id) = preserved.carriages
      and exists (select 1 from public.couple_preanswer_access access
                  where access.event_id = event.id)
      and exists (select 1 from public.couple_preanswers answer
                  where answer.event_id = event.id
                    and answer.question_id = '30000000-0000-4000-8000-000000000026')
    from bunker_v2_reset_preserved preserved
    join public.events event on event.id = '30000000-0000-4000-8000-000000000002'
    join public.event_state event_state on event_state.event_id = event.id
  ),
  'Bunker reset preserves guests, bindings, carriages, couple answers and non-Bunker configuration'
);

select * from finish();
rollback;
