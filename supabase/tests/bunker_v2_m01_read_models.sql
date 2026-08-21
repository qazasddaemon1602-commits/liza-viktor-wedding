begin;
select plan(16);

select has_function(
  'public', 'get_guest_bunker_v2_m01', array['text', 'text'],
  'registered device has a narrow M01 guest read RPC'
);
select has_function(
  'public', 'get_owner_bunker_v2_m01', array['uuid'],
  'owner has a narrow M01 progress read RPC'
);
select has_function(
  'public', 'get_bunker_v2_m01_screen', array['text'],
  'projector has a public-only M01 read RPC'
);
select has_function(
  'public', 'owner_override_bunker_v2_m01',
  array['uuid', 'uuid', 'integer', 'uuid', 'uuid[]', 'text'],
  'owner has a reason-bound M01 override RPC'
);

select ok(
  coalesce(has_function_privilege(
    'anon', to_regprocedure('public.get_guest_bunker_v2_m01(text,text)'), 'EXECUTE'
  ), false),
  'anonymous registered devices can execute only the guest read boundary'
);
select ok(
  coalesce(has_function_privilege(
    'anon', to_regprocedure('public.get_bunker_v2_m01_screen(text)'), 'EXECUTE'
  ), false),
  'anonymous projector can execute the public M01 read boundary'
);
select ok(
  not coalesce(has_function_privilege(
    'anon', to_regprocedure('public.get_owner_bunker_v2_m01(uuid)'), 'EXECUTE'
  ), false)
  and not coalesce(has_function_privilege(
    'anon', to_regprocedure(
      'public.owner_override_bunker_v2_m01(uuid,uuid,integer,uuid,uuid[],text)'
    ), 'EXECUTE'
  ), false),
  'anonymous callers cannot read or override owner M01 data'
);
select ok(
  coalesce(has_function_privilege(
    'authenticated', to_regprocedure('public.get_owner_bunker_v2_m01(uuid)'), 'EXECUTE'
  ), false)
  and coalesce(has_function_privilege(
    'authenticated', to_regprocedure(
      'public.owner_override_bunker_v2_m01(uuid,uuid,integer,uuid,uuid[],text)'
    ), 'EXECUTE'
  ), false),
  'authenticated owner sessions can read and override M01 through narrow RPCs'
);

select ok(
  lower(coalesce(pg_get_functiondef(
    to_regprocedure('public.get_guest_bunker_v2_m01(text,text)')
  ), '')) like '%set search_path to ''''%',
  'guest read RPC pins an empty search_path'
);
select ok(
  lower(coalesce(pg_get_functiondef(
    to_regprocedure('public.get_owner_bunker_v2_m01(uuid)')
  ), '')) like '%set search_path to ''''%',
  'owner read RPC pins an empty search_path'
);
select ok(
  lower(coalesce(pg_get_functiondef(
    to_regprocedure('public.get_bunker_v2_m01_screen(text)')
  ), '')) like '%set search_path to ''''%',
  'public screen RPC pins an empty search_path'
);
select ok(
  lower(coalesce(pg_get_functiondef(to_regprocedure(
    'public.owner_override_bunker_v2_m01(uuid,uuid,integer,uuid,uuid[],text)'
  )), '')) like '%set search_path to ''''%',
  'owner override RPC pins an empty search_path'
);

select ok(
  lower(coalesce(pg_get_functiondef(
    to_regprocedure('public.get_guest_bunker_v2_m01(text,text)')
  ), '')) like '%_bunker_guest_id%'
  and lower(coalesce(pg_get_functiondef(
    to_regprocedure('public.get_guest_bunker_v2_m01(text,text)')
  ), '')) like '%bunker_mission_members%',
  'guest read resolves the device identity and frozen instance membership server-side'
);
select ok(
  lower(coalesce(pg_get_functiondef(
    to_regprocedure('public.get_bunker_v2_m01_screen(text)')
  ), '')) not like '%hidden_fact%'
  and lower(coalesce(pg_get_functiondef(
    to_regprocedure('public.get_bunker_v2_m01_screen(text)')
  ), '')) not like '%from public.guests%'
  and lower(coalesce(pg_get_functiondef(
    to_regprocedure('public.get_bunker_v2_m01_screen(text)')
  ), '')) not like '%bunker_guest_profiles%',
  'TV read model cannot serialize names or private character traits'
);
select ok(
  lower(coalesce(pg_get_functiondef(to_regprocedure(
    'public.owner_override_bunker_v2_m01(uuid,uuid,integer,uuid,uuid[],text)'
  )), '')) like '%btrim(p_reason)%'
  and lower(coalesce(pg_get_functiondef(to_regprocedure(
    'public.owner_override_bunker_v2_m01(uuid,uuid,integer,uuid,uuid[],text)'
  )), '')) like '%instance_version%'
  and lower(coalesce(pg_get_functiondef(to_regprocedure(
    'public.owner_override_bunker_v2_m01(uuid,uuid,integer,uuid,uuid[],text)'
  )), '')) like '%bunker_command_receipts%',
  'override requires a reason, optimistic instance version and idempotent receipt'
);
select ok(
  lower(coalesce(pg_get_functiondef(to_regprocedure(
    'public.owner_override_bunker_v2_m01(uuid,uuid,integer,uuid,uuid[],text)'
  )), '')) like '%bunker_game_events%'
  and lower(coalesce(pg_get_functiondef(to_regprocedure(
    'public.owner_override_bunker_v2_m01(uuid,uuid,integer,uuid,uuid[],text)'
  )), '')) like '%owner_m01_override%',
  'override appends an auditable owner event'
);

select * from finish();
rollback;
