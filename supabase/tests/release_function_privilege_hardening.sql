begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select is(
  (
    select count(*)::integer
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and left(procedure.proname, 6) = 'owner_'
      and has_function_privilege('anon', procedure.oid, 'EXECUTE')
  ),
  0,
  'anonymous guests cannot execute owner RPCs'
);

select is(
  (
    select count(*)::integer
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and left(procedure.proname, 6) = 'owner_'
      and not has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
  ),
  0,
  'authenticated owner sessions retain every owner RPC grant'
);

select is(
  (
    select count(*)::integer
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and left(procedure.proname, 1) = '_'
      and has_function_privilege('anon', procedure.oid, 'EXECUTE')
  ),
  0,
  'anonymous guests cannot invoke implementation helpers'
);

select is(
  (
    select count(*)::integer
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and left(procedure.proname, 1) = '_'
      and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
  ),
  0,
  'authenticated clients cannot invoke implementation helpers directly'
);

select ok(
  coalesce(
    (
      select 'search_path=""' = any(procedure.proconfig)
      from pg_proc procedure
      join pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = '_mk_next_match'
        and pg_get_function_identity_arguments(procedure.oid) =
          'p_round text, p_position integer'
    ),
    false
  ),
  'the tournament helper has an immutable empty search path'
);

select ok(
  has_function_privilege(
    'anon',
    'public.register_guest(text,text,text,text,text,text,boolean)',
    'EXECUTE'
  ),
  'the intended public guest registration RPC remains callable'
);

select is(
  (
    select count(*)::integer
    from pg_default_acl defaults
    join pg_namespace namespace on namespace.oid = defaults.defaclnamespace
    cross join lateral aclexplode(defaults.defaclacl) privilege
    where pg_get_userbyid(defaults.defaclrole) = 'postgres'
      and namespace.nspname = 'public'
      and defaults.defaclobjtype = 'f'
      and privilege.privilege_type = 'EXECUTE'
      and (
        privilege.grantee = 0
        or privilege.grantee in (
          (select oid from pg_roles where rolname = 'anon'),
          (select oid from pg_roles where rolname = 'authenticated')
        )
      )
  ),
  0,
  'future public-schema functions require explicit API-role grants'
);

select * from finish();
rollback;
