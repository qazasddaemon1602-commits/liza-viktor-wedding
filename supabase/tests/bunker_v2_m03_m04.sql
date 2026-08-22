begin;
create extension if not exists pgtap with schema extensions;
select plan(15);
select has_function('public','get_guest_bunker_v2_m03',array['text','text'],'M03 guest read model');
select has_function('public','get_bunker_v2_m03_screen',array['text'],'M03 TV read model');
select has_function('public','get_owner_bunker_v2_m03',array['uuid'],'M03 owner read model');
select has_function('public','_bunker_v2_consume_inventory',array['uuid','uuid','uuid','text','integer','uuid'],'M03 atomic inventory helper');
select has_table('public','bunker_intercarriage_messages','M04 durable message table');
select has_function('public','get_guest_bunker_v2_m04',array['text','text'],'M04 guest read model');
select has_function('public','get_bunker_v2_m04_screen',array['text'],'M04 TV read model');
select has_function('public','get_owner_bunker_v2_m04',array['uuid'],'M04 owner read model');
select ok(not has_table_privilege('anon','public.bunker_intercarriage_messages','SELECT') and not has_table_privilege('authenticated','public.bunker_intercarriage_messages','SELECT'),'M04 messages are RPC-only');
select ok(pg_get_functiondef('public.submit_bunker_command(text,text,uuid,text,jsonb)'::regprocedure)~'_submit_bunker_command_m03' and pg_get_functiondef('public.submit_bunker_command(text,text,uuid,text,jsonb)'::regprocedure)~'_submit_bunker_command_m04','command router covers M03/M04');
select ok(pg_get_functiondef('public._submit_bunker_command_m04(text,text,uuid,text,jsonb)'::regprocedure)~'char_length' and pg_get_functiondef('public._submit_bunker_command_m04(text,text,uuid,text,jsonb)'::regprocedure)~'120','M04 enforces 120 chars server-side');
select ok(pg_get_functiondef('public._submit_bunker_command_m04(text,text,uuid,text,jsonb)'::regprocedure)~'for update','M04 transfer settlement uses row locks');
select ok(
  pg_get_functiondef('public.get_guest_bunker_v2_m04(text,text)'::regprocedure) !~ '\.real_name'
  and pg_get_functiondef('public.get_guest_bunker_v2_m04(text,text)'::regprocedure) ~ 'first_name'
  and pg_get_functiondef('public.get_guest_bunker_v2_m04(text,text)'::regprocedure) ~ 'last_name',
  'M04 message sender uses the real guests schema instead of a nonexistent real_name column'
);
select ok(
  pg_get_functiondef('public.get_owner_bunker_v2_m03(uuid)'::regprocedure) ~ 'get_bunker_v2_m03_screen',
  'M03 owner read delegates to the contract-guarded public projection'
);
select ok(
  pg_get_functiondef('public.get_owner_bunker_v2_m04(uuid)'::regprocedure) ~ 'get_bunker_v2_m04_screen',
  'M04 owner read delegates to the contract-guarded public projection'
);
select * from finish();
rollback;
