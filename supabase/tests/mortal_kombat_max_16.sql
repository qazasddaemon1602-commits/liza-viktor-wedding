begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

insert into auth.users(id) values ('00000000-0000-4000-8000-000000001600');
insert into public.events(id, slug, name, owner_user_id)
values
  ('00000000-0000-4000-8000-000000001601', 'mk-max-16', 'MK max 16', '00000000-0000-4000-8000-000000001600'),
  ('00000000-0000-4000-8000-000000001604', 'mk-max-16-valid', 'MK max 16 valid', '00000000-0000-4000-8000-000000001600'),
  ('00000000-0000-4000-8000-000000001605', 'mk-max-16-invalid', 'MK max 16 invalid', '00000000-0000-4000-8000-000000001600');

select is(
  (select column_default from information_schema.columns
   where table_schema = 'public' and table_name = 'mk_tournaments' and column_name = 'max_players'),
  '16',
  'new tournaments default to sixteen active players'
);

select lives_ok(
  $$ insert into public.mk_tournaments(event_id, state, max_players)
     values ('00000000-0000-4000-8000-000000001604', 'registration', 16) $$,
  'the authoritative tournament capacity accepts sixteen'
);
select throws_ok(
  $$ insert into public.mk_tournaments(event_id, state, max_players)
     values ('00000000-0000-4000-8000-000000001605', 'registration', 17) $$,
  '23514', null,
  'the authoritative tournament capacity rejects seventeen'
);

insert into public.carriages(id, event_id, number, label, accent_hex, visual_mark, sort_order, enabled)
values ('00000000-0000-4000-8000-000000001602', '00000000-0000-4000-8000-000000001601', 1, 'ВАГОН №1', '#111111', 'I', 1, true);
insert into public.guests(
  id, event_id, first_name, last_name, affiliation_type, carriage_id, ticket_sequence, ticket_number
)
select
  ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-000000001601'::uuid,
  'Игрок', n::text, 'common', '00000000-0000-4000-8000-000000001602'::uuid,
  n, 'MK-' || lpad(n::text, 3, '0')
from generate_series(1, 20) n;

insert into public.mk_tournaments(id, event_id, state, max_players)
values ('00000000-0000-4000-8000-000000001603', '00000000-0000-4000-8000-000000001601', 'registration', 16);

insert into public.mk_registrations(
  id, tournament_id, guest_id, display_name, status, seed, registered_at
)
select
  ('20000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-000000001603'::uuid,
  ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'Игрок ' || n,
  case when n <= 18 then 'active' else 'waitlist' end,
  case when n <= 16 then n else null end,
  timestamptz '2026-08-23 10:00:00+00' + n * interval '1 second'
from generate_series(1, 20) n;

select lives_ok(
  $$ select public._repair_mk_max_16_data() $$,
  'pre-start oversize data is repaired without deleting registrations'
);
select is(
  (select count(*)::integer from public.mk_registrations where tournament_id = '00000000-0000-4000-8000-000000001603' and status = 'active'),
  16,
  'only the earliest sixteen registrations remain active'
);
select results_eq(
  $$ select right(id::text, 12) from public.mk_registrations
     where tournament_id = '00000000-0000-4000-8000-000000001603' and status = 'waitlist'
     order by registered_at, id $$,
  $$ values ('000000000017'::text), ('000000000018'::text), ('000000000019'::text), ('000000000020'::text) $$,
  'overflow appends ahead of later existing waitlist rows in stable registration order'
);
select is(
  (select count(*)::integer from public.mk_registrations where tournament_id = '00000000-0000-4000-8000-000000001603'),
  20,
  'repair preserves every registration row'
);
select is(
  (select count(*)::integer from public.mk_registrations where tournament_id = '00000000-0000-4000-8000-000000001603' and seed is not null),
  0,
  'repair clears all active and waitlisted pre-start seeds'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001600', true);
select throws_ok(
  $$ select public.owner_promote_mk_waitlist('20000000-0000-4000-8000-000000000017') $$,
  '55000', 'active bracket is full',
  'a full sixteen-player pool refuses waitlist promotion'
);

update public.mk_registrations set status = 'waitlist' where id = '20000000-0000-4000-8000-000000000016';
select is(
  public.owner_promote_mk_waitlist('20000000-0000-4000-8000-000000000017')->>'status',
  'active',
  'promotion fills an available sixteenth slot'
);

update public.mk_registrations set status = 'active', seed = null
where tournament_id = '00000000-0000-4000-8000-000000001603' and id <= '20000000-0000-4000-8000-000000000017';
select throws_ok(
  $$ select public.owner_finalize_mk_draw('00000000-0000-4000-8000-000000001601') $$,
  '55000', 'between 2 and 16 active players required',
  'draw rejects seventeen active registrations even if bad data bypassed admission'
);

update public.mk_registrations set status = case when right(id::text, 12)::integer <= 16 then 'active' else 'waitlist' end,
  seed = case when right(id::text, 12)::integer <= 16 then right(id::text, 12)::integer else null end
where tournament_id = '00000000-0000-4000-8000-000000001603';
select is(public.owner_finalize_mk_draw('00000000-0000-4000-8000-000000001601')->>'bracketSize', '16', 'sixteen players draw a sixteen-slot bracket');
select is((select count(*)::integer from public.mk_matches where tournament_id = '00000000-0000-4000-8000-000000001603'), 15, 'sixteen-player bracket has fifteen internal bouts');
select is((select count(*)::integer from public.mk_matches where tournament_id = '00000000-0000-4000-8000-000000001603' and round = 'r16'), 8, 'sixteen-player bracket opens with eight R16 bouts');

select is(
  public.owner_reset_mk_tournament('00000000-0000-4000-8000-000000001601', 'СБРОСИТЬ ТУРНИР')->>'status',
  'reset',
  'confirmed reset remains available after a sixteen-player draw'
);
select is((select max_players from public.mk_tournaments where id = '00000000-0000-4000-8000-000000001603'), 16, 'reset restores the sixteen-player contract');

insert into public.mk_registrations(id, tournament_id, guest_id, display_name, status, registered_at)
select
  ('30000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-000000001603'::uuid,
  ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'Игрок ' || n, 'active', now() + n * interval '1 second'
from generate_series(1, 17) n;
update public.mk_tournaments set state = 'active' where id = '00000000-0000-4000-8000-000000001603';
select throws_ok(
  $$ select public._repair_mk_max_16_data() $$,
  '55000', 'MK_MAX_16_REQUIRES_RESET',
  'an active oversize tournament requires explicit reset'
);

update public.mk_tournaments set state = 'complete' where id = '00000000-0000-4000-8000-000000001603';
delete from public.mk_registrations where tournament_id = '00000000-0000-4000-8000-000000001603' and right(id::text, 12)::integer > 2;
alter table public.mk_matches drop constraint mk_matches_round_check;
insert into public.mk_matches(tournament_id, match_key, round, position, status)
values ('00000000-0000-4000-8000-000000001603', 'r32-1', 'r32', 1, 'pending');
select throws_ok(
  $$ select public._repair_mk_max_16_data() $$,
  '55000', 'MK_MAX_16_REQUIRES_RESET',
  'a completed legacy R32 bracket requires explicit reset'
);

select ok(not has_function_privilege('anon', 'public._repair_mk_max_16_data()', 'EXECUTE'), 'anonymous clients cannot invoke repair helper');
select ok(not has_function_privilege('authenticated', 'public._repair_mk_max_16_data()', 'EXECUTE'), 'authenticated clients cannot invoke repair helper');
select ok(coalesce((select 'search_path=public, pg_temp' = any(proconfig) from pg_proc where oid = 'public._repair_mk_max_16_data()'::regprocedure), false), 'repair helper pins its search path');

select * from finish();
rollback;
