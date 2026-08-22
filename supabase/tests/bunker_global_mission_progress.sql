begin;

create extension if not exists pgtap with schema extensions;

select plan(41);

select has_table(
  'public', 'bunker_global_mission_progress',
  'global M01-M06 wagon progress is stored independently of legacy A/B missions'
);
select has_function(
  'public', 'submit_guest_bunker_global_mission',
  array['text', 'text', 'text', 'jsonb'],
  'a device-authenticated RPC submits the current global mission'
);
select has_function(
  'public', 'owner_force_complete_bunker_global_mission',
  array['uuid', 'uuid', 'text'],
  'the owner has a scoped recovery command for one wagon and current mission'
);
select has_function(
  'public', 'owner_force_open_bunker',
  array['uuid', 'text', 'text'],
  'the owner has a separately confirmed final recovery command'
);
select ok(
  not has_table_privilege('anon', 'public.bunker_global_mission_progress', 'SELECT'),
  'anonymous clients cannot read mission progress rows directly'
);
select ok(
  has_function_privilege(
    'anon',
    'public.submit_guest_bunker_global_mission(text,text,text,jsonb)',
    'EXECUTE'
  ),
  'anonymous devices may call only the guarded guest RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.owner_force_complete_bunker_global_mission(uuid,uuid,text)',
    'EXECUTE'
  ),
  'anonymous devices cannot force mission completion'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.owner_force_open_bunker(uuid,text,text)',
    'EXECUTE'
  ),
  'anonymous devices cannot force the Bunker open'
);

insert into auth.users(id)
values ('00000000-0000-4000-8000-000000000901');

insert into public.events(id, slug, name, owner_user_id)
values (
  '00000000-0000-4000-8000-000000000902',
  'global-mission-runtime',
  'Global mission runtime',
  '00000000-0000-4000-8000-000000000901'
);

insert into public.event_state(event_id)
values ('00000000-0000-4000-8000-000000000902');

insert into public.carriages(
  id, event_id, number, label, accent_hex, visual_mark, sort_order, enabled
)
values
  ('00000000-0000-4000-8000-000000000911', '00000000-0000-4000-8000-000000000902', 1, 'ВАГОН №1', '#111111', 'I', 1, true),
  ('00000000-0000-4000-8000-000000000912', '00000000-0000-4000-8000-000000000902', 2, 'ВАГОН №2', '#222222', 'II', 2, true);

insert into public.guests(
  id, event_id, first_name, last_name, affiliation_type, carriage_id,
  ticket_sequence, ticket_number
)
values
  ('00000000-0000-4000-8000-000000000921', '00000000-0000-4000-8000-000000000902', 'Анна', 'Первая', 'common', '00000000-0000-4000-8000-000000000911', 1, 'GM-001'),
  ('00000000-0000-4000-8000-000000000922', '00000000-0000-4000-8000-000000000902', 'Борис', 'Первый', 'common', '00000000-0000-4000-8000-000000000911', 2, 'GM-002'),
  ('00000000-0000-4000-8000-000000000923', '00000000-0000-4000-8000-000000000902', 'Вера', 'Вторая', 'common', '00000000-0000-4000-8000-000000000912', 3, 'GM-003'),
  ('00000000-0000-4000-8000-000000000924', '00000000-0000-4000-8000-000000000902', 'Глеб', 'Второй', 'common', '00000000-0000-4000-8000-000000000912', 4, 'GM-004');

insert into public.guest_device_bindings(event_id, guest_id, device_key_hash)
values
  ('00000000-0000-4000-8000-000000000902', '00000000-0000-4000-8000-000000000921', public._device_hash('global-device-1')),
  ('00000000-0000-4000-8000-000000000902', '00000000-0000-4000-8000-000000000923', public._device_hash('global-device-2'));

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000901',
  true
);

select lives_ok(
  $$ select public.owner_prepare_bunker_game(
    '00000000-0000-4000-8000-000000000902', 'test'
  ) $$,
  'owner prepares the global mission run'
);
select lives_ok(
  $$ select public.owner_distribute_bunker_characters(
    '00000000-0000-4000-8000-000000000902'
  ) $$,
  'owner distributes the fictional profiles'
);
select lives_ok(
  $$ select public.owner_start_bunker(
    '00000000-0000-4000-8000-000000000902', 1800
  ) $$,
  'owner starts the shared Bunker runtime'
);
select lives_ok(
  $$ select public.owner_advance_bunker_game_state(
    '00000000-0000-4000-8000-000000000902', 'MISSION_01'
  ) $$,
  'owner opens Mission 01'
);

create temporary table selected_profiles(profile_id uuid, carriage_id uuid) on commit drop;
insert into selected_profiles(profile_id, carriage_id)
select (array_agg(profile.id order by profile.id))[1], guest.carriage_id
from public.bunker_guest_profiles profile
join public.guests guest on guest.id = profile.guest_id
where profile.event_id = '00000000-0000-4000-8000-000000000902'
group by guest.carriage_id;

create temporary table mission_result(result jsonb) on commit drop;
insert into mission_result(result)
select public.submit_guest_bunker_global_mission(
  'global-mission-runtime', 'global-device-1', 'MISSION_01',
  jsonb_build_object(
    'selectedProfileIds', jsonb_build_array((
      select profile_id from selected_profiles
      where carriage_id = '00000000-0000-4000-8000-000000000911'
    ))
  )
);

select is(
  (select result->>'changed' from mission_result), 'true',
  'the first valid Mission 01 action completes the wagon'
);
select is(
  jsonb_array_length(
    public.get_guest_bunker_runtime(
      'global-mission-runtime', 'global-device-1'
    )#>'{missionAction,requirements,selectableProfiles}'
  ),
  2,
  'guest runtime returns human profile choices for the current wagon'
);
select is(
  (select profile.character_status
   from public.bunker_guest_profiles profile
   where profile.id = (
     select profile_id from selected_profiles
     where carriage_id = '00000000-0000-4000-8000-000000000911'
   )),
  'excluded',
  'Mission 01 excludes the fictional profile without deleting the real guest'
);
select is(
  (select count(*)::integer from public.guests
   where event_id = '00000000-0000-4000-8000-000000000902'),
  4,
  'Mission 01 never removes wedding registrations'
);
select is(
  public.submit_guest_bunker_global_mission(
    'global-mission-runtime', 'global-device-1', 'MISSION_01',
    jsonb_build_object('selectedProfileIds', jsonb_build_array(
      (select profile_id from selected_profiles
       where carriage_id = '00000000-0000-4000-8000-000000000911')
    ))
  )->>'changed',
  'false',
  'repeating a completed action is idempotent'
);
select throws_ok(
  $$ select public.owner_advance_bunker_game_state(
    '00000000-0000-4000-8000-000000000902', 'BREAK'
  ) $$,
  '55000',
  'all active wagons must complete MISSION_01',
  'owner cannot skip an unfinished wagon'
);
select lives_ok(
  $$ select public.owner_force_complete_bunker_global_mission(
    '00000000-0000-4000-8000-000000000902',
    '00000000-0000-4000-8000-000000000912',
    'MISSION_01'
  ) $$,
  'owner recovery completes only the requested wagon'
);
select is(
  public.owner_advance_bunker_game_state(
    '00000000-0000-4000-8000-000000000902', 'BREAK'
  )->>'globalGameState',
  'BREAK',
  'owner advances after every enabled wagon is complete'
);

select public.owner_advance_bunker_game_state(
  '00000000-0000-4000-8000-000000000902', 'MISSION_02'
);
select is(
  public.submit_guest_bunker_global_mission(
    'global-mission-runtime', 'global-device-1', 'MISSION_02',
    '{"chronology":"Сначала скачок питания, затем маршрут перевели к объекту BK-17"}'::jsonb
  )->>'status',
  'completed',
  'Mission 02 accepts a nonempty chronology confirmation'
);
select public.owner_force_complete_bunker_global_mission(
  '00000000-0000-4000-8000-000000000902',
  '00000000-0000-4000-8000-000000000912', 'MISSION_02'
);
select public.owner_advance_bunker_game_state(
  '00000000-0000-4000-8000-000000000902', 'MISSION_03'
);

select is(
  public.submit_guest_bunker_global_mission(
    'global-mission-runtime', 'global-device-1', 'MISSION_03',
    '{"itemKeys":["water","radio"]}'::jsonb
  )->>'status',
  'completed',
  'Mission 03 accepts one to three available inventory keys'
);
select is(
  (select string_agg(item_key || ':' || status || ':' || quantity, ',' order by item_key)
   from public.bunker_inventory_lots
   where event_id = '00000000-0000-4000-8000-000000000902'
     and carriage_id = '00000000-0000-4000-8000-000000000911'
     and item_key in ('water', 'radio')),
  'radio:used:1,water:available:1',
  'Mission 03 consumes one unit per selected inventory key'
);

select public.owner_force_complete_bunker_global_mission(
  '00000000-0000-4000-8000-000000000902',
  '00000000-0000-4000-8000-000000000912', 'MISSION_03'
);
select public.owner_advance_bunker_game_state(
  '00000000-0000-4000-8000-000000000902', 'MISSION_04'
);
select is(
  public.submit_guest_bunker_global_mission(
    'global-mission-runtime', 'global-device-1', 'MISSION_04',
    '{"message":"Сектор 04 доступен через Тоннель B после обмена","partnerWagonIds":["00000000-0000-4000-8000-000000000912"]}'::jsonb
  )->>'status',
  'completed',
  'Mission 04 validates the planned partner wagon and exchange message'
);
select public.owner_force_complete_bunker_global_mission(
  '00000000-0000-4000-8000-000000000902',
  '00000000-0000-4000-8000-000000000912', 'MISSION_04'
);
select public.owner_advance_bunker_game_state(
  '00000000-0000-4000-8000-000000000902', 'MISSION_05'
);

select is(
  public.submit_guest_bunker_global_mission(
    'global-mission-runtime', 'global-device-1', 'MISSION_05',
    '{"routeChoice":"safe","itemKey":"generator"}'::jsonb
  )#>>'{submittedPayload,routeChoice}',
  'safe',
  'Mission 05 persists the human route choice'
);
select is(
  (select wagon.route_choice from public.bunker_wagon_state wagon
   where wagon.run_nonce = (
     select state.run_nonce from public.bunker_state state
     where state.event_id = '00000000-0000-4000-8000-000000000902'
   ) and wagon.carriage_id = '00000000-0000-4000-8000-000000000911'),
  'A',
  'the safe route updates the existing authoritative wagon state'
);

select public.owner_force_complete_bunker_global_mission(
  '00000000-0000-4000-8000-000000000902',
  '00000000-0000-4000-8000-000000000912', 'MISSION_05'
);
select public.owner_advance_bunker_game_state(
  '00000000-0000-4000-8000-000000000902', 'MISSION_06'
);

select is(
  public.submit_guest_bunker_global_mission(
    'global-mission-runtime', 'global-device-1', 'MISSION_06',
    '{"protocolConfirmed":true,"protocolCode":"4719"}'::jsonb
  )->>'status',
  'completed',
  'Mission 06 confirms the wagon protocol'
);
select ok(
  exists(
    select 1 from public.bunker_team_progress legacy
    where legacy.event_id = '00000000-0000-4000-8000-000000000902'
      and legacy.carriage_id = '00000000-0000-4000-8000-000000000911'
      and legacy.stage = 'mission_b'
      and legacy.completed_at is not null
      and legacy.reward_fragment is not null
  ),
  'Mission 06 bridges completion to the legacy final fragment'
);
select is(
  public.get_bunker_screen_state('global-mission-runtime')
    #>>'{missionProgress,completedWagons}',
  '1',
  'screen progress reports the current global mission independently'
);

select public.owner_force_complete_bunker_global_mission(
  '00000000-0000-4000-8000-000000000902',
  '00000000-0000-4000-8000-000000000912', 'MISSION_06'
);
select public.owner_advance_bunker_game_state(
  '00000000-0000-4000-8000-000000000902', 'STORY_BUNKER'
);
select public.owner_advance_bunker_game_state(
  '00000000-0000-4000-8000-000000000902', 'BREAK_BEFORE_FINAL'
);
select public.owner_advance_bunker_game_state(
  '00000000-0000-4000-8000-000000000902', 'FINAL_30'
);

update public.bunker_state
set started_at = clock_timestamp() - interval '50 minutes',
    final_started_at = clock_timestamp() - interval '10 minutes'
where event_id = '00000000-0000-4000-8000-000000000902';

select ok(
  (public.get_bunker_screen_state('global-mission-runtime')->>'remainingSeconds')::integer
    between 1198 and 1200,
  'FINAL_30 remaining time is derived from final_started_at, not the old emergency timer'
);
select is(
  public.owner_get_bunker_control(
    '00000000-0000-4000-8000-000000000902'
  )->>'unlocked',
  'false',
  'owner control reports that the final code has not unlocked the Bunker'
);

select is(
  public.submit_guest_bunker_final_code(
    'global-mission-runtime',
    'global-device-1',
    (select string_agg(legacy.reward_fragment, '' order by carriage.sort_order, carriage.number, carriage.id)
     from public.bunker_team_progress legacy
     join public.carriages carriage on carriage.id = legacy.carriage_id
     where legacy.event_id = '00000000-0000-4000-8000-000000000902'
       and legacy.stage = 'mission_b'
       and legacy.completed_at is not null)
  )->>'status',
  'unlocked',
  'the final code RPC accepts authoritative FINAL_30 and M06 fragments'
);
select is(
  public.owner_get_bunker_control(
    '00000000-0000-4000-8000-000000000902'
  )->>'unlocked',
  'true',
  'owner control reports the authoritative final-code unlock'
);

update public.bunker_state set unlocked_at = null
where event_id = '00000000-0000-4000-8000-000000000902';
select throws_ok(
  $$ select public.owner_advance_bunker_game_state(
    '00000000-0000-4000-8000-000000000902', 'BUNKER_OPEN'
  ) $$,
  '55000',
  'Bunker final code must unlock before opening',
  'normal owner opening is rejected until the final code unlocks the state'
);
update public.bunker_state set unlocked_at = clock_timestamp()
where event_id = '00000000-0000-4000-8000-000000000902';
select lives_ok(
  $$ select public.owner_advance_bunker_game_state(
    '00000000-0000-4000-8000-000000000902', 'BUNKER_OPEN'
  ) $$,
  'normal owner opening succeeds after the final code unlocks the state'
);
select is(
  public.get_bunker_screen_state('global-mission-runtime')->>'unlocked',
  'true',
  'BUNKER_OPEN always serializes as unlocked'
);
select is(
  public.submit_guest_bunker_final_code(
    'global-mission-runtime', 'global-device-1', '0000'
  )->>'status',
  'unlocked',
  'the final code RPC treats authoritative BUNKER_OPEN as already unlocked'
);

update public.bunker_state
set global_game_state = 'FINAL_30', unlocked_at = null, bunker_revealed = false
where event_id = '00000000-0000-4000-8000-000000000902';

select throws_ok(
  $$ select public.owner_force_open_bunker(
    '00000000-0000-4000-8000-000000000902',
    'Сбой',
    'ОТКРЫТЬ БУНКЕР ПРИНУДИТЕЛЬНО'
  ) $$,
  '22023',
  'recovery reason must contain at least 12 characters',
  'forced opening rejects a missing or short operational reason'
);
select throws_ok(
  $$ select public.owner_force_open_bunker(
    '00000000-0000-4000-8000-000000000902',
    'Финальный телефон не отвечает',
    'ОТКРЫТЬ БУНКЕР'
  ) $$,
  '22023',
  'invalid forced Bunker confirmation',
  'forced opening requires the exact destructive confirmation phrase'
);
select is(
  public.owner_force_open_bunker(
    '00000000-0000-4000-8000-000000000902',
    'Финальный телефон не отвечает',
    'ОТКРЫТЬ БУНКЕР ПРИНУДИТЕЛЬНО'
  )->>'globalGameState',
  'BUNKER_OPEN',
  'the confirmed owner recovery opens the Bunker'
);
select ok(
  exists (
    select 1
    from public.owner_action_log log
    where log.event_id = '00000000-0000-4000-8000-000000000902'
      and log.owner_user_id = '00000000-0000-4000-8000-000000000901'
      and log.action = 'bunker_force_open_recovery'
      and log.payload->>'reason' = 'Финальный телефон не отвечает'
      and log.payload->>'previousState' = 'FINAL_30'
      and log.payload->>'globalGameState' = 'BUNKER_OPEN'
  ),
  'forced opening records owner, reason and state transition in the audit log'
);

select * from finish();
rollback;
