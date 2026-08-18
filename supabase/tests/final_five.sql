begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

select has_table('public', 'final_five_role_access', 'private final-five role access table exists');
select has_table('public', 'final_five_answers', 'private final-five answer table exists');
select has_column('public', 'final_five_role_access', 'token_hash', 'role access stores only a token hash');
select hasnt_column('public', 'final_five_role_access', 'token', 'plaintext role token is never stored');
select has_column('public', 'final_five_role_access', 'role', 'role access is bound to liza or viktor');
select has_column('public', 'final_five_answers', 'role', 'each live answer belongs to one role');
select has_column('public', 'final_five_answers', 'choice', 'live answer stores liza or viktor');

select ok(not has_table_privilege('anon', 'public.final_five_role_access', 'SELECT'), 'anonymous clients cannot enumerate role tokens');
select ok(not has_table_privilege('authenticated', 'public.final_five_role_access', 'SELECT'), 'owner cannot enumerate role token hashes directly');
select ok(not has_table_privilege('anon', 'public.final_five_answers', 'SELECT'), 'anonymous clients cannot read private live answers');
select ok(not has_table_privilege('authenticated', 'public.final_five_answers', 'SELECT'), 'owner cannot read private live answers directly');

select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_seed_final_five_questions'), 'owner can seed the exact final-five question set');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_issue_final_five_role_access'), 'owner can issue private role access');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_final_five_role_state'), 'role token holder can load only their own live state');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='submit_final_five_answer'), 'role token holder can submit a private live answer');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_get_final_five_status'), 'owner can see answer-completion flags without values');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_reveal_final_five'), 'owner has one explicit final-five reveal action');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_revealed_final_five'), 'projector can read final-five answers only after reveal');

select ok(not has_function_privilege('anon', 'public.owner_seed_final_five_questions(uuid)', 'EXECUTE'), 'anonymous clients cannot seed final-five questions');
select ok(not has_function_privilege('anon', 'public.owner_issue_final_five_role_access(uuid,text)', 'EXECUTE'), 'anonymous clients cannot issue role access');
select ok(not has_function_privilege('anon', 'public.owner_get_final_five_status(uuid,uuid)', 'EXECUTE'), 'anonymous clients cannot read owner final-five status');
select ok(not has_function_privilege('anon', 'public.owner_reveal_final_five(uuid,uuid)', 'EXECUTE'), 'anonymous clients cannot reveal final-five answers');
select ok(has_function_privilege('anon', 'public.get_final_five_role_state(text,text,text)', 'EXECUTE'), 'private unguessable role token can load role state without an account');
select ok(has_function_privilege('anon', 'public.get_revealed_final_five(text)', 'EXECUTE'), 'projector may request only already-revealed final-five state');

select * from finish();
rollback;
