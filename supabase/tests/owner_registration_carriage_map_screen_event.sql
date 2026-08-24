begin;

create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users(id)
values
  ('00000000-0000-4000-8000-000000000751'),
  ('00000000-0000-4000-8000-000000000752');

insert into public.events(id, slug, name, owner_user_id, expected_guest_count)
values (
  '00000000-0000-4000-8000-000000000753',
  'owner-carriage-map-screen-event',
  'Owner carriage map screen event',
  '00000000-0000-4000-8000-000000000751',
  2
);

insert into public.carriages(id, event_id, number, label, accent_hex, visual_mark, sort_order, enabled)
values
  ('00000000-0000-4000-8000-000000000754', '00000000-0000-4000-8000-000000000753', 1, 'ВАГОН №1', '#31483A', '01', 1, true),
  ('00000000-0000-4000-8000-000000000755', '00000000-0000-4000-8000-000000000753', 2, 'ВАГОН №2', '#9A6348', '02', 2, true);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000751', true);

select is(
  public.owner_publish_registration_carriage_map('00000000-0000-4000-8000-000000000753')->>'status',
  'published',
  'the authenticated owner can publish the current map'
);

select is(
  (
    select event.kind
    from public.screen_events event
    where event.event_id = '00000000-0000-4000-8000-000000000753'
    order by event.created_at desc
    limit 1
  ),
  'carriage_map_show',
  'the owner command persists a short-lived projector event'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000752', true);

select throws_ok(
  $$select public.owner_publish_registration_carriage_map('00000000-0000-4000-8000-000000000753')$$,
  '42501',
  'owner access required or event not found',
  'another authenticated user cannot publish the map'
);

select * from finish();
rollback;
