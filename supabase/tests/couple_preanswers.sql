begin;

create extension if not exists pgtap with schema extensions;

select plan(23);

select has_table('public', 'couple_preanswer_access', 'one-time couple access table exists');
select has_table('public', 'couple_preanswers', 'joint couple preanswers table exists');

select has_column('public', 'couple_preanswer_access', 'token_hash', 'access stores only a token hash');
select has_column('public', 'couple_preanswer_access', 'consumed_at', 'one-time access tracks consumption');
select has_column('public', 'couple_preanswer_access', 'finalized_at', 'answer batch tracks finalization');
select hasnt_column('public', 'couple_preanswer_access', 'token', 'plaintext access token is never stored');
select has_column('public', 'couple_preanswers', 'choice', 'joint answer stores liza or viktor');
select has_column('public', 'couple_preanswers', 'question_id', 'joint answer is bound to a quiz question');

select ok(not has_table_privilege('anon', 'public.couple_preanswers', 'SELECT'), 'anonymous clients cannot read hidden preanswers directly');
select ok(not has_table_privilege('authenticated', 'public.couple_preanswers', 'SELECT'), 'owner session cannot casually enumerate hidden preanswers');
select ok(not has_table_privilege('anon', 'public.couple_preanswer_access', 'SELECT'), 'anonymous clients cannot enumerate token hashes');
select ok(not has_table_privilege('authenticated', 'public.couple_preanswer_access', 'SELECT'), 'authenticated clients cannot enumerate token hashes');

select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_issue_couple_preanswer_access'),
  'owner can issue one joint preanswer access token through RPC'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_get_couple_preanswer_status'),
  'owner can read only completion status through RPC'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_couple_preanswer_form'),
  'token holder can load the joint preanswer form through RPC'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='save_couple_preanswer'),
  'token holder can save one joint answer through RPC'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='finalize_couple_preanswers'),
  'token holder can atomically finalize the joint answer batch through RPC'
);

select ok(not has_function_privilege('anon', 'public.owner_issue_couple_preanswer_access(uuid)', 'EXECUTE'), 'anonymous clients cannot issue couple access tokens');
select ok(has_function_privilege('authenticated', 'public.owner_issue_couple_preanswer_access(uuid)', 'EXECUTE'), 'authenticated owner session can issue couple access token');
select ok(not has_function_privilege('anon', 'public.owner_get_couple_preanswer_status(uuid)', 'EXECUTE'), 'anonymous clients cannot read couple completion status');
select ok(has_function_privilege('authenticated', 'public.owner_get_couple_preanswer_status(uuid)', 'EXECUTE'), 'authenticated owner session can read couple completion status');
select ok(has_function_privilege('anon', 'public.get_couple_preanswer_form(text,text)', 'EXECUTE'), 'public one-time token can load preanswer form');
select ok(has_function_privilege('anon', 'public.finalize_couple_preanswers(text,text)', 'EXECUTE'), 'public one-time token can finalize preanswers');

select * from finish();
rollback;
