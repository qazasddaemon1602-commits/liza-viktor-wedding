begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

select ok(
  pg_get_functiondef('public.get_mk_tournament_state(text,text)'::regprocedure)
    ~* $$_normalize_mk_current_flags$$,
  'public MK projection always normalizes the current flag'
);

select ok(
  pg_get_functiondef('public.owner_get_mk_control(uuid)'::regprocedure)
    ~* $$_normalize_mk_current_flags$$,
  'owner MK projection always normalizes the current flag'
);

select ok(
  pg_get_functiondef('public.owner_finalize_mk_draw(uuid)'::regprocedure)
    ~* $$current_match_id\s*=\s*v_first_ready_match_id$$,
  'draw finalization selects its first real ready fight'
);

select ok(
  pg_get_functiondef('public.owner_finalize_mk_draw(uuid)'::regprocedure)
    ~* $$m\.player1_guest_id is not null\s+and m\.player2_guest_id is not null$$,
  'automatic current fight can never select a bye'
);

select ok(
  pg_get_functiondef('public.owner_finalize_mk_draw(uuid)'::regprocedure)
    ~* $$order by\s+case m\.round[\s\S]+m\.position\s+limit 1$$,
  'automatic current fight selection is deterministic'
);

select * from finish();
rollback;
