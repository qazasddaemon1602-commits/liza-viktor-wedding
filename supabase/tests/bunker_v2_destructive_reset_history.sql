begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select has_function(
  'public',
  '_delete_bunker_game_run',
  array['uuid','uuid'],
  'destructive reset has one dependency-safe run teardown helper'
);

select ok(
  pg_get_functiondef('public._clear_bunker_game_run_on_reset()'::regprocedure)
    ~ '_delete_bunker_game_run',
  'normal progress reset delegates current-run teardown to the shared helper'
);

select ok(
  pg_get_functiondef('public.owner_bunker_v2_reset_game_and_registrations(uuid,text)'::regprocedure)
    ~ '_delete_bunker_game_run'
  and pg_get_functiondef('public.owner_bunker_v2_reset_game_and_registrations(uuid,text)'::regprocedure)
    ~ 'from public\.bunker_game_runs'
  and pg_get_functiondef('public.owner_bunker_v2_reset_game_and_registrations(uuid,text)'::regprocedure)
    !~ 'contract_version = 2',
  'game plus registrations reset removes every remaining historical Bunker run for the event'
);

select ok(
  pg_get_functiondef('public.owner_reset_event_test_data(uuid,text)'::regprocedure)
    ~ '_delete_bunker_game_run'
  and pg_get_functiondef('public.owner_reset_event_test_data(uuid,text)'::regprocedure)
    ~ 'from public\.bunker_game_runs'
  and pg_get_functiondef('public.owner_reset_event_test_data(uuid,text)'::regprocedure)
    !~ 'contract_version = 2',
  'full evening reset removes every remaining historical Bunker run for the event'
);

select ok(
  not has_function_privilege('anon','public._delete_bunker_game_run(uuid,uuid)','EXECUTE')
  and not has_function_privilege('authenticated','public._delete_bunker_game_run(uuid,uuid)','EXECUTE'),
  'run teardown helper is not callable by API clients'
);

select * from finish();
rollback;
