begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

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

select * from finish();
rollback;
