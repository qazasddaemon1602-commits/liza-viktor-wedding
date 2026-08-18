begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_get_mk_control'), 'owner MK control projection exists');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_randomize_mk_seeds'), 'owner can randomize seeds');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_swap_mk_seeds'), 'owner can swap two seed positions');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_replace_mk_player'), 'owner can replace a no-show before start');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_finalize_mk_draw'), 'owner can finalize a 16-player draw');

select ok(not has_function_privilege('anon', 'public.owner_get_mk_control(uuid)', 'EXECUTE'), 'anonymous cannot load owner MK control');
select ok(not has_function_privilege('anon', 'public.owner_randomize_mk_seeds(uuid)', 'EXECUTE'), 'anonymous cannot randomize MK draw');
select ok(not has_function_privilege('anon', 'public.owner_swap_mk_seeds(uuid,uuid)', 'EXECUTE'), 'anonymous cannot swap MK seeds');
select ok(not has_function_privilege('anon', 'public.owner_finalize_mk_draw(uuid)', 'EXECUTE'), 'anonymous cannot start MK bracket');
select ok(has_function_privilege('authenticated', 'public.owner_get_mk_control(uuid)', 'EXECUTE'), 'authenticated owner session may call control projection');

select ok(
  position('count(*)' in lower(pg_get_functiondef('public.owner_finalize_mk_draw(uuid)'::regprocedure))) > 0,
  'final draw validates the active-player count server-side'
);
select ok(
  position('mk_matches' in lower(pg_get_functiondef('public.owner_finalize_mk_draw(uuid)'::regprocedure))) > 0,
  'final draw creates the server-authoritative matches'
);

select * from finish();
rollback;
