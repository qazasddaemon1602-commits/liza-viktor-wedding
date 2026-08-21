begin;

create extension if not exists pgtap with schema extensions;

select plan(23);

insert into auth.users(id)
values ('00000000-0000-4000-8000-000000009401');

insert into public.events(id, slug, name, owner_user_id, expected_guest_count)
values (
  '00000000-0000-4000-8000-000000009402',
  'mk-forty-contract',
  'MK forty contract',
  '00000000-0000-4000-8000-000000009401',
  40
);

insert into public.carriages(
  id, event_id, number, label, accent_hex, visual_mark, sort_order, enabled
)
values (
  '00000000-0000-4000-8000-000000009403',
  '00000000-0000-4000-8000-000000009402',
  1, 'ВАГОН №1', '#111111', 'I', 1, true
);

insert into public.guests(
  id, event_id, first_name, last_name, affiliation_type, carriage_id,
  ticket_sequence, ticket_number
)
select
  ('00000000-0000-4000-8000-' || lpad(sequence::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-000000009402',
  'Игрок', sequence::text, 'common',
  '00000000-0000-4000-8000-000000009403',
  sequence, 'MK40-' || lpad(sequence::text, 2, '0')
from generate_series(1, 40) as player(sequence);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000009401',
  true
);

create or replace function pg_temp.prepare_mk_count(p_count integer)
returns uuid
language plpgsql
set search_path = pg_temp, public
as $$
declare
  v_tournament_id uuid;
begin
  delete from public.mk_tournaments
  where event_id = '00000000-0000-4000-8000-000000009402';

  perform public.owner_open_mk_registration('00000000-0000-4000-8000-000000009402');

  select id into v_tournament_id
  from public.mk_tournaments
  where event_id = '00000000-0000-4000-8000-000000009402';

  insert into public.mk_registrations(
    tournament_id, guest_id, display_name, status, seed
  )
  select
    v_tournament_id,
    g.id,
    concat_ws(' ', g.first_name, g.last_name),
    'active',
    row_number() over(order by g.ticket_sequence)::integer
  from public.guests g
  where g.event_id = '00000000-0000-4000-8000-000000009402'
  order by g.ticket_sequence
  limit p_count;

  return v_tournament_id;
end;
$$;

create or replace function pg_temp.finalize_mk_count(p_count integer)
returns jsonb
language plpgsql
set search_path = pg_temp, public
as $$
begin
  perform pg_temp.prepare_mk_count(p_count);
  return public.owner_finalize_mk_draw('00000000-0000-4000-8000-000000009402');
end;
$$;

select is(
  public.owner_get_mk_control('00000000-0000-4000-8000-000000009402')->>'status',
  'idle',
  'creating an event does not open tournament registration implicitly'
);

select is(
  public.get_mk_tournament_state('mk-forty-contract', null)->>'status',
  'idle',
  'public projection also stays idle before the owner opens registration'
);

select is(
  public.owner_open_mk_registration('00000000-0000-4000-8000-000000009402')->>'maxPlayers',
  '40',
  'opening a tournament exposes the forty-player capacity'
);

select throws_ok(
  $$ select public.owner_close_mk_registration('00000000-0000-4000-8000-000000009402') $$,
  '55000',
  'at least 2 active players required',
  'registration cannot close into a dead end with zero players'
);

select is(
  (select public.owner_close_mk_registration('00000000-0000-4000-8000-000000009402')->>'maxPlayers'
   from (select pg_temp.prepare_mk_count(2)) prepared),
  '40',
  'closing a valid registration preserves the forty-player capacity contract'
);

select throws_ok(
  $$ select pg_temp.finalize_mk_count(0) $$,
  '55000',
  'between 2 and 40 active players required',
  'zero players stays a preparation state'
);

select throws_ok(
  $$ select pg_temp.finalize_mk_count(1) $$,
  '55000',
  'between 2 and 40 active players required',
  'one player stays a preparation state'
);

select is(pg_temp.finalize_mk_count(2)->>'matches', '1', 'two players build one final');
select is(pg_temp.finalize_mk_count(3)->>'matches', '3', 'three players build a four-slot tree');
select is(pg_temp.finalize_mk_count(9)->>'matches', '15', 'nine players build a sixteen-slot tree');
select is(pg_temp.finalize_mk_count(16)->>'matches', '15', 'sixteen players build a sixteen-slot tree');
select is(pg_temp.finalize_mk_count(17)->>'matches', '31', 'seventeen players build a thirty-two-slot tree');
select is(pg_temp.finalize_mk_count(40)->>'matches', '63', 'forty players build a sixty-four-slot tree');

select is(
  (select count(*)::text from public.mk_matches m
   join public.mk_tournaments t on t.id = m.tournament_id
   where t.event_id = '00000000-0000-4000-8000-000000009402'
     and m.round = 'r64'),
  '32',
  'forty-player draw has thirty-two opening match slots'
);

select is(
  (public.owner_get_mk_control('00000000-0000-4000-8000-000000009402')->>'maxPlayers'),
  '40',
  'owner projection keeps the same capacity contract'
);

select isnt(
  (select m.status from public.mk_matches m
   join public.mk_tournaments t on t.id = m.tournament_id
   where t.event_id = '00000000-0000-4000-8000-000000009402'
     and m.round = 'final' and m.position = 1),
  'complete',
  'the final never resolves during draw generation'
);

select results_eq(
  $$ select * from public._mk_next_match('r64', 32) $$,
  $$ values ('r32'::text, 16, 'player2'::text) $$,
  'r64 feeds the correct r32 slot'
);

select results_eq(
  $$ select * from public._mk_next_match('r32', 1) $$,
  $$ values ('r16'::text, 1, 'player1'::text) $$,
  'r32 feeds the correct r16 slot'
);

create temporary table r64_probe as
select m.id, m.player1_guest_id
from public.mk_matches m
join public.mk_tournaments t on t.id = m.tournament_id
where t.event_id = '00000000-0000-4000-8000-000000009402'
  and m.round = 'r64'
  and m.status = 'ready'
order by m.position
limit 1;

select is(
  (select public.owner_record_mk_winner(id, player1_guest_id, false)->>'status' from r64_probe),
  'recorded',
  'a real r64 fight result propagates through the sixty-four-slot tree'
);

select is(
  (select m.status from public.mk_matches m join r64_probe p on p.id = m.id),
  'complete',
  'recording the r64 winner completes the source fight'
);

select is(
  (select public.owner_undo_mk_result(id, false)->>'status' from r64_probe),
  'undone',
  'an r64 result can be undone before downstream fights are complete'
);

select is(
  (select m.status from public.mk_matches m join r64_probe p on p.id = m.id),
  'ready',
  'undo restores the r64 fight to its ready state'
);

do $$
begin
  perform pg_temp.finalize_mk_count(9);
end;
$$;

select is(
  (select concat_ws('/', r1.seed::text, r2.seed::text)
   from public.mk_matches m
   join public.mk_tournaments t on t.id = m.tournament_id
   join public.mk_registrations r1 on r1.guest_id = m.player1_guest_id and r1.tournament_id = t.id
   join public.mk_registrations r2 on r2.guest_id = m.player2_guest_id and r2.tournament_id = t.id
   where t.event_id = '00000000-0000-4000-8000-000000009402'
     and m.match_key = 'r16-2'),
  '8/9',
  'nine-player byes use deterministic standard seeding'
);

select * from finish();
rollback;
