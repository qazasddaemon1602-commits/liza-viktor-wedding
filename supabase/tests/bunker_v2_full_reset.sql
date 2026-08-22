begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select ok(
  pg_get_functiondef('public.owner_reset_event_test_data(uuid,text)'::regprocedure)
    ~ 'owner_reset_bunker_progress',
  'full rehearsal reset clears the authoritative V2 run before deleting guests'
);

select ok(
  pg_get_functiondef('public.owner_reset_event_test_data(uuid,text)'::regprocedure)
    ~ '_owner_reset_event_test_data_without_v2',
  'full reset delegates the existing non-V2 cleanup after run teardown'
);

select ok(
  not has_function_privilege(
    'anon',
    'public._owner_reset_event_test_data_without_v2(uuid,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public._owner_reset_event_test_data_without_v2(uuid,text)',
    'EXECUTE'
  ),
  'the legacy full-reset implementation is private after wrapping'
);

select ok(
  pg_get_functiondef('public.owner_reset_event_test_data(uuid,text)'::regprocedure)
    ~ $$coalesce\(p_confirmation, ''\) <> 'СБРОСИТЬ'$$,
  'full reset validates null and incorrect destructive confirmations before V2 teardown'
);

select ok(
  pg_get_functiondef('public._owner_reset_event_test_data_without_v2(uuid,text)'::regprocedure)
    !~ 'delete from public\.couple_preanswers',
  'full reset continues to preserve couple preanswers'
);

select * from finish();
rollback;
