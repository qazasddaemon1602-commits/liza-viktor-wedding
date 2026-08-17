begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

select has_table('public', 'events', 'events table exists');
select has_table('public', 'event_state', 'event_state table exists');
select has_table('public', 'carriages', 'carriages table exists');
select has_table('public', 'guests', 'guests table exists');
select has_table('public', 'guest_device_bindings', 'device bindings table exists');
select has_table('public', 'owner_action_log', 'owner action log exists');

select has_column('public', 'events', 'owner_user_id', 'event has exactly scoped owner id');
select has_column('public', 'guests', 'carriage_id', 'guest stores canonical carriage/team id');
select has_column('public', 'guests', 'affiliation_type', 'guest stores affiliation for balanced mixing');

select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'register_guest'),
  'public register_guest RPC exists'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'restore_guest'),
  'public restore_guest RPC exists'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'owner_reassign_guest'),
  'owner-only reassign RPC exists'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'owner_delete_guest'),
  'owner-only guest deletion RPC exists'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'owner_get_dashboard'),
  'owner-only dashboard bootstrap RPC exists'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'owner_issue_guest_recovery'),
  'owner-only recovery-code issue RPC exists'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'recover_guest'),
  'public one-time guest recovery RPC exists'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'owner_send_carriage_call'),
  'owner-only carriage call RPC exists'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'owner_clear_carriage_call'),
  'owner-only carriage call clear RPC exists'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'get_guest_active_carriage_calls'),
  'guest-targeted active carriage call RPC exists'
);

select ok(
  exists(
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'register_guest'
      and pg_get_function_identity_arguments(p.oid) = 'p_event_slug text, p_device_key text, p_first_name text, p_last_name text, p_affiliation_type text, p_affiliation_detail text, p_confirm_duplicate boolean'
  ),
  'register_guest uses public slug contract with duplicate confirmation'
);

select ok(
  exists(
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'restore_guest'
      and pg_get_function_identity_arguments(p.oid) = 'p_event_slug text, p_device_key text'
  ),
  'restore_guest uses public slug contract'
);

select ok(
  exists(
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'guests'
  ),
  'guests table is published to Supabase Realtime'
);

select * from finish();
rollback;