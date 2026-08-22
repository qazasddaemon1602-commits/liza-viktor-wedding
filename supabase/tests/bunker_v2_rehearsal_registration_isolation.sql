begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select ok(
  position($needle$coalesce(affiliation_detail, '') <> '__BUNKER_TEST__'$needle$ in pg_get_functiondef(
    'public.register_guest(text,text,text,text,text,text,boolean)'::regprocedure
  )) > 0,
  'real registration capacity excludes synthetic rehearsal passengers'
);

select ok(
  position($needle$coalesce(g.affiliation_detail, '') <> '__BUNKER_TEST__'$needle$ in pg_get_functiondef(
    'public.register_guest(text,text,text,text,text,text,boolean)'::regprocedure
  )) > 0,
  'real wagon balancing excludes synthetic rehearsal passengers'
);

select ok(
  position('900000000 + v_i' in pg_get_functiondef(
    'public.owner_bunker_v2_seed_test_guests(uuid,integer)'::regprocedure
  )) > 0,
  'synthetic passengers use a reserved rehearsal ticket sequence range'
);

select ok(
  position('next_ticket_sequence =' in pg_get_functiondef(
    'public.owner_bunker_v2_seed_test_guests(uuid,integer)'::regprocedure
  )) = 0,
  'rehearsal seeding never advances the real ticket counter'
);

select ok(
  position('v_guest_count > 40' in pg_get_functiondef(
    'public.owner_prepare_bunker_v2_test(uuid,uuid)'::regprocedure
  )) > 0,
  'test preparation detects a roster that grew beyond forty after real arrivals'
);

select ok(
  position('owner_bunker_v2_seed_test_guests(p_event_id, 40)' in pg_get_functiondef(
    'public.owner_prepare_bunker_v2_test(uuid,uuid)'::regprocedure
  )) > 0,
  'test preparation can normalize synthetic rows back to forty total passengers'
);

select ok(
  position($needle$'realGuestCount'$needle$ in pg_get_functiondef(
    'public.get_owner_bunker_v2_test_state(uuid)'::regprocedure
  )) > 0,
  'owner rehearsal state reports real guest count separately'
);

select ok(
  position($needle$coalesce(g.affiliation_detail, '') <> '__BUNKER_TEST__'$needle$ in pg_get_functiondef(
    'public.get_owner_bunker_v2_test_state(uuid)'::regprocedure
  )) > 0,
  'owner rehearsal state derives the real count from the rehearsal marker'
);

select * from finish();
rollback;