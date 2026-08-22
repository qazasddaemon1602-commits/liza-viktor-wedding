begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select has_function(
  'public',
  '_bunker_v2_lock_command_instance',
  array['uuid','uuid','text','jsonb'],
  'V2 command router has a centralized server-deadline guard'
);

select ok(
  pg_get_functiondef('public._bunker_v2_lock_command_instance(uuid,uuid,text,jsonb)'::regprocedure)
    ~ 'deadline_at'
  and pg_get_functiondef('public._bunker_v2_lock_command_instance(uuid,uuid,text,jsonb)'::regprocedure)
    ~ 'clock_timestamp',
  'deadline guard compares the authoritative database deadline with server time'
);

select ok(
  pg_get_functiondef('public._bunker_v2_lock_command_instance(uuid,uuid,text,jsonb)'::regprocedure)
    ~ 'for update',
  'deadline guard locks the mission instance so transition and timer changes cannot race a command'
);

select ok(
  pg_get_functiondef('public.submit_bunker_command(text,text,uuid,text,jsonb)'::regprocedure)
    ~ '_bunker_v2_lock_command_instance',
  'all V2 guest commands pass through the centralized deadline guard before mission dispatch'
);

select ok(
  strpos(
    pg_get_functiondef('public.submit_bunker_command(text,text,uuid,text,jsonb)'::regprocedure),
    'return v_existing.result'
  ) < strpos(
    pg_get_functiondef('public.submit_bunker_command(text,text,uuid,text,jsonb)'::regprocedure),
    '_bunker_v2_lock_command_instance'
  ),
  'an already-accepted idempotent retry still returns its receipt even after the deadline'
);

select * from finish();
rollback;
