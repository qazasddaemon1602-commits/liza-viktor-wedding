begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

select has_table('public', 'quiz_rounds', 'timed quiz rounds table exists');
select has_column('public', 'quiz_rounds', 'phase', 'round stores phase');
select has_column('public', 'quiz_rounds', 'timed', 'round distinguishes timed standard quiz from manual final-five flow');
select has_column('public', 'quiz_rounds', 'voting_started_at', 'round stores voting start');
select has_column('public', 'quiz_rounds', 'voting_ends_at', 'round stores voting deadline');
select has_column('public', 'quiz_rounds', 'results_started_at', 'round stores results start');
select has_column('public', 'quiz_rounds', 'results_ends_at', 'round stores results deadline');
select has_column('public', 'quiz_rounds', 'closed_at', 'round stores close time');
select has_column('public', 'quiz_state', 'present_on_main_screen', 'quiz presentation can return to main screen without closing round');

select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='_normalize_current_quiz_round'), 'authoritative round normalization helper exists');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_close_quiz_round'), 'owner can close active quiz round');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_return_quiz_to_main_screen'), 'owner can return projector to main screen without deleting round');

select ok(not has_table_privilege('anon', 'public.quiz_rounds', 'SELECT'), 'anonymous guests cannot read raw quiz round rows');
select ok(not has_function_privilege('anon', 'public.owner_close_quiz_round(uuid)', 'EXECUTE'), 'anonymous guest cannot close quiz');
select ok(not has_function_privilege('anon', 'public.owner_return_quiz_to_main_screen(uuid)', 'EXECUTE'), 'anonymous guest cannot change projector routing');
select ok(has_function_privilege('authenticated', 'public.owner_close_quiz_round(uuid)', 'EXECUTE'), 'authenticated owner can close quiz round');
select ok(has_function_privilege('authenticated', 'public.owner_return_quiz_to_main_screen(uuid)', 'EXECUTE'), 'authenticated owner can return projector to main screen');
select ok(has_function_privilege('anon', 'public.get_quiz_state(text,text)', 'EXECUTE'), 'guest timed state stays available through safe RPC');

select * from finish();
rollback;

