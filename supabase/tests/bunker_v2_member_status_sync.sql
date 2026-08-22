begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select has_trigger(
  'public',
  'bunker_mission_instances',
  'bunker_v2_sync_member_status',
  'mission instance completion synchronizes frozen member status'
);

select ok(
  pg_get_functiondef('public._sync_bunker_v2_member_status()'::regprocedure)
    ~ $$new.status = 'completed'$$
  and pg_get_functiondef('public._sync_bunker_v2_member_status()'::regprocedure)
    ~ $$member_status = 'completed'$$,
  'completed mission instances mark their frozen members completed'
);

select ok(
  pg_get_functiondef('public._sync_bunker_v2_member_status()'::regprocedure)
    ~ $$new.status = 'expired'$$
  and pg_get_functiondef('public._sync_bunker_v2_member_status()'::regprocedure)
    ~ $$member_status = 'expired'$$,
  'expired mission instances mark their frozen members expired'
);

select * from finish();
rollback;
