begin;
create extension if not exists pgtap with schema extensions;
select plan(16);
select has_function('public','get_guest_bunker_v2_final',array['text','text'],'final guest read model');
select has_function('public','get_bunker_v2_final_screen',array['text'],'final TV read model');
select has_function('public','get_owner_bunker_v2_final',array['uuid'],'final owner read model');
select has_function('public','owner_bunker_v2_add_final_time',array['uuid','integer'],'owner can add bounded final time');
select has_function('public','owner_bunker_v2_final_hint',array['uuid'],'owner can advance hints');
select has_function('public','owner_bunker_v2_emergency_open',array['uuid'],'owner can emergency-open final');
select ok(pg_get_functiondef('public.submit_bunker_command(text,text,uuid,text,jsonb)'::regprocedure)~'_submit_bunker_command_final','command router includes final request_access');
select ok(pg_get_functiondef('public._submit_bunker_command_final(text,text,uuid,text,jsonb)'::regprocedure)~'for update','final access is authoritative and serialized');
select ok(pg_get_functiondef('public.get_bunker_v2_final_screen(text)'::regprocedure)!~'4719' and pg_get_functiondef('public.get_bunker_v2_final_screen(text)'::regprocedure)!~'LV0830','TV source does not contain final secrets');
select ok(not has_function_privilege('anon','public.owner_bunker_v2_add_final_time(uuid,integer)','EXECUTE'),'anonymous users cannot change final time');
select ok(not has_function_privilege('anon','public.owner_bunker_v2_emergency_open(uuid)','EXECUTE'),'anonymous users cannot force the bunker open');
select ok(
  pg_get_functiondef('public._bunker_v2_final_transition()'::regprocedure)~'sum\(w\.route_bonus\).*\*60'
  and pg_get_functiondef('public._bunker_v2_final_transition()'::regprocedure)~'greatest\(-300,least\(600',
  'final duration uses M05 route bonus minutes with approved -300/+600 second clamp'
);
select ok(
  pg_get_functiondef('public._bunker_v2_final_transition()'::regprocedure)!~'bunker_inventory_transfers'
  and pg_get_functiondef('public._bunker_v2_final_transition()'::regprocedure)!~'track_damage'
  and pg_get_functiondef('public._bunker_v2_final_transition()'::regprocedure)!~'power_instability',
  'trade count and damage do not silently change the approved final duration formula'
);
select ok(
  pg_get_functiondef('public._bunker_v2_final_transition()'::regprocedure)~'1800\+v_bonus',
  'final base remains 1800 seconds before bounded M05 bonus'
);
select ok(
  pg_get_functiondef('public.get_bunker_v2_final_screen(text)'::regprocedure)~'bunker_game_runs'
  and pg_get_functiondef('public.get_bunker_v2_final_screen(text)'::regprocedure)~'contract_version'
  and pg_get_functiondef('public.get_bunker_v2_final_screen(text)'::regprocedure)~'''legacy''',
  'final TV read is explicitly guarded by the active V2 contract'
);
select ok(
  pg_get_functiondef('public._bunker_v2_final_transition()'::regprocedure)~'final_started_at'
  and pg_get_functiondef('public._bunker_v2_final_transition()'::regprocedure)~'v_started.*make_interval',
  'final mission deadline is derived from the same authoritative final start timestamp'
);
select * from finish();
rollback;