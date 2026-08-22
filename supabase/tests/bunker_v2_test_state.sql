begin;
create extension if not exists pgtap with schema extensions;
select plan(3);
select has_function('public','get_owner_bunker_v2_test_state',array['uuid'],'owner rehearsal state read exists');
select ok((select prosecdef from pg_proc where oid='public.get_owner_bunker_v2_test_state(uuid)'::regprocedure),'rehearsal state read is SECURITY DEFINER');
select ok(not has_function_privilege('anon','public.get_owner_bunker_v2_test_state(uuid)','EXECUTE'),'anonymous users cannot read owner rehearsal state');
select * from finish();
rollback;
