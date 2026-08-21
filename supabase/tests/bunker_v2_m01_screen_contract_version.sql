begin;

select plan(6);

select has_function(
  'public', 'get_bunker_v2_m01_screen', array['text'],
  'projector M01 read exposes one versioned public RPC'
);
select ok(
  coalesce(has_function_privilege(
    'anon', to_regprocedure('public.get_bunker_v2_m01_screen(text)'), 'EXECUTE'
  ), false),
  'anonymous projector can execute the public read model'
);
select ok(
  lower(coalesce(pg_get_functiondef(
    to_regprocedure('public.get_bunker_v2_m01_screen(text)')
  ), '')) like '%set search_path to ''''%',
  'public projector RPC pins an empty search_path'
);
select ok(
  lower(coalesce(pg_get_functiondef(
    to_regprocedure('public.get_bunker_v2_m01_screen(text)')
  ), '')) not like '%from public.guests%'
  and lower(coalesce(pg_get_functiondef(
    to_regprocedure('public.get_bunker_v2_m01_screen(text)')
  ), '')) not like '%bunker_guest_profiles%'
  and lower(coalesce(pg_get_functiondef(
    to_regprocedure('public.get_bunker_v2_m01_screen(text)')
  ), '')) not like '%hidden_fact%',
  'TV function cannot read registered names or private character traits'
);

insert into auth.users(id)
values ('42000000-0000-4000-8000-000000000001');

insert into public.events(id, slug, name, owner_user_id)
values
  (
    '42000000-0000-4000-8000-000000000011',
    'm01-screen-v1-idle',
    'M01 screen V1 idle',
    '42000000-0000-4000-8000-000000000001'
  ),
  (
    '42000000-0000-4000-8000-000000000012',
    'm01-screen-v2-race',
    'M01 screen V2 transition race',
    '42000000-0000-4000-8000-000000000001'
  );

insert into public.bunker_game_runs(
  run_nonce, event_id, wagon_count, guest_count, plan,
  contract_version, plan_version
)
values
  (
    '42000000-0000-4000-8000-000000000021',
    '42000000-0000-4000-8000-000000000011',
    2, 0, '{}'::jsonb, 1, null
  ),
  (
    '42000000-0000-4000-8000-000000000022',
    '42000000-0000-4000-8000-000000000012',
    2, 0, '{}'::jsonb, 2, 1
  );

insert into public.bunker_state(event_id, run_nonce, global_game_state)
values
  (
    '42000000-0000-4000-8000-000000000011',
    '42000000-0000-4000-8000-000000000021',
    'MISSION_01'
  ),
  (
    '42000000-0000-4000-8000-000000000012',
    '42000000-0000-4000-8000-000000000022',
    'MISSION_01'
  );

create temporary table m01_screen_contract_results(
  scenario text primary key,
  result jsonb not null
) on commit drop;

insert into m01_screen_contract_results(scenario, result)
values
  ('v1', public.get_bunker_v2_m01_screen('m01-screen-v1-idle')),
  ('v2', public.get_bunker_v2_m01_screen('m01-screen-v2-race'));

select ok(
  (
    select result @> '{"contractVersion": 1, "status": "legacy"}'::jsonb
      and result ? 'serverNow'
      and (select count(*) from jsonb_object_keys(result)) = 3
    from m01_screen_contract_results
    where scenario = 'v1'
  ),
  'V1 MISSION_01 returns the exact legacy projector shape'
);
select ok(
  (
    select result @> '{"contractVersion": 2, "status": "idle"}'::jsonb
      and result ? 'serverNow'
      and (select count(*) from jsonb_object_keys(result)) = 3
    from m01_screen_contract_results
    where scenario = 'v2'
  ),
  'V2 MISSION_01 stays V2 idle while its public instances are materializing'
);

select * from finish();
rollback;
