begin;

create extension if not exists pgtap with schema extensions;

select plan(27);

select function_returns('public', 'owner_reset_bunker_progress', array['uuid', 'uuid'], 'jsonb', 'a dedicated owner RPC resets only Bunker progress');
select ok(
  (select prosecdef from pg_proc where oid = 'public.owner_reset_bunker_progress(uuid,uuid)'::regprocedure)
    and coalesce('search_path=""' = any((select proconfig from pg_proc where oid = 'public.owner_reset_bunker_progress(uuid,uuid)'::regprocedure)), false),
  'the Bunker progress reset RPC is a hardened definer'
);
select ok(
  not exists (
    select 1 from pg_proc procedure
    cross join lateral aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) privilege
    where procedure.oid = 'public.owner_reset_bunker_progress(uuid,uuid)'::regprocedure
      and privilege.grantee = 0 and privilege.privilege_type = 'EXECUTE'
  ) and not has_function_privilege('anon', 'public.owner_reset_bunker_progress(uuid,uuid)', 'EXECUTE'),
  'PUBLIC and anonymous clients cannot reset Bunker progress'
);
select ok(
  has_function_privilege('authenticated', 'public.owner_reset_bunker_progress(uuid,uuid)', 'EXECUTE'),
  'authenticated owner sessions can invoke Bunker progress reset'
);
select ok(
  to_regclass('public.bunker_progress_reset_receipts') is not null
    and (select relrowsecurity from pg_class where oid = 'public.bunker_progress_reset_receipts'::regclass)
    and not has_table_privilege('anon', 'public.bunker_progress_reset_receipts', 'SELECT')
    and not has_table_privilege('authenticated', 'public.bunker_progress_reset_receipts', 'SELECT'),
  'progress-reset receipts are private and protected by RLS'
);
select ok(
  (select prosecdef from pg_proc where oid = 'public._clear_bunker_game_run_on_reset()'::regprocedure)
    and coalesce('search_path=""' = any((select proconfig from pg_proc where oid = 'public._clear_bunker_game_run_on_reset()'::regprocedure)), false),
  'the internal run cleanup trigger is a hardened definer'
);
select ok(
  not has_function_privilege('anon', 'public._clear_bunker_game_run_on_reset()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public._clear_bunker_game_run_on_reset()', 'EXECUTE'),
  'API clients cannot invoke the internal run cleanup trigger'
);
select ok(
  pg_get_functiondef('public._clear_bunker_game_run_on_reset()'::regprocedure) ~ 'run_nonce = old\.run_nonce'
    and pg_get_functiondef('public._clear_bunker_game_run_on_reset()'::regprocedure)
      !~ 'delete from public\.(guests|guest_device_bindings|carriages|couple_preanswers|couple_preanswer_access)',
  'run cleanup is scoped and never deletes preserved wedding identity/configuration'
);
select ok(
  has_function_privilege('authenticated', 'public.owner_reset_event_test_data(uuid,text)', 'EXECUTE')
    and position('delete from public.guests' in lower(pg_get_functiondef('public.owner_reset_event_test_data(uuid,text)'::regprocedure))) > 0,
  'the destructive rehearsal reset remains a distinct authenticated operation'
);

insert into auth.users(id) values
  ('31000000-0000-4000-8000-000000000001'),
  ('31000000-0000-4000-8000-000000000002');
insert into public.events(
  id, slug, name, expected_guest_count, registration_open,
  composition_locked, next_ticket_sequence, owner_user_id
) values (
  '31000000-0000-4000-8000-000000000010', 'bunker-safe-reset',
  'Bunker safe reset', 33, false, true, 88,
  '31000000-0000-4000-8000-000000000001'
);
insert into public.event_state(event_id, current_module, screen_mode, screen_payload, screen_pinned)
values ('31000000-0000-4000-8000-000000000010', 'bunker', 'bunker_emergency', '{"fixture":"bunker"}', true);
insert into public.carriages(id, event_id, number, label, accent_hex, visual_mark, sort_order, enabled) values
  ('31000000-0000-4000-8000-000000000011', '31000000-0000-4000-8000-000000000010', 1, 'ВАГОН №1', '#111111', 'I', 1, true),
  ('31000000-0000-4000-8000-000000000012', '31000000-0000-4000-8000-000000000010', 2, 'ВАГОН №2', '#222222', 'II', 2, true);
insert into public.guests(
  id, event_id, first_name, last_name, affiliation_type, carriage_id,
  ticket_sequence, ticket_number
)
select
  ('31000000-0000-4000-9000-' || lpad(sequence::text, 12, '0'))::uuid,
  '31000000-0000-4000-8000-000000000010', 'Гость', sequence::text, 'common',
  case when mod(sequence, 2) = 1 then '31000000-0000-4000-8000-000000000011'::uuid
       else '31000000-0000-4000-8000-000000000012'::uuid end,
  sequence, 'SR-' || lpad(sequence::text, 3, '0')
from generate_series(1, 15) registered(sequence);
insert into public.guest_device_bindings(event_id, guest_id, device_key_hash) values
  ('31000000-0000-4000-8000-000000000010', '31000000-0000-4000-9000-000000000001', public._device_hash('safe-reset-device-1')),
  ('31000000-0000-4000-8000-000000000010', '31000000-0000-4000-9000-000000000002', public._device_hash('safe-reset-device-2'));
insert into public.bunker_state(event_id, sound_enabled, game_mode)
values ('31000000-0000-4000-8000-000000000010', false, 'test');
insert into public.questions(id, event_id, text, sort_order, enabled)
values ('31000000-0000-4000-8000-000000000020', '31000000-0000-4000-8000-000000000010', 'Сохранённая свадебная анкета?', 1, true);
insert into public.couple_preanswer_access(event_id, token_hash, consumed_at, finalized_at)
values ('31000000-0000-4000-8000-000000000010', 'safe-reset-access-hash', now(), now());
insert into public.couple_preanswers(event_id, question_id, choice)
values ('31000000-0000-4000-8000-000000000010', '31000000-0000-4000-8000-000000000020', 'liza');
insert into public.premiere_state(
  event_id, media_url, duration_seconds, status,
  playback_offset_seconds, countdown_seconds, countdown_sound_enabled
) values (
  '31000000-0000-4000-8000-000000000010',
  'https://example.test/premiere.mp4', 321.125, 'standby', 12.500, 17, false
);

select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000001', true);
select public.owner_prepare_bunker_v2(
  '31000000-0000-4000-8000-000000000010',
  '31000000-0000-4000-8000-000000000030'
);
update public.bunker_state
set status = 'active', started_at = now() - interval '5 minutes', duration_seconds = 999,
    phase = 'mission_a', phase_started_at = now() - interval '4 minutes',
    unlocked_at = now() - interval '3 minutes', global_game_state = 'BREAK',
    final_started_at = now() - interval '2 minutes', final_duration = 2345,
    bunker_revealed = true
where event_id = '31000000-0000-4000-8000-000000000010';

create temporary table bunker_safe_reset_baseline as
select
  state.run_nonce, to_jsonb(event) as event_snapshot,
  (select to_jsonb(owner_row) from auth.users owner_row where owner_row.id = event.owner_user_id) as owner_snapshot,
  current_setting('request.jwt.claim.sub', true) as session_claim,
  (select jsonb_agg(guest.id order by guest.id) from public.guests guest where guest.event_id = event.id) as guest_ids,
  (select jsonb_agg(to_jsonb(binding) order by binding.guest_id) from public.guest_device_bindings binding where binding.event_id = event.id) as binding_rows,
  (select jsonb_agg(carriage.id order by carriage.id) from public.carriages carriage where carriage.event_id = event.id) as carriage_ids,
  (select to_jsonb(access) from public.couple_preanswer_access access where access.event_id = event.id) as couple_access_snapshot,
  (select jsonb_agg(to_jsonb(answer) order by answer.question_id) from public.couple_preanswers answer where answer.event_id = event.id) as couple_answer_rows,
  (select to_jsonb(premiere) from public.premiere_state premiere where premiere.event_id = event.id) as premiere_snapshot,
  (select jsonb_agg(to_jsonb(question) order by question.id) from public.questions question where question.event_id = event.id) as question_rows
from public.events event
join public.bunker_state state on state.event_id = event.id
where event.id = '31000000-0000-4000-8000-000000000010';

select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select throws_ok(
  $$ select public.owner_reset_bunker_progress('31000000-0000-4000-8000-000000000010', '31000000-0000-4000-8000-000000000031') $$,
  '42501', 'owner access required',
  'an authenticated non-owner cannot reset Bunker progress'
);
reset role;

select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select throws_ok(
  $$ select public.owner_reset_bunker_progress('31000000-0000-4000-8000-000000000010', '31000000-0000-4000-8000-000000000032') $$,
  '42501', 'permission denied for function owner_reset_bunker_progress',
  'an anonymous caller cannot execute the owner reset RPC'
);
reset role;

select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select lives_ok(
  $$ select public.owner_reset_bunker_progress('31000000-0000-4000-8000-000000000010', '31000000-0000-4000-8000-000000000033') $$,
  'the authenticated event owner can reset populated Bunker progress'
);
reset role;

select ok(
  (select receipt.result->>'status' = 'reset'
      and receipt.result->>'state' = 'LOBBY'
      and (receipt.result->>'hadActiveRun')::boolean
      and receipt.result->>'runNonce' = baseline.run_nonce::text
   from public.bunker_progress_reset_receipts receipt
   cross join bunker_safe_reset_baseline baseline
   where receipt.event_id = '31000000-0000-4000-8000-000000000010'
     and receipt.command_id = '31000000-0000-4000-8000-000000000033'),
  'owner success stores the authoritative reset result receipt'
);
create temporary table bunker_safe_reset_first_result as
select result from public.bunker_progress_reset_receipts
where event_id = '31000000-0000-4000-8000-000000000010'
  and command_id = '31000000-0000-4000-8000-000000000033';
grant select on bunker_safe_reset_first_result to authenticated;
set local role authenticated;
select is(
  public.owner_reset_bunker_progress('31000000-0000-4000-8000-000000000010', '31000000-0000-4000-8000-000000000033'),
  (select result from bunker_safe_reset_first_result),
  'replaying the same reset command returns the stored result'
);
reset role;

select ok(
  (select state.status = 'idle' and state.started_at is null
      and state.duration_seconds = 1800 and state.phase = 'emergency'
      and state.phase_started_at is null and state.unlocked_at is null
      and state.run_nonce is null and state.global_game_state = 'LOBBY'
      and state.final_started_at is null and state.final_duration = 1800
      and not state.bunker_revealed and not state.sound_enabled
      and state.game_mode = 'test'
   from public.bunker_state state
   where state.event_id = '31000000-0000-4000-8000-000000000010'),
  'reset restores the ready LOBBY baseline and preserves Bunker configuration'
);
select ok(
  (select state.current_module = 'idle' and state.screen_mode = 'idle'
      and state.screen_payload_id is null and state.screen_payload is null
      and not state.screen_pinned
   from public.event_state state
   where state.event_id = '31000000-0000-4000-8000-000000000010'),
  'reset clears the active Bunker projector surface'
);
select is(
  (select sum(rows)::integer from (
    select count(*) rows from public.bunker_game_runs row join bunker_safe_reset_baseline baseline on baseline.run_nonce = row.run_nonce
    union all select count(*) from public.bunker_guest_profiles row join bunker_safe_reset_baseline baseline on baseline.run_nonce = row.run_nonce
    union all select count(*) from public.bunker_mission_instances row join bunker_safe_reset_baseline baseline on baseline.run_nonce = row.run_nonce
    union all select count(*) from public.bunker_mission_members row join bunker_safe_reset_baseline baseline on baseline.run_nonce = row.run_nonce
    union all select count(*) from public.bunker_mission_decisions row join bunker_safe_reset_baseline baseline on baseline.run_nonce = row.run_nonce
    union all select count(*) from public.bunker_ability_uses row join bunker_safe_reset_baseline baseline on baseline.run_nonce = row.run_nonce
    union all select count(*) from public.bunker_inventory_transfers row join bunker_safe_reset_baseline baseline on baseline.run_nonce = row.run_nonce
    union all select count(*) from public.bunker_archive_entitlements row join bunker_safe_reset_baseline baseline on baseline.run_nonce = row.run_nonce
    union all select count(*) from public.bunker_final_parameters row join bunker_safe_reset_baseline baseline on baseline.run_nonce = row.run_nonce
    union all select count(*) from public.bunker_command_receipts row join bunker_safe_reset_baseline baseline on baseline.run_nonce = row.run_nonce
    union all select count(*) from public.bunker_game_events row join bunker_safe_reset_baseline baseline on baseline.run_nonce = row.run_nonce
  ) remaining),
  0, 'reset removes the active run and all V2 projections'
);
select is(
  (select jsonb_agg(guest.id order by guest.id) from public.guests guest where guest.event_id = '31000000-0000-4000-8000-000000000010'),
  (select guest_ids from bunker_safe_reset_baseline), 'reset retains the exact guest IDs'
);
select is(
  (select jsonb_agg(to_jsonb(binding) order by binding.guest_id) from public.guest_device_bindings binding where binding.event_id = '31000000-0000-4000-8000-000000000010'),
  (select binding_rows from bunker_safe_reset_baseline), 'reset retains the exact device-binding rows'
);
select is(
  (select jsonb_agg(carriage.id order by carriage.id) from public.carriages carriage where carriage.event_id = '31000000-0000-4000-8000-000000000010'),
  (select carriage_ids from bunker_safe_reset_baseline), 'reset retains the exact carriage IDs'
);
select is(
  (select to_jsonb(access) from public.couple_preanswer_access access where access.event_id = '31000000-0000-4000-8000-000000000010'),
  (select couple_access_snapshot from bunker_safe_reset_baseline), 'reset retains the exact couple-preanswer access row'
);
select is(
  (select jsonb_agg(to_jsonb(answer) order by answer.question_id) from public.couple_preanswers answer where answer.event_id = '31000000-0000-4000-8000-000000000010'),
  (select couple_answer_rows from bunker_safe_reset_baseline), 'reset retains the exact couple-preanswer rows'
);
select is(
  (select to_jsonb(event) from public.events event where event.id = '31000000-0000-4000-8000-000000000010'),
  (select event_snapshot from bunker_safe_reset_baseline), 'reset retains the exact event and owner configuration'
);
select ok(
  (select to_jsonb(owner_row) from auth.users owner_row where owner_row.id = '31000000-0000-4000-8000-000000000001') = (select owner_snapshot from bunker_safe_reset_baseline)
    and current_setting('request.jwt.claim.sub', true) = (select session_claim from bunker_safe_reset_baseline),
  'reset retains the owner identity and authenticated session claim'
);
select is(
  (select to_jsonb(premiere) from public.premiere_state premiere where premiere.event_id = '31000000-0000-4000-8000-000000000010'),
  (select premiere_snapshot from bunker_safe_reset_baseline), 'reset retains representative Premiere configuration unchanged'
);
select is(
  (select jsonb_agg(to_jsonb(question) order by question.id) from public.questions question where question.event_id = '31000000-0000-4000-8000-000000000010'),
  (select question_rows from bunker_safe_reset_baseline), 'reset retains representative Quiz configuration unchanged'
);
select is(
  (select count(*)::integer from public.owner_action_log log
   where log.event_id = '31000000-0000-4000-8000-000000000010'
     and log.action = 'bunker_progress_reset'
     and log.payload->>'commandId' = '31000000-0000-4000-8000-000000000033'),
  1, 'an idempotent replay writes one owner audit action'
);

select * from finish();
rollback;
