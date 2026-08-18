begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

select has_column('public', 'quiz_state', 'couple_answer_revealed_at', 'quiz state tracks the separately revealed joint answer');

select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_get_couple_reveal_status'),
  'owner can read joint-answer reveal readiness without reading the answer'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_reveal_couple_preanswer'),
  'owner has an explicit second reveal action for the joint answer'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_revealed_couple_answer'),
  'presentation clients have a safe revealed-answer RPC'
);

select ok(not has_function_privilege('anon', 'public.owner_get_couple_reveal_status(uuid,uuid)', 'EXECUTE'), 'anonymous clients cannot inspect owner reveal readiness');
select ok(has_function_privilege('authenticated', 'public.owner_get_couple_reveal_status(uuid,uuid)', 'EXECUTE'), 'authenticated owner session can request reveal readiness');
select ok(not has_function_privilege('anon', 'public.owner_reveal_couple_preanswer(uuid,uuid)', 'EXECUTE'), 'anonymous clients cannot reveal the couple answer');
select ok(has_function_privilege('authenticated', 'public.owner_reveal_couple_preanswer(uuid,uuid)', 'EXECUTE'), 'authenticated owner session can perform the second reveal');
select ok(has_function_privilege('anon', 'public.get_revealed_couple_answer(text)', 'EXECUTE'), 'anonymous projector may request only the already revealed answer');

select ok(
  position('couple_preanswers' in pg_get_functiondef('public.get_revealed_couple_answer(text)'::regprocedure)) > 0,
  'revealed-answer RPC reads the protected preanswer table only inside security-definer code'
);
select ok(
  position('couple_answer_revealed_at' in pg_get_functiondef('public.get_revealed_couple_answer(text)'::regprocedure)) > 0,
  'public revealed-answer RPC is gated by the explicit second reveal timestamp'
);
select ok(
  position('finalized_at' in pg_get_functiondef('public.owner_reveal_couple_preanswer(uuid,uuid)'::regprocedure)) > 0,
  'owner cannot reveal a joint answer before the answer batch is finalized'
);
select ok(
  position('results' in pg_get_functiondef('public.owner_reveal_couple_preanswer(uuid,uuid)'::regprocedure)) > 0,
  'joint answer cannot be revealed before guest results are already in results phase'
);

select * from finish();
rollback;
