begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select has_function('public','get_bunker_v2_results',array['text'],'public Bunker V2 result summary exists');
select ok(has_function_privilege('anon','public.get_bunker_v2_results(text)','EXECUTE'),'result summary is readable by the public event screen');
select ok(pg_get_functiondef('public.get_bunker_v2_results(text)'::regprocedure)!~'4719','result source does not contain access code');
select ok(pg_get_functiondef('public.get_bunker_v2_results(text)'::regprocedure)!~'LV0830','result source does not contain final password');
select ok(pg_get_functiondef('public.get_bunker_v2_results(text)'::regprocedure)~'coordinationScore','result includes coordination score');
select ok(pg_get_functiondef('public.get_bunker_v2_results(text)'::regprocedure)~'wrongAttempts','result includes final mistakes');
select has_function('public','_bunker_v2_mission_stage_counts',array['uuid','uuid'],'results have a stage-level mission counter');
select ok(
  pg_get_functiondef('public.get_bunker_v2_results(text)'::regprocedure)~'_bunker_v2_mission_stage_counts',
  'public results use six story stages instead of counting per-wagon mission instances'
);
select ok(
  pg_get_functiondef('public.get_bunker_v2_results(text)'::regprocedure)~'statement_timestamp'
  and pg_get_functiondef('public.get_bunker_v2_results(text)'::regprocedure)!~'clock_timestamp',
  'STABLE results use one statement-stable server timestamp'
);

select * from finish();
rollback;