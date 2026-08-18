begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

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
  'anonymous clients cannot control the MK projector'
);

select ok(
  has_function_privilege('authenticated', 'public.owner_show_mk_bracket(uuid)', 'EXECUTE'),
  'authenticated owner session can invoke bracket screen control'
);

select * from finish();
rollback;
