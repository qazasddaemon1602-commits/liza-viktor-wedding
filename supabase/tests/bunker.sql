begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

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

insert into auth.users(id)
values ('00000000-0000-4000-8000-000000000501');

insert into public.events(id, slug, name, owner_user_id)
values (
  '00000000-0000-4000-8000-000000000601',
  'bunker-nonce-contract',
  'Bunker nonce contract',
  '00000000-0000-4000-8000-000000000501'
);

insert into public.event_state(event_id)
values ('00000000-0000-4000-8000-000000000601');

insert into public.bunker_state(event_id, status, phase, run_nonce, global_game_state)
values (
  '00000000-0000-4000-8000-000000000601',
  'idle',
  'emergency',
  '00000000-0000-4000-8000-000000000701',
  'CHARACTERS_READY'
);

do $setup$
begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-4000-8000-000000000501',
    true
  );
end
$setup$;

select is(
  (public.owner_start_bunker(
    '00000000-0000-4000-8000-000000000601', 1800
  )->>'runNonce')::uuid,
  '00000000-0000-4000-8000-000000000701'::uuid,
  'first start preserves the prepared run nonce'
);

select is(
  (select run_nonce from public.bunker_state
   where event_id = '00000000-0000-4000-8000-000000000601'),
  '00000000-0000-4000-8000-000000000701'::uuid,
  'prepared character assignments remain attached to the active run'
);

select is(
  (select global_game_state from public.bunker_state
   where event_id = '00000000-0000-4000-8000-000000000601'),
  'CHARACTERS_READY',
  'first start preserves the prepared global game state'
);

select is(
  (public.owner_start_bunker(
    '00000000-0000-4000-8000-000000000601', 1800
  )->>'runNonce')::uuid,
  '00000000-0000-4000-8000-000000000701'::uuid,
  'active restart preserves the same run nonce'
);

insert into public.events(id, slug, name, owner_user_id)
values (
  '00000000-0000-4000-8000-000000000602',
  'bunker-fresh-run-contract',
  'Bunker fresh run contract',
  '00000000-0000-4000-8000-000000000501'
);

insert into public.event_state(event_id)
values ('00000000-0000-4000-8000-000000000602');

create temporary table bunker_start_results(result jsonb) on commit drop;
insert into bunker_start_results(result)
select public.owner_start_bunker(
  '00000000-0000-4000-8000-000000000602', 1800
);

select isnt(
  (select result->>'runNonce' from bunker_start_results),
  null::text,
  'start generates a run nonce when no bunker state exists'
);

select is(
  (select run_nonce::text from public.bunker_state
   where event_id = '00000000-0000-4000-8000-000000000602'),
  (select result->>'runNonce' from bunker_start_results),
  'fresh start returns the nonce persisted in bunker state'
);

select * from finish();
rollback;
