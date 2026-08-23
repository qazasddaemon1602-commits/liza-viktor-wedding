begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_get_mk_control'), 'owner MK control projection exists');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_randomize_mk_seeds'), 'owner can randomize seeds');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_swap_mk_seeds'), 'owner can swap two seed positions');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_replace_mk_player'), 'owner can replace a no-show before start');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_finalize_mk_draw'), 'owner can finalize a maximum 16-player draw');

select ok(not has_function_privilege('anon', 'public.owner_get_mk_control(uuid)', 'EXECUTE'), 'anonymous cannot load owner MK control');
select ok(not has_function_privilege('anon', 'public.owner_randomize_mk_seeds(uuid)', 'EXECUTE'), 'anonymous cannot randomize MK draw');
select ok(not has_function_privilege('anon', 'public.owner_swap_mk_seeds(uuid,uuid)', 'EXECUTE'), 'anonymous cannot swap MK seeds');
select ok(not has_function_privilege('anon', 'public.owner_finalize_mk_draw(uuid)', 'EXECUTE'), 'anonymous cannot start MK bracket');
select ok(has_function_privilege('authenticated', 'public.owner_get_mk_control(uuid)', 'EXECUTE'), 'authenticated owner session may call control projection');

select ok(
  position('count(*)' in lower(pg_get_functiondef('public.owner_finalize_mk_draw(uuid)'::regprocedure))) > 0,
  'final draw validates the active-player count server-side'
);
select ok(
  position('mk_matches' in lower(pg_get_functiondef('public.owner_finalize_mk_draw(uuid)'::regprocedure))) > 0,
  'final draw creates the server-authoritative matches'
);

select ok(
  exists(
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'owner_reset_mk_tournament'
      and pg_get_function_identity_arguments(p.oid) = 'p_event_id uuid, p_confirmation text'
  ),
  'owner has a dedicated confirmed MK-only reset RPC'
);
select ok(
  not has_function_privilege('anon', 'public.owner_reset_mk_tournament(uuid,text)', 'EXECUTE'),
  'anonymous clients cannot reset the tournament'
);
select ok(
  has_function_privilege('authenticated', 'public.owner_reset_mk_tournament(uuid,text)', 'EXECUTE'),
  'authenticated owner session may invoke the confirmed tournament reset'
);
select ok(
  position('СБРОСИТЬ ТУРНИР' in pg_get_functiondef('public.owner_reset_mk_tournament(uuid,text)'::regprocedure)) > 0,
  'tournament reset requires the explicit Russian confirmation phrase server-side'
);
select ok(
  position('delete from public.mk_matches' in lower(pg_get_functiondef('public.owner_reset_mk_tournament(uuid,text)'::regprocedure))) > 0
  and position('delete from public.mk_registrations' in lower(pg_get_functiondef('public.owner_reset_mk_tournament(uuid,text)'::regprocedure))) > 0
  and position('update public.mk_tournaments' in lower(pg_get_functiondef('public.owner_reset_mk_tournament(uuid,text)'::regprocedure))) > 0,
  'tournament reset clears MK matches and signups while preserving its reusable configuration row'
);
select ok(
  position('delete from public.guests' in lower(pg_get_functiondef('public.owner_reset_mk_tournament(uuid,text)'::regprocedure))) = 0
  and position('delete from public.couple_preanswers' in lower(pg_get_functiondef('public.owner_reset_mk_tournament(uuid,text)'::regprocedure))) = 0,
  'MK-only reset never deletes wedding registrations or couple answers'
);

insert into auth.users(id)
values
  ('00000000-0000-4000-8000-000000000951'),
  ('00000000-0000-4000-8000-000000000952');

insert into public.events(id, slug, name, owner_user_id)
values (
  '00000000-0000-4000-8000-000000000953',
  'mk-reset-behavior',
  'MK reset behavior',
  '00000000-0000-4000-8000-000000000951'
);

insert into public.event_state(event_id, current_module, screen_mode, screen_pinned)
values (
  '00000000-0000-4000-8000-000000000953',
  'mortal_kombat',
  'mortal_kombat',
  true
);

insert into public.carriages(
  id, event_id, number, label, accent_hex, visual_mark, sort_order, enabled
)
values (
  '00000000-0000-4000-8000-000000000954',
  '00000000-0000-4000-8000-000000000953',
  1, 'ВАГОН №1', '#111111', 'I', 1, true
);

insert into public.guests(
  id, event_id, first_name, last_name, affiliation_type, carriage_id,
  ticket_sequence, ticket_number
)
values
  (
    '00000000-0000-4000-8000-000000000955',
    '00000000-0000-4000-8000-000000000953',
    'Игрок', 'Один', 'common',
    '00000000-0000-4000-8000-000000000954', 1, 'MK-001'
  ),
  (
    '00000000-0000-4000-8000-000000000956',
    '00000000-0000-4000-8000-000000000953',
    'Игрок', 'Два', 'common',
    '00000000-0000-4000-8000-000000000954', 2, 'MK-002'
  );

insert into public.questions(id, event_id, text, sort_order)
values (
  '00000000-0000-4000-8000-000000000957',
  '00000000-0000-4000-8000-000000000953',
  'Сохранится ли ответ пары?',
  1
);

insert into public.couple_preanswers(event_id, question_id, choice)
values (
  '00000000-0000-4000-8000-000000000953',
  '00000000-0000-4000-8000-000000000957',
  'liza'
);

insert into public.mk_tournaments(id, event_id, state)
values (
  '00000000-0000-4000-8000-000000000958',
  '00000000-0000-4000-8000-000000000953',
  'active'
);

insert into public.mk_registrations(
  id, tournament_id, guest_id, display_name, status, seed
)
values
  (
    '00000000-0000-4000-8000-000000000959',
    '00000000-0000-4000-8000-000000000958',
    '00000000-0000-4000-8000-000000000955',
    'Игрок Один', 'active', 1
  ),
  (
    '00000000-0000-4000-8000-000000000960',
    '00000000-0000-4000-8000-000000000958',
    '00000000-0000-4000-8000-000000000956',
    'Игрок Два', 'active', 2
  );

insert into public.mk_matches(
  id, tournament_id, match_key, round, position,
  player1_guest_id, player2_guest_id, status
)
values (
  '00000000-0000-4000-8000-000000000961',
  '00000000-0000-4000-8000-000000000958',
  'final-1', 'final', 1,
  '00000000-0000-4000-8000-000000000955',
  '00000000-0000-4000-8000-000000000956',
  'ready'
);

update public.mk_tournaments
set current_match_id = '00000000-0000-4000-8000-000000000961'
where id = '00000000-0000-4000-8000-000000000958';

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000952',
  true
);

select throws_ok(
  $$ select public.owner_reset_mk_tournament(
    '00000000-0000-4000-8000-000000000953', 'СБРОСИТЬ ТУРНИР'
  ) $$,
  '42501',
  'owner access required',
  'a different authenticated user cannot reset this event tournament'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000951',
  true
);

select throws_ok(
  $$ select public.owner_reset_mk_tournament(
    '00000000-0000-4000-8000-000000000953', 'СБРОСИТЬ'
  ) $$,
  '22023',
  'Для сброса введите: СБРОСИТЬ ТУРНИР',
  'the owner cannot bypass the exact confirmation phrase'
);
select is(
  (select count(*)::integer from public.mk_registrations
   where tournament_id = '00000000-0000-4000-8000-000000000958'),
  2,
  'a rejected reset leaves MK registrations unchanged'
);

select lives_ok(
  $$ select public.owner_reset_mk_tournament(
    '00000000-0000-4000-8000-000000000953', 'СБРОСИТЬ ТУРНИР'
  ) $$,
  'the owner can perform the confirmed MK-only reset'
);
select is(
  (select count(*)::integer from public.mk_matches
   where tournament_id = '00000000-0000-4000-8000-000000000958'),
  0,
  'confirmed reset deletes the tournament matches'
);
select is(
  (select count(*)::integer from public.mk_registrations
   where tournament_id = '00000000-0000-4000-8000-000000000958'),
  0,
  'confirmed reset deletes only tournament signups'
);
select is(
  (select state from public.mk_tournaments
   where id = '00000000-0000-4000-8000-000000000958'),
  'registration',
  'confirmed reset preserves and reopens the reusable tournament row'
);
select is(
  (select count(*)::integer from public.guests
   where event_id = '00000000-0000-4000-8000-000000000953'),
  2,
  'confirmed reset preserves wedding guest registrations'
);
select is(
  (select count(*)::integer from public.couple_preanswers
   where event_id = '00000000-0000-4000-8000-000000000953'),
  1,
  'confirmed reset preserves couple preanswers'
);
select is(
  (select current_module from public.event_state
   where event_id = '00000000-0000-4000-8000-000000000953'),
  'idle',
  'confirmed reset releases the shared projector only from MK'
);
select is(
  public.owner_reset_mk_tournament(
    '00000000-0000-4000-8000-000000000953', 'СБРОСИТЬ ТУРНИР'
  )->>'status',
  'reset',
  'a second confirmed reset is idempotent'
);
select is(
  (select count(*)::integer from public.mk_matches
   where tournament_id = '00000000-0000-4000-8000-000000000958')
  +
  (select count(*)::integer from public.mk_registrations
   where tournament_id = '00000000-0000-4000-8000-000000000958'),
  0,
  'idempotent reset keeps MK runtime empty'
);

select * from finish();
rollback;
