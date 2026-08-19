begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

select has_table('public', 'bunker_guest_profiles', 'Bunker guest dossier table exists');
select has_table('public', 'bunker_mission_templates', 'Bunker mission template table exists');
select has_table('public', 'bunker_team_progress', 'Bunker carriage progress table exists');

select has_column('public', 'bunker_state', 'phase', 'Bunker state tracks quest phase');
select has_column('public', 'bunker_state', 'phase_started_at', 'Bunker state tracks phase start');
select has_column('public', 'bunker_state', 'unlocked_at', 'Bunker state tracks global unlock');
select has_column('public', 'bunker_state', 'run_nonce', 'Bunker state tracks stable run identity');

select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_guest_bunker_state' and pg_get_function_identity_arguments(p.oid)='p_event_slug text, p_device_key text'),
  'guest Bunker state RPC uses trusted event/device identity'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='submit_guest_bunker_mission'),
  'guest can submit the current carriage mission through guarded RPC'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='submit_guest_bunker_final_code'),
  'guest can submit final Bunker code through guarded RPC'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_get_bunker_quest'),
  'owner Bunker quest projection exists'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_begin_bunker_quest'),
  'owner can begin dossier phase'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_advance_bunker_phase'),
  'owner can advance Bunker phase explicitly'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_reset_bunker_team_stage'),
  'owner can reset one carriage stage'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_force_complete_bunker_team_stage'),
  'owner has carriage force-complete fallback'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_unlock_bunker'),
  'owner has final manual-unlock fallback'
);

select ok(
  not has_table_privilege('anon', 'public.bunker_guest_profiles', 'SELECT'),
  'anonymous clients cannot enumerate Bunker dossiers'
);
select ok(
  not has_table_privilege('authenticated', 'public.bunker_guest_profiles', 'SELECT'),
  'authenticated clients cannot enumerate Bunker dossiers directly'
);
select ok(
  not has_table_privilege('anon', 'public.bunker_team_progress', 'SELECT'),
  'anonymous clients cannot enumerate raw carriage progress'
);

select ok(
  has_function_privilege('anon', 'public.get_guest_bunker_state(text,text)', 'EXECUTE'),
  'registered anonymous guest may call guarded Bunker state RPC'
);
select ok(
  not has_function_privilege('anon', 'public.owner_get_bunker_quest(uuid)', 'EXECUTE'),
  'anonymous client cannot load owner Bunker quest control'
);
select ok(
  has_function_privilege('authenticated', 'public.owner_get_bunker_quest(uuid)', 'EXECUTE'),
  'authenticated owner session may call Bunker quest control'
);

select ok(
  position('device_key' in lower(pg_get_functiondef('public.get_guest_bunker_state(text,text)'::regprocedure))) > 0,
  'guest state resolves canonical device binding server-side'
);
select ok(
  position('correct_answer' in lower(pg_get_functiondef('public.submit_guest_bunker_mission(text,text,text,text)'::regprocedure))) > 0,
  'mission correctness is evaluated server-side'
);

select * from finish();
rollback;
