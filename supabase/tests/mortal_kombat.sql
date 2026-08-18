begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

select has_table('public', 'mk_tournaments', 'MK tournament table exists');
select has_table('public', 'mk_registrations', 'MK registration table exists');
select has_table('public', 'mk_matches', 'MK matches table exists');

select has_column('public', 'mk_tournaments', 'state', 'tournament tracks lifecycle state');
select has_column('public', 'mk_registrations', 'guest_id', 'registration references canonical guest');
select has_column('public', 'mk_registrations', 'status', 'registration tracks active/waitlist/withdrawn');
select has_column('public', 'mk_registrations', 'display_name', 'public bracket uses stable display-name snapshot');
select has_column('public', 'mk_registrations', 'seed', 'active player can have owner-controlled seed');
select has_column('public', 'mk_matches', 'match_key', 'match has stable bracket key');
select has_column('public', 'mk_matches', 'winner_guest_id', 'match stores authoritative winner');

select ok(
  exists(
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'mk_registrations'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) ilike '%tournament_id%guest_id%'
  ),
  'guest can enter one tournament only once'
);

select ok(
  exists(
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public'
      and p.proname='join_mk_tournament'
      and pg_get_function_identity_arguments(p.oid)='p_event_slug text, p_device_key text'
  ),
  'guest signup uses trusted event/device identity contract'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_mk_tournament_state'),
  'public safe tournament projection RPC exists'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_open_mk_registration'),
  'owner can open MK registration'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_close_mk_registration'),
  'owner can close MK registration'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_promote_mk_waitlist'),
  'owner can promote one waitlisted player'
);
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_remove_mk_player'),
  'owner can withdraw one MK player'
);

select ok(
  not has_table_privilege('anon', 'public.mk_registrations', 'SELECT'),
  'anonymous users cannot enumerate raw registrations'
);
select ok(
  has_function_privilege('anon', 'public.join_mk_tournament(text,text)', 'EXECUTE'),
  'registered anonymous guest may call guarded signup RPC'
);

select * from finish();
rollback;
