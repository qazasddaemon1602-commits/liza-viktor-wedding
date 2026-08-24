begin;

create extension if not exists pgtap with schema extensions;

select plan(1);

insert into auth.users(id)
values ('00000000-0000-4000-8000-000000000971');

insert into public.events(id, slug, name, owner_user_id)
values (
  '00000000-0000-4000-8000-000000000972',
  'bunker-active-wagon-screen',
  'Bunker active wagon screen',
  '00000000-0000-4000-8000-000000000971'
);

insert into public.carriages(
  id, event_id, number, label, accent_hex, visual_mark, sort_order, enabled
)
values
  ('00000000-0000-4000-8000-000000000981', '00000000-0000-4000-8000-000000000972', 1, 'ВАГОН №1', '#111111', 'I', 1, true),
  ('00000000-0000-4000-8000-000000000982', '00000000-0000-4000-8000-000000000972', 2, 'ВАГОН №2', '#222222', 'II', 2, true),
  ('00000000-0000-4000-8000-000000000983', '00000000-0000-4000-8000-000000000972', 3, 'ВАГОН №3', '#333333', 'III', 3, true),
  ('00000000-0000-4000-8000-000000000984', '00000000-0000-4000-8000-000000000972', 4, 'ВАГОН №4', '#444444', 'IV', 4, true);

insert into public.bunker_game_runs(
  run_nonce, event_id, wagon_count, guest_count, plan, contract_version, plan_version
)
values (
  '00000000-0000-4000-8000-000000000973',
  '00000000-0000-4000-8000-000000000972',
  2,
  0,
  jsonb_build_object(
    'activeWagonIds', jsonb_build_array(
      '00000000-0000-4000-8000-000000000981'::uuid,
      '00000000-0000-4000-8000-000000000982'::uuid
    )
  ),
  2,
  1
);

insert into public.bunker_state(
  event_id, status, started_at, run_nonce, global_game_state
)
values (
  '00000000-0000-4000-8000-000000000972',
  'active',
  clock_timestamp(),
  '00000000-0000-4000-8000-000000000973',
  'BREAK'
);

select is(
  public.get_bunker_screen_state('bunker-active-wagon-screen')->'teams',
  jsonb_build_array(
    jsonb_build_object(
      'carriageNumber', 1,
      'label', 'ВАГОН №1',
      'missionAComplete', false,
      'missionBComplete', false,
      'currentMissionComplete', false
    ),
    jsonb_build_object(
      'carriageNumber', 2,
      'label', 'ВАГОН №2',
      'missionAComplete', false,
      'missionBComplete', false,
      'currentMissionComplete', false
    )
  ),
  'the public Bunker screen uses the frozen two-wagon run plan, not all enabled carriages'
);

select * from finish();
rollback;
