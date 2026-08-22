begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select has_function(
  'public',
  'owner_bunker_v2_seed_test_guests',
  array['uuid','integer'],
  'rehearsal seeding function exists'
);

select ok(
  position('synthetic rehearsal seeding is blocked' in pg_get_functiondef('public.owner_bunker_v2_seed_test_guests(uuid,integer)'::regprocedure)) = 0,
  'real registrations no longer block rehearsal seeding'
);

select ok(
  position('v_test_count := p_count - v_real' in pg_get_functiondef('public.owner_bunker_v2_seed_test_guests(uuid,integer)'::regprocedure)) > 0,
  'requested rehearsal size is treated as real plus synthetic guests'
);

select ok(
  position('__BUNKER_TEST__' in pg_get_functiondef('public.owner_bunker_v2_seed_test_guests(uuid,integer)'::regprocedure)) > 0,
  'synthetic rehearsal guests remain explicitly marked'
);

select ok(
  position('max(g.ticket_sequence)' in pg_get_functiondef('public.owner_bunker_v2_seed_test_guests(uuid,integer)'::regprocedure)) > 0,
  'synthetic ticket sequence continues after real registrations'
);

select ok(
  position('owner_bunker_v2_seed_test_guests' in pg_get_functiondef('public.owner_prepare_bunker_v2_test(uuid,uuid)'::regprocedure)) > 0,
  'test preparation can automatically top up a too-small real guest list'
);

select * from finish();
rollback;
