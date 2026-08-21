begin;

create extension if not exists pgtap with schema extensions;

select plan(34);

select has_function(
  'public', 'owner_advance_bunker_game_state', array['uuid', 'text'],
  'only the owner RPC advances the global Bunker state'
);
select has_function(
  'public', 'owner_get_bunker_characters', array['uuid'],
  'owner reads current-run character story states through an RPC'
);
select has_function(
  'public', 'owner_set_bunker_character_status', array['uuid', 'uuid', 'text'],
  'owner persists active/saved/excluded character story states through an RPC'
);
select has_function(
  'public', '_bunker_current_mission', array['uuid', 'text'],
  'one database helper derives currentMission from the authoritative run plan'
);
select has_function(
  'public', '_refresh_bunker_run_guest_plan', array['uuid', 'uuid'],
  'late registration refreshes only guest-sized run-plan data'
);
select has_function(
  'public', '_bunker_character_matches_category', array['text', 'text'],
  'SQL character quotas share one tag-aware category classifier'
);
select is(
  public._bunker_character_matches_category('photographer', 'analytical'),
  false,
  'the memory-only photographer does not satisfy the analytical quota'
);
select is(
  public._bunker_character_matches_category('lawyer', 'analytical'),
  true,
  'an analysis-tagged profile satisfies the analytical quota'
);

select ok(
  not has_function_privilege(
    'anon', 'public.owner_advance_bunker_game_state(uuid, text)', 'EXECUTE'
  ),
  'anonymous guests cannot advance the global state'
);
select ok(
  not has_function_privilege(
    'anon', 'public.owner_set_bunker_character_status(uuid, uuid, text)', 'EXECUTE'
  ),
  'anonymous guests cannot rewrite character story states'
);
select ok(
  has_function_privilege(
    'authenticated', 'public.owner_advance_bunker_game_state(uuid, text)', 'EXECUTE'
  ),
  'authenticated owner sessions can invoke the guarded transition RPC'
);

insert into auth.users(id)
values ('00000000-0000-4000-8000-000000000811');

insert into public.events(id, slug, name, owner_user_id)
values (
  '00000000-0000-4000-8000-000000000812',
  'phase-2-authoritative-runtime',
  'Phase 2 authoritative runtime',
  '00000000-0000-4000-8000-000000000811'
);

insert into public.event_state(event_id)
values ('00000000-0000-4000-8000-000000000812');

insert into public.carriages(
  id, event_id, number, label, accent_hex, visual_mark, sort_order, enabled
)
values
  ('00000000-0000-4000-8000-000000000821', '00000000-0000-4000-8000-000000000812', 1, 'ВАГОН №1', '#111111', 'I', 1, true),
  ('00000000-0000-4000-8000-000000000822', '00000000-0000-4000-8000-000000000812', 2, 'ВАГОН №2', '#222222', 'II', 2, true);

insert into public.guests(
  id, event_id, first_name, last_name, affiliation_type, carriage_id,
  ticket_sequence, ticket_number
)
select
  ('00000000-0000-4000-8000-' || lpad(sequence::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-000000000812',
  'Гость', sequence::text, 'common',
  case when mod(sequence, 2) = 1
    then '00000000-0000-4000-8000-000000000821'::uuid
    else '00000000-0000-4000-8000-000000000822'::uuid
  end,
  sequence, 'P2-' || lpad(sequence::text, 3, '0')
from generate_series(1, 15) as registered(sequence);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000811',
  true
);

select lives_ok(
  $$ select public.owner_prepare_bunker_game(
    '00000000-0000-4000-8000-000000000812', 'test'
  ) $$,
  'a 15-player run is prepared on the authoritative server path'
);
select lives_ok(
  $$ select public.owner_distribute_bunker_characters(
    '00000000-0000-4000-8000-000000000812'
  ) $$,
  'the 15-player run receives stable characters before gameplay'
);
select is(
  (select count(distinct profile.character_profile_key)::integer
   from public.bunker_guest_profiles profile
   where profile.event_id = '00000000-0000-4000-8000-000000000812'),
  15,
  'the SQL assignment uses every selected profile once before any repeat'
);
select lives_ok(
  $$ select public.owner_start_bunker(
    '00000000-0000-4000-8000-000000000812', 1800
  ) $$,
  'the prepared run becomes active without replacing its run nonce'
);

create temporary table phase_2_transition(result jsonb) on commit drop;
insert into phase_2_transition(result)
select public.owner_advance_bunker_game_state(
  '00000000-0000-4000-8000-000000000812', 'MISSION_01'
);

select is(
  (select result->>'globalGameState' from phase_2_transition),
  'MISSION_01',
  'the owner transition persists the next global state'
);
select is(
  (select result#>>'{currentMission,state}' from phase_2_transition),
  'MISSION_01',
  'the transition response exposes the matching current mission'
);
select is(
  public.owner_get_bunker_control(
    '00000000-0000-4000-8000-000000000812'
  )->>'globalGameState',
  'MISSION_01',
  'owner control restores the authoritative global state'
);
select is(
  public.owner_get_bunker_control(
    '00000000-0000-4000-8000-000000000812'
  )#>>'{currentMission,state}',
  'MISSION_01',
  'owner control restores the matching current mission'
);

insert into public.guests(
  id, event_id, first_name, last_name, affiliation_type, carriage_id,
  ticket_sequence, ticket_number
)
values (
  '00000000-0000-4000-8000-000000000016',
  '00000000-0000-4000-8000-000000000812',
  'Поздний', 'Гость', 'common',
  '00000000-0000-4000-8000-000000000822',
  16, 'P2-016'
);

select is(
  (select guest_count from public.bunker_game_runs
   where event_id = '00000000-0000-4000-8000-000000000812'),
  16,
  'late registration refreshes the frozen run guest count'
);
select is(
  (select sum((mission.value->>'wagonSize')::integer)::integer
   from public.bunker_game_runs run
   cross join lateral jsonb_array_elements(run.plan->'mission01') mission(value)
   where run.event_id = '00000000-0000-4000-8000-000000000812'),
  16,
  'late registration recalculates Mission 01 wagon sizes without a new run'
);

insert into public.guests(
  id, event_id, first_name, last_name, affiliation_type, carriage_id,
  ticket_sequence, ticket_number
)
select
  ('00000000-0000-4000-8000-' || lpad(sequence::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-000000000812',
  'Поздний', sequence::text, 'common',
  case when mod(sequence, 2) = 1
    then '00000000-0000-4000-8000-000000000821'::uuid
    else '00000000-0000-4000-8000-000000000822'::uuid
  end,
  sequence, 'P2-' || lpad(sequence::text, 3, '0')
from generate_series(17, 40) as registered(sequence);

select is(
  (select guest_count from public.bunker_game_runs
   where event_id = '00000000-0000-4000-8000-000000000812'),
  40,
  'late registration keeps the frozen run count correct through forty players'
);
select is(
  (select sum((mission.value->>'wagonSize')::integer)::integer
   from public.bunker_game_runs run
   cross join lateral jsonb_array_elements(run.plan->'mission01') mission(value)
   where run.event_id = '00000000-0000-4000-8000-000000000812'),
  40,
  'Mission 01 wagon sizing stays correct for every late join through forty players'
);

select is(
  public.owner_set_bunker_character_status(
    '00000000-0000-4000-8000-000000000812',
    '00000000-0000-4000-8000-000000000016',
    'saved'
  )->>'characterStatus',
  'saved',
  'owner transition returns the persisted saved story state'
);
select is(
  (select character_status
   from public.bunker_guest_profiles
   where event_id = '00000000-0000-4000-8000-000000000812'
     and guest_id = '00000000-0000-4000-8000-000000000016'),
  'saved',
  'saved is authoritative in the current run profile'
);
select ok(
  (public.owner_get_bunker_characters(
    '00000000-0000-4000-8000-000000000812'
  )->'characters') @> jsonb_build_array(jsonb_build_object(
    'guestId', '00000000-0000-4000-8000-000000000016'::uuid,
    'characterStatus', 'saved'
  )),
  'owner character read returns the current run story state'
);
select throws_ok(
  $$ select public.owner_set_bunker_character_status(
    '00000000-0000-4000-8000-000000000812',
    '00000000-0000-4000-8000-000000000016',
    'failed'
  ) $$,
  '22023',
  'invalid Bunker character status',
  'the database preserves the approved active/saved/excluded enum exactly'
);
select throws_ok(
  $$ select public.owner_set_bunker_character_status(
    '00000000-0000-4000-8000-000000000812',
    '00000000-0000-4000-8000-000000000016',
    null
  ) $$,
  '22023',
  'invalid Bunker character status',
  'a missing character status cannot bypass the approved enum'
);

insert into public.guest_device_bindings(event_id, guest_id, device_key_hash)
values (
  '00000000-0000-4000-8000-000000000812',
  '00000000-0000-4000-8000-000000000016',
  public._device_hash('phase-2-late-device')
);

update public.bunker_game_runs run
set guest_count = 15,
    plan = jsonb_set(
      jsonb_set(run.plan, '{guestCount}', '15'::jsonb, true),
      '{mission01}',
      jsonb_build_array(
        jsonb_build_object(
          'wagonId', '00000000-0000-4000-8000-000000000821'::uuid,
          'wagonSize', 8,
          'exclusionCount', 2
        ),
        jsonb_build_object(
          'wagonId', '00000000-0000-4000-8000-000000000822'::uuid,
          'wagonSize', 7,
          'exclusionCount', 2
        )
      ),
      true
    )
where run.event_id = '00000000-0000-4000-8000-000000000812';

select is(
  public.get_guest_bunker_runtime(
    'phase-2-authoritative-runtime', 'phase-2-late-device'
  )#>>'{currentMission,state}',
  'MISSION_01',
  'guest runtime restores currentMission from the authoritative global state'
);
select is(
  public.get_guest_bunker_runtime(
    'phase-2-authoritative-runtime', 'phase-2-late-device'
  )#>>'{guest,joinedLate}',
  'true',
  'the active late join remains marked without blocking the current mission'
);
select is(
  (select guest_count from public.bunker_game_runs
   where event_id = '00000000-0000-4000-8000-000000000812'),
  40,
  'runtime repairs a stale plan even when the late guest profile already exists'
);
select is(
  (select sum((mission.value->>'wagonSize')::integer)::integer
   from public.bunker_game_runs run
   cross join lateral jsonb_array_elements(run.plan->'mission01') mission(value)
   where run.event_id = '00000000-0000-4000-8000-000000000812'),
  40,
  'runtime repairs stale Mission 01 sizing for an existing late profile'
);

select throws_ok(
  $$ select public.owner_advance_bunker_game_state(
    '00000000-0000-4000-8000-000000000812', 'MISSION_04'
  ) $$,
  '22023',
  'invalid Bunker global state transition: MISSION_01 -> MISSION_04',
  'the state machine rejects skipped stages'
);
select throws_ok(
  $$ select public.owner_advance_bunker_game_state(
    '00000000-0000-4000-8000-000000000812', null
  ) $$,
  '22023',
  'invalid Bunker global state transition: MISSION_01 -> <NULL>',
  'a missing next state cannot bypass the authoritative state machine'
);

select * from finish();
rollback;
