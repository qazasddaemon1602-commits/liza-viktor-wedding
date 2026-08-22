begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

select ok(
  pg_get_functiondef('public.get_guest_bunker_v2_runtime(text,text)'::regprocedure)
    ~ $$status in \('planned', 'active', 'completed'\)$$,
  'guest runtime keeps the current completed wagon instance visible until the global stage advances'
);

select ok(
  pg_get_functiondef('public.get_guest_bunker_v2_runtime(text,text)'::regprocedure)
    ~ 'currentMission',
  'guest runtime still returns the authoritative current mission snapshot'
);

select * from finish();
rollback;
