begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select has_trigger(
  'public',
  'bunker_state',
  'bunker_v2_guard_final_open',
  'V2 final opening is guarded at the authoritative state boundary'
);

select ok(
  pg_get_functiondef('public._guard_bunker_v2_final_open()'::regprocedure)
    ~ $$old.global_game_state = 'FINAL_30'$$
  and pg_get_functiondef('public._guard_bunker_v2_final_open()'::regprocedure)
    ~ $$new.global_game_state = 'BUNKER_OPEN'$$,
  'guard applies only to the final-to-open transition'
);

select ok(
  pg_get_functiondef('public._guard_bunker_v2_final_open()'::regprocedure)
    ~ $$outcome->>'status'.*success$$
  and pg_get_functiondef('public._guard_bunker_v2_final_open()'::regprocedure)
    ~ 'emergency_open',
  'V2 final opens only after terminal success or explicit emergency open'
);

select ok(
  not has_function_privilege('anon','public._guard_bunker_v2_final_open()','EXECUTE')
  and not has_function_privilege('authenticated','public._guard_bunker_v2_final_open()','EXECUTE'),
  'final state guard cannot be invoked directly by API clients'
);

select * from finish();
rollback;
