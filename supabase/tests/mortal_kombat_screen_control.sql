begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

select ok(
  exists(
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'owner_show_mk_bracket'
      and pg_get_function_identity_arguments(p.oid) = 'p_event_id uuid'
  ),
  'owner bracket screen RPC exists'
);

select ok(
  not has_function_privilege('anon', 'public.owner_show_mk_bracket(uuid)', 'EXECUTE'),
  'anonymous clients cannot control the MK bracket projector'
);

select ok(
  has_function_privilege('authenticated', 'public.owner_show_mk_bracket(uuid)', 'EXECUTE'),
  'authenticated owner session can invoke bracket screen control'
);

select ok(
  exists(
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'owner_set_mk_main_screen'
      and pg_get_function_identity_arguments(p.oid) = 'p_event_id uuid, p_enabled boolean'
  ),
  'explicit MK main-screen presentation RPC exists'
);

select ok(
  not has_function_privilege('anon', 'public.owner_set_mk_main_screen(uuid,boolean)', 'EXECUTE'),
  'anonymous clients cannot take over the shared main projector with MK'
);

select ok(
  has_function_privilege('authenticated', 'public.owner_set_mk_main_screen(uuid,boolean)', 'EXECUTE'),
  'authenticated owner session can show or hide MK on the shared main projector'
);

select * from finish();
rollback;

