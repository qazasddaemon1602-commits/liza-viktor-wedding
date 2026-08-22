begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select ok(
  pg_get_functiondef('public._guard_bunker_v2_final_open()'::regprocedure)
    ~ 'transitionedByOwner',
  'legacy direct owner transition is recognized explicitly at the final boundary'
);

select ok(
  pg_get_functiondef('public._guard_bunker_v2_final_open()'::regprocedure)
    ~ $$'status','emergency_open'$$
  and pg_get_functiondef('public._guard_bunker_v2_final_open()'::regprocedure)
    ~ 'finishTimeSeconds',
  'legacy direct final transition is classified as emergency open instead of an untracked success'
);

select ok(
  pg_get_functiondef('public._guard_bunker_v2_final_open()'::regprocedure)
    ~ 'bunker_final_parameters'
  and pg_get_functiondef('public._guard_bunker_v2_final_open()'::regprocedure)
    ~ $$source_kind='owner_emergency'$$,
  'compatibility emergency open resolves final parameters through the same emergency semantics'
);

select * from finish();
rollback;
