begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

select ok(
  exists(
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'owner_reset_event_test_data'
      and pg_get_function_identity_arguments(p.oid) = 'p_event_id uuid, p_confirmation text'
  ),
  'owner-only test reset RPC exists with explicit confirmation contract'
);

select ok(
  not has_function_privilege('anon', 'public.owner_reset_event_test_data(uuid,text)', 'EXECUTE'),
  'anonymous clients cannot reset event data'
);

select ok(
  has_function_privilege('authenticated', 'public.owner_reset_event_test_data(uuid,text)', 'EXECUTE'),
  'authenticated owner session can invoke reset RPC'
);

select ok(
  position('delete from public.guests' in lower(pg_get_functiondef('public.owner_reset_event_test_data(uuid,text)'::regprocedure))) > 0,
  'reset clears registered guests and their cascading runtime identity data'
);

select ok(
  position('delete from public.quiz_votes' in lower(pg_get_functiondef('public.owner_reset_event_test_data(uuid,text)'::regprocedure))) > 0,
  'reset clears guest quiz votes'
);

select ok(
  position('delete from public.final_five_answers' in lower(pg_get_functiondef('public.owner_reset_event_test_data(uuid,text)'::regprocedure))) > 0,
  'reset clears live final-five answers'
);

select ok(
  position('delete from public.mk_matches' in lower(pg_get_functiondef('public.owner_reset_event_test_data(uuid,text)'::regprocedure))) > 0
  and position('delete from public.mk_registrations' in lower(pg_get_functiondef('public.owner_reset_event_test_data(uuid,text)'::regprocedure))) > 0,
  'reset clears Mortal Kombat rehearsal bracket and registrations'
);

select ok(
  position('delete from public.mk_tournaments' in lower(pg_get_functiondef('public.owner_reset_event_test_data(uuid,text)'::regprocedure))) = 0,
  'reset preserves the MK tournament configuration row'
);

select ok(
  position('update public.bunker_state' in lower(pg_get_functiondef('public.owner_reset_event_test_data(uuid,text)'::regprocedure))) > 0,
  'reset explicitly clears active bunker runtime state'
);

select ok(
  position('started_at = null' in lower(pg_get_functiondef('public.owner_reset_event_test_data(uuid,text)'::regprocedure))) > 0,
  'reset clears bunker timer anchor so no projector can resume the rehearsal countdown'
);

select ok(
  position('delete from public.couple_preanswers' in lower(pg_get_functiondef('public.owner_reset_event_test_data(uuid,text)'::regprocedure))) = 0,
  'reset never deletes preserved couple preanswers'
);

select ok(
  position('delete from public.couple_preanswer_access' in lower(pg_get_functiondef('public.owner_reset_event_test_data(uuid,text)'::regprocedure))) = 0,
  'reset never deletes couple preanswer finalization/access status'
);

select ok(
  position('next_ticket_sequence = 1' in lower(pg_get_functiondef('public.owner_reset_event_test_data(uuid,text)'::regprocedure))) > 0,
  'reset restarts ticket numbering from one'
);

select ok(
  position('media_url = null' in lower(pg_get_functiondef('public.owner_reset_event_test_data(uuid,text)'::regprocedure))) = 0,
  'reset preserves configured premiere media URL'
);

select ok(
  coalesce('search_path=""' = any(
    (select proconfig from pg_proc where oid = 'public.owner_reset_event_test_data(uuid,text)'::regprocedure)
  ), false),
  'the owner reset RPC has an immutable empty search path'
);

select ok(
  (select prosecdef from pg_proc where oid = 'public._clear_bunker_game_run_on_reset()'::regprocedure)
    and coalesce('search_path=""' = any(
      (select proconfig from pg_proc where oid = 'public._clear_bunker_game_run_on_reset()'::regprocedure)
    ), false),
  'the internal Bunker reset trigger is a hardened definer'
);

select ok(
  not has_function_privilege('anon', 'public._clear_bunker_game_run_on_reset()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public._clear_bunker_game_run_on_reset()', 'EXECUTE'),
  'API clients cannot invoke the internal reset trigger directly'
);

select ok(
  pg_get_functiondef('public._clear_bunker_game_run_on_reset()'::regprocedure)
    ~ 'run_nonce = old\.run_nonce',
  'Bunker reset cleanup is scoped to the run being cleared'
);

select ok(
  pg_get_functiondef('public._clear_bunker_game_run_on_reset()'::regprocedure)
      !~ 'delete from public\.(guests|guest_device_bindings|carriages|couple_preanswers|couple_preanswer_access)',
  'Bunker-only cleanup preserves guest identity, carriages and couple preanswers'
);

select * from finish();
rollback;
