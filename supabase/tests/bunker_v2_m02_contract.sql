begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select has_function('public', 'get_guest_bunker_v2_m02', array['text','text'], 'M02 exposes a guest read model');
select has_function('public', 'get_bunker_v2_m02_screen', array['text'], 'M02 exposes a public TV read model');
select has_function('public', 'get_owner_bunker_v2_m02', array['uuid'], 'M02 exposes an owner read model');
select ok(
  not has_function_privilege('anon', 'public._bunker_m02_correct_answers()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public._bunker_m02_correct_answers()', 'EXECUTE'),
  'M02 answer key is server-only'
);
select ok(
  pg_get_functiondef('public.get_guest_bunker_v2_m02(text,text)'::regprocedure) !~ 'Вагон №4(.|\n)*Открытие технического шлюза(.|\n)*05',
  'guest read model source does not contain the full correct vector'
);
select ok(
  pg_get_functiondef('public.get_bunker_v2_m02_screen(text)'::regprocedure) !~ 'Открытие технического шлюза',
  'TV read model source does not contain the answer key'
);
select ok(
  pg_get_functiondef('public.submit_bunker_command(text,text,uuid,text,jsonb)'::regprocedure) ~ '_submit_bunker_command_m02',
  'command router includes M02 authoritative handling'
);
select ok(
  (select prosecdef from pg_proc where oid='public.get_guest_bunker_v2_m02(text,text)'::regprocedure)
  and coalesce('search_path=""'=any((select proconfig from pg_proc where oid='public.get_guest_bunker_v2_m02(text,text)'::regprocedure)), false),
  'M02 guest read model is hardened SECURITY DEFINER'
);
select ok(
  pg_get_functiondef('public.get_owner_bunker_v2_m02(uuid)'::regprocedure) ~ 'contract_version'
  and pg_get_functiondef('public.get_owner_bunker_v2_m02(uuid)'::regprocedure) ~ '''legacy''',
  'M02 owner read preserves owner hint counts while enforcing the V2 contract boundary'
);

select * from finish();
rollback;
