begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select has_function(
  'public',
  'get_guest_bunker_v2_dashboard',
  array['text','text'],
  'persistent V2 guest dashboard RPC exists'
);

select ok(
  coalesce(has_function_privilege(
    'anon',
    to_regprocedure('public.get_guest_bunker_v2_dashboard(text,text)'),
    'EXECUTE'
  ), false),
  'anonymous registered-device clients can execute the dashboard RPC'
);

select ok(
  coalesce(has_function_privilege(
    'authenticated',
    to_regprocedure('public.get_guest_bunker_v2_dashboard(text,text)'),
    'EXECUTE'
  ), false),
  'authenticated clients can execute the dashboard RPC'
);

select ok(
  not has_table_privilege('anon','public.bunker_guest_profiles','SELECT')
  and not has_table_privilege('anon','public.bunker_inventory_lots','SELECT')
  and not has_table_privilege('anon','public.bunker_archive_entries','SELECT')
  and not has_table_privilege('anon','public.bunker_archive_entitlements','SELECT')
  and not has_table_privilege('anon','public.bunker_wagon_state','SELECT'),
  'anonymous clients still cannot read backing Bunker tables directly'
);

select ok(
  not has_table_privilege('authenticated','public.bunker_guest_profiles','SELECT')
  and not has_table_privilege('authenticated','public.bunker_inventory_lots','SELECT')
  and not has_table_privilege('authenticated','public.bunker_archive_entries','SELECT')
  and not has_table_privilege('authenticated','public.bunker_archive_entitlements','SELECT')
  and not has_table_privilege('authenticated','public.bunker_wagon_state','SELECT'),
  'authenticated clients still cannot read backing Bunker tables directly'
);

select ok(
  coalesce(pg_get_functiondef(to_regprocedure('public.get_guest_bunker_v2_dashboard(text,text)')),'')
    ~ '_bunker_guest_id',
  'dashboard identity is resolved from the existing device-key authority path'
);

select ok(
  coalesce(pg_get_functiondef(to_regprocedure('public.get_guest_bunker_v2_dashboard(text,text)')),'')
    ~ 'contract_version',
  'dashboard is explicitly gated to the V2 run contract'
);

select ok(
  coalesce(pg_get_functiondef(to_regprocedure('public.get_guest_bunker_v2_dashboard(text,text)')),'')
    ~ 'bunker_inventory_lots',
  'dashboard inventory comes from the durable inventory ledger'
);

select ok(
  coalesce(pg_get_functiondef(to_regprocedure('public.get_guest_bunker_v2_dashboard(text,text)')),'')
    ~ 'bunker_inventory_transfers'
  and coalesce(pg_get_functiondef(to_regprocedure('public.get_guest_bunker_v2_dashboard(text,text)')),'')
    ~ 'status = ''accepted'''
  and coalesce(pg_get_functiondef(to_regprocedure('public.get_guest_bunker_v2_dashboard(text,text)')),'')
    ~ 'from_carriage_id',
  'dashboard transfer history counts accepted transfer quantities including partial lot transfers'
);

select ok(
  coalesce(pg_get_functiondef(to_regprocedure('public.get_guest_bunker_v2_dashboard(text,text)')),'')
    ~ 'bunker_wagon_state',
  'dashboard wagon state comes from the authoritative wagon state table'
);

select ok(
  coalesce(pg_get_functiondef(to_regprocedure('public.get_guest_bunker_v2_dashboard(text,text)')),'')
    ~ 'bunker_archive_entitlements',
  'dashboard archive is entitlement-backed'
);

select ok(
  coalesce(pg_get_functiondef(to_regprocedure('public.get_guest_bunker_v2_dashboard(text,text)')),'')
    ~ 'owner_scope_kind.*global'
  and coalesce(pg_get_functiondef(to_regprocedure('public.get_guest_bunker_v2_dashboard(text,text)')),'')
    ~ 'carriage_id',
  'dashboard archive is limited to global or viewer-wagon entitlement scope'
);

select ok(
  coalesce(pg_get_functiondef(to_regprocedure('public.get_guest_bunker_v2_dashboard(text,text)')),'')
    !~ 'bunker_final_parameters|canonical_value|normalized_value',
  'dashboard RPC does not read final canonical or normalized answers'
);

select ok(
  coalesce(pg_get_functiondef(to_regprocedure('public.get_guest_bunker_v2_dashboard(text,text)')),'')
    ~ 'hidden_trait_revealed',
  'dashboard explicitly gates passenger hidden-trait visibility'
);

select * from finish();
rollback;
