begin;
create extension if not exists pgtap with schema extensions;
select plan(21);
select has_function('public','get_guest_bunker_v2_m05',array['text','text'],'M05 guest read model');
select has_function('public','get_bunker_v2_m05_screen',array['text'],'M05 TV read model');
select has_function('public','get_owner_bunker_v2_m05',array['uuid'],'M05 owner read model');
select has_function('public','_bunker_v2_apply_m05_outcome',array['uuid','uuid','uuid','text','boolean'],'M05 applies route outcome once');
select has_function('public','_bunker_v2_calculate_m05_outcome',array['text','text','jsonb','text[]','text[]','boolean'],'M05 deterministic snapshot helper exists');
select is(
  public._bunker_v2_calculate_m05_outcome('A','route_000000000000','["tools"]'::jsonb,array['train_driver']::text[],array[]::text[],false),
  '{"tier":"best","fallback":false,"routeChoice":"A","trackDamage":0,"routeBonusMinutes":7,"sector04Found":true,"powerInstability":0}'::jsonb,
  'M05 A best is +7 minutes with sector 04'
);
select is(
  public._bunker_v2_calculate_m05_outcome('A','route_000000000000','[]'::jsonb,array[]::text[],array['route_analysis']::text[],false),
  '{"tier":"medium","fallback":false,"routeChoice":"A","trackDamage":0,"routeBonusMinutes":4,"sector04Found":false,"powerInstability":1}'::jsonb,
  'M05 A medium is +4 minutes with power instability'
);
select is(
  public._bunker_v2_calculate_m05_outcome('A','route_000000000000','[]'::jsonb,array[]::text[],array[]::text[],false),
  '{"tier":"poor","fallback":false,"routeChoice":"A","trackDamage":20,"routeBonusMinutes":0,"sector04Found":false,"powerInstability":0}'::jsonb,
  'M05 A poor gets no time and track damage'
);
select is(
  public._bunker_v2_calculate_m05_outcome('B','route_000000000000','[]'::jsonb,array[]::text[],array[]::text[],true),
  '{"tier":"safe","fallback":true,"routeChoice":"B","trackDamage":0,"routeBonusMinutes":-5,"sector04Found":false,"powerInstability":0}'::jsonb,
  'M05 B timeout is a stable five-minute detour'
);
select is(
  public._bunker_v2_calculate_m05_outcome('A','route_00000000000e','[]'::jsonb,array[]::text[],array['route_analysis']::text[],false)->>'tier',
  'poor',
  'M05 frozen severe scenario requires more than one support category'
);
select ok(pg_get_functiondef('public.submit_bunker_command(text,text,uuid,text,jsonb)'::regprocedure)~'_submit_bunker_command_m05','command router includes M05');
select ok(pg_get_functiondef('public._submit_bunker_command_m05(text,text,uuid,text,jsonb)'::regprocedure)~'cast_vote','M05 accepts vote command');
select ok(pg_get_functiondef('public._submit_bunker_command_m05(text,text,uuid,text,jsonb)'::regprocedure)~'for update','M05 serializes vote resolution');
select ok(
  pg_get_functiondef('public._submit_bunker_command_m05(text,text,uuid,text,jsonb)'::regprocedure)~'physical_task'
  and pg_get_functiondef('public._submit_bunker_command_m05(text,text,uuid,text,jsonb)'::regprocedure)~'mechanical_fix',
  'M05 accepts approved physical and technical situational abilities'
);
select ok(
  pg_get_functiondef('public._bunker_v2_apply_m05_outcome(uuid,uuid,uuid,text,boolean)'::regprocedure)~'_bunker_v2_calculate_m05_outcome',
  'M05 persisted outcome is calculated by the parity helper'
);
select has_trigger('public','bunker_state','bunker_v2_finalize_m05_on_transition','M05 fallback finalizer is attached');
select ok(not has_function_privilege('anon','public._bunker_v2_apply_m05_outcome(uuid,uuid,uuid,text,boolean)','EXECUTE'),'M05 outcome helper is server-only');
select has_function('public','_bunker_v2_m05_scenario_key',array['uuid','text'],'M05 has deterministic frozen scenario key helper');
select ok(
  public._bunker_v2_m05_scenario_key('00000000-0000-4000-8000-000000000001'::uuid,'wagon-1') ~ '^route_[0-9a-f]{12}$',
  'M05 scenario key has route_ plus twelve deterministic hex characters'
);
select ok(
  pg_get_functiondef('public._bunker_v2_enrich_m05_instance()'::regprocedure)~'scenarioKey'
  and pg_get_functiondef('public._bunker_v2_enrich_m05_instance()'::regprocedure)~'_bunker_v2_m05_scenario_key',
  'new M05 instances freeze their scenario key in the mission definition'
);
select ok(
  pg_get_functiondef('public.get_owner_bunker_v2_m05(uuid)'::regprocedure) ~ 'get_bunker_v2_m05_screen',
  'M05 owner read delegates to the contract-guarded public projection'
);
select * from finish();
rollback;