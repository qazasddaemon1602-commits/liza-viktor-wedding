begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

select has_table('public', 'bunker_state', 'bunker state table exists');

select ok(
  exists(
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'owner_start_bunker'
      and pg_get_function_identity_arguments(p.oid) = 'p_event_id uuid, p_duration_seconds integer'
  ),
  'owner bunker start RPC exists'
);

select ok(
  exists(
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'owner_stop_bunker'
      and pg_get_function_identity_arguments(p.oid) = 'p_event_id uuid'
  ),
  'owner bunker stop RPC exists'
);

select ok(
  exists(
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_bunker_screen_state'
      and pg_get_function_identity_arguments(p.oid) = 'p_event_slug text'
  ),
  'public bunker screen state RPC exists'
);

select ok(
  not has_function_privilege('anon', 'public.owner_start_bunker(uuid,integer)', 'EXECUTE'),
  'anonymous clients cannot start bunker'
);

select ok(
  not has_function_privilege('anon', 'public.owner_stop_bunker(uuid)', 'EXECUTE'),
  'anonymous clients cannot stop bunker'
);

select ok(
  has_function_privilege('anon', 'public.get_bunker_screen_state(text)', 'EXECUTE'),
  'projector can read safe bunker state anonymously'
);

select ok(
  position('1800' in pg_get_functiondef('public.owner_start_bunker(uuid,integer)'::regprocedure)) > 0,
  'bunker start contract carries the 30 minute default'
);

select ok(
  position('v_remaining > 0' in lower(pg_get_functiondef('public.owner_get_bunker_control(uuid)'::regprocedure))) = 0,
  'owner control keeps bunker active at 00:00 until explicit stop'
);

select ok(
  position('if v_remaining = 0' in lower(pg_get_functiondef('public.get_bunker_screen_state(text)'::regprocedure))) = 0,
  'projector keeps bunker emergency visible at 00:00 until explicit stop'
);

select * from finish();
rollback;
