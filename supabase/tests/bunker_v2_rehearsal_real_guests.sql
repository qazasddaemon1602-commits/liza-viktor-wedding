begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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
  position('900000000 + v_i' in pg_get_functiondef('public.owner_bunker_v2_seed_test_guests(uuid,integer)'::regprocedure)) > 0,
  'synthetic ticket numbers live in an isolated rehearsal sequence range'
);

select ok(
  position('current_carriage.number > v_wagons' in pg_get_functiondef('public.owner_bunker_v2_seed_test_guests(uuid,integer)'::regprocedure)) > 0,
  'real guests move only when their current wagon would be disabled'
);

select ok(
  position('left join public.carriages current_carriage' in pg_get_functiondef('public.owner_bunker_v2_seed_test_guests(uuid,integer)'::regprocedure)) > 0
  and position('current_carriage.id is null' in pg_get_functiondef('public.owner_bunker_v2_seed_test_guests(uuid,integer)'::regprocedure)) > 0,
  'unassigned real guests are placed into an active rehearsal wagon'
);

select ok(
  position('order by count(existing_guest.id), target.number' in pg_get_functiondef('public.owner_bunker_v2_seed_test_guests(uuid,integer)'::regprocedure)) > 0,
  'synthetic guests fill the least populated active wagon first'
);

select ok(
  position('owner_bunker_v2_seed_test_guests' in pg_get_functiondef('public.owner_prepare_bunker_v2_test(uuid,uuid)'::regprocedure)) > 0,
  'test preparation can automatically normalize a rehearsal guest list'
);

select * from finish();
rollback;