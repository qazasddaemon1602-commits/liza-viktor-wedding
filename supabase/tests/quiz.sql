begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

select has_table('public', 'questions', 'questions table exists');
select has_table('public', 'quiz_votes', 'quiz votes table exists');
select has_table('public', 'quiz_state', 'quiz state table exists');

select has_column('public', 'questions', 'image_path', 'questions support optional thematic images');
select has_column('public', 'questions', 'question_type', 'questions distinguish standard and final-five types');
select has_column('public', 'quiz_votes', 'guest_id', 'votes bind to stable registered guests');
select has_column('public', 'quiz_votes', 'choice', 'votes store liza or viktor choice');
select has_column('public', 'quiz_state', 'phase', 'quiz state has explicit reveal phase');
select has_column('public', 'quiz_state', 'current_question_id', 'quiz state points at current question');

select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_quiz_state'),
  'public guest quiz-state RPC exists'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='submit_quiz_vote'),
  'public guest vote RPC exists'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_activate_quiz_question'),
  'owner question activation RPC exists'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_reveal_quiz_results'),
  'owner result reveal RPC exists'
);

select ok(
  exists(
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='quiz_votes'
      and c.contype='u'
      and pg_get_constraintdef(c.oid) ilike '%question_id%guest_id%'
  ),
  'database enforces one vote per guest per question'
);

select ok(not has_table_privilege('anon', 'public.quiz_votes', 'SELECT'), 'anonymous guests cannot read raw votes');
select ok(not has_table_privilege('anon', 'public.quiz_votes', 'INSERT'), 'anonymous guests cannot bypass vote RPC');
select ok(not has_table_privilege('anon', 'public.questions', 'SELECT'), 'anonymous guests cannot enumerate hidden questions');

select ok(has_function_privilege('anon', 'public.get_quiz_state(text,text)', 'EXECUTE'), 'anonymous registered device can request current quiz state');
select ok(has_function_privilege('anon', 'public.submit_quiz_vote(text,text,uuid,text)', 'EXECUTE'), 'anonymous registered device can submit one vote through RPC');
select ok(not has_function_privilege('anon', 'public.owner_activate_quiz_question(uuid,uuid)', 'EXECUTE'), 'anonymous clients cannot activate questions');
select ok(not has_function_privilege('anon', 'public.owner_reveal_quiz_results(uuid,uuid)', 'EXECUTE'), 'anonymous clients cannot reveal results');
select ok(has_function_privilege('authenticated', 'public.owner_activate_quiz_question(uuid,uuid)', 'EXECUTE'), 'authenticated owner session can invoke question activation RPC');

select * from finish();
rollback;
