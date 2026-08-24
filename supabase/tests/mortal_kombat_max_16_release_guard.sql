begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select ok(
  exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.mk_tournaments'::regclass
      and c.conname = 'mk_tournaments_max_players_check'
      and pg_get_constraintdef(c.oid) ~* 'max_players\s*=\s*16'
  ),
  'MK tournament schema is hard-limited to 16 players'
);

select is(
  (select pg_get_expr(d.adbin, d.adrelid)
   from pg_attrdef d
   join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
   where d.adrelid = 'public.mk_tournaments'::regclass
     and a.attname = 'max_players'),
  '16',
  'MK max_players default is 16'
);

select ok(
  pg_get_functiondef('public.owner_open_mk_registration(uuid)'::regprocedure)
    ~ $$max_players, updated_at\)\s*values \(p_event_id, 'registration', 16, now\(\)\)$$,
  'owner open-registration RPC creates a 16-player tournament'
);

select ok(
  pg_get_functiondef('public._mk_next_match(text,integer)'::regprocedure) !~ $$'r64'|'r32'$$,
  'MK progression no longer exposes legacy r64/r32 rounds'
);

select * from finish();
rollback;
