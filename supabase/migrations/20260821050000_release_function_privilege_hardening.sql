-- Tighten callable surface before the public event launch.
-- Guest-facing RPCs keep their explicit grants; owner RPCs require an
-- authenticated session and implementation helpers are never API endpoints.

do $hardening$
declare
  target record;
begin
  for target in
    select
      namespace.nspname as schema_name,
      procedure.proname as function_name,
      pg_get_function_identity_arguments(procedure.oid) as identity_arguments
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and (
        left(procedure.proname, 6) = 'owner_'
        or left(procedure.proname, 1) = '_'
      )
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from public, anon, authenticated',
      target.schema_name,
      target.function_name,
      target.identity_arguments
    );

    if left(target.function_name, 6) = 'owner_' then
      execute format(
        'grant execute on function %I.%I(%s) to authenticated',
        target.schema_name,
        target.function_name,
        target.identity_arguments
      );
    end if;
  end loop;
end;
$hardening$;

alter function public._mk_next_match(text, integer)
  set search_path = '';

-- New functions are private by default. Public and owner RPCs must opt in to
-- the exact roles they support in the same migration that creates them.
alter default privileges in schema public
  revoke execute on functions from public;
