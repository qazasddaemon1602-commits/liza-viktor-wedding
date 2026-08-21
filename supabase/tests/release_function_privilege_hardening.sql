begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

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
  not has_function_privilege(
    'anon', 'public.owner_prepare_bunker_v2(uuid,uuid)', 'EXECUTE'
  ),
  'anonymous guests cannot invoke owner_prepare_bunker_v2'
);

select ok(
  has_function_privilege(
    'authenticated', 'public.owner_prepare_bunker_v2(uuid,uuid)', 'EXECUTE'
  ),
  'authenticated sessions retain owner_prepare_bunker_v2'
);

select ok(
  not has_function_privilege(
    'anon', 'public.owner_transition_bunker_v2(uuid,text,uuid)', 'EXECUTE'
  ),
  'anonymous guests cannot invoke owner_transition_bunker_v2'
);

select ok(
  has_function_privilege(
    'authenticated', 'public.owner_transition_bunker_v2(uuid,text,uuid)', 'EXECUTE'
  ),
  'authenticated sessions retain owner_transition_bunker_v2'
);

select ok(
  not has_function_privilege(
    'anon', 'public._bunker_v2_plan(uuid,uuid)', 'EXECUTE'
  ),
  'anonymous guests cannot invoke the V2 plan helper'
);

select ok(
  not has_function_privilege(
    'authenticated', 'public._bunker_v2_plan(uuid,uuid)', 'EXECUTE'
  ),
  'authenticated clients cannot invoke the V2 plan helper'
);

select ok(
  coalesce(
    (
      select 'search_path=""' = any(procedure.proconfig)
      from pg_proc procedure
      where procedure.oid = 'public._bunker_v2_plan(uuid,uuid)'::regprocedure
    ),
    false
  ),
  'the V2 plan helper has an immutable empty search path'
);

select ok(
  coalesce(
    (
      select 'search_path=""' = any(procedure.proconfig)
      from pg_proc procedure
      where procedure.oid = 'public.owner_prepare_bunker_v2(uuid,uuid)'::regprocedure
    ),
    false
  ),
  'owner_prepare_bunker_v2 has an immutable empty search path'
);

select ok(
  coalesce(
    (
      select 'search_path=""' = any(procedure.proconfig)
      from pg_proc procedure
      where procedure.oid = 'public.owner_transition_bunker_v2(uuid,text,uuid)'::regprocedure
    ),
    false
  ),
  'owner_transition_bunker_v2 has an immutable empty search path'
);

select is(
  (
    select count(*)::integer
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = any(array[
        '_refresh_bunker_run_guest_plan_v1',
        '_bunker_run_guest_plan_is_stale_v1',
        '_ensure_late_bunker_guest_v1',
        '_create_bunker_game_plan_v1',
        '_owner_distribute_bunker_characters_v1',
        '_refresh_bunker_run_guest_plan',
        '_bunker_run_guest_plan_is_stale',
        '_ensure_late_bunker_guest',
        '_create_bunker_game_plan',
        '_assign_late_bunker_guest',
        '_clear_bunker_game_run_on_reset',
        '_bunker_v2_match_repeats',
        'owner_distribute_bunker_characters'
      ])
      and not coalesce('search_path=""' = any(procedure.proconfig), false)
  ),
  0,
  'legacy guards, private V1 bodies and the repeat matcher use an empty search path'
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
