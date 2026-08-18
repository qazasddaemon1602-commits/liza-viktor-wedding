begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_set_current_mk_match'), 'owner can select the current fight');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_record_mk_winner'), 'owner can record a fight winner');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_undo_mk_result'), 'owner can undo a fight result');

select ok(not has_function_privilege('anon', 'public.owner_set_current_mk_match(uuid)', 'EXECUTE'), 'anonymous cannot select current MK fight');
select ok(not has_function_privilege('anon', 'public.owner_record_mk_winner(uuid,uuid,boolean)', 'EXECUTE'), 'anonymous cannot record MK winner');
select ok(not has_function_privilege('anon', 'public.owner_undo_mk_result(uuid,boolean)', 'EXECUTE'), 'anonymous cannot undo MK result');

select ok(
  position('winner_guest_id' in lower(pg_get_functiondef('public.owner_record_mk_winner(uuid,uuid,boolean)'::regprocedure))) > 0,
  'winner RPC mutates authoritative match result'
);
select ok(
  position('affected' in lower(pg_get_functiondef('public.owner_record_mk_winner(uuid,uuid,boolean)'::regprocedure))) > 0,
  'winner correction computes downstream impact'
);
select ok(
  position('clear_completed_downstream' in lower(pg_get_functiondef('public.owner_record_mk_winner(uuid,uuid,boolean)'::regprocedure))) > 0,
  'destructive downstream clearing requires explicit flag'
);
select ok(
  position('champion_guest_id' in lower(pg_get_functiondef('public.owner_record_mk_winner(uuid,uuid,boolean)'::regprocedure))) > 0,
  'final winner becomes tournament champion'
);
select ok(
  position('winner_guest_id = null' in lower(pg_get_functiondef('public.owner_undo_mk_result(uuid,boolean)'::regprocedure))) > 0,
  'undo clears the authoritative winner'
);

select * from finish();
rollback;
