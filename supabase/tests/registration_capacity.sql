begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

insert into auth.users(id)
values ('00000000-0000-4000-8000-000000000901');

insert into public.events(
  id, slug, name, owner_user_id, expected_guest_count
)
values (
  '00000000-0000-4000-8000-000000000902',
  'registration-capacity',
  'Registration capacity',
  '00000000-0000-4000-8000-000000000901',
  100
);

insert into public.carriages(
  id, event_id, number, label, accent_hex, visual_mark, sort_order, enabled
)
values (
  '00000000-0000-4000-8000-000000000903',
  '00000000-0000-4000-8000-000000000902',
  1, 'ВАГОН №1', '#111111', 'I', 1, true
);

insert into public.guests(
  id, event_id, first_name, last_name, affiliation_type, carriage_id,
  ticket_sequence, ticket_number
)
select
  ('00000000-0000-4000-8000-' || lpad(sequence::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-000000000902',
  'Гость', sequence::text, 'common',
  '00000000-0000-4000-8000-000000000903',
  sequence, 'CAP-' || lpad(sequence::text, 3, '0')
from generate_series(1, 40) as registered(sequence);

select throws_ok(
  $$ select public.register_guest(
    'registration-capacity', 'new-device-0001', 'Новый', 'Гость',
    'common', null, true
  ) $$,
  '55000',
  'registration capacity reached',
  'public registration cannot exceed the hard forty-player ceiling'
);

insert into public.guest_device_bindings(event_id, guest_id, device_key_hash)
values (
  '00000000-0000-4000-8000-000000000902',
  '00000000-0000-4000-8000-000000000001',
  public._device_hash('known-device-0001')
);

select is(
  public.register_guest(
    'registration-capacity', 'known-device-0001', 'Гость', '1',
    'common', null, false
  )->>'status',
  'restored',
  'an existing device can still restore its guest at capacity'
);

update public.events
set expected_guest_count = 15
where id = '00000000-0000-4000-8000-000000000902';

delete from public.guest_device_bindings
where event_id = '00000000-0000-4000-8000-000000000902';

delete from public.guests
where event_id = '00000000-0000-4000-8000-000000000902'
  and ticket_sequence > 15;

select throws_ok(
  $$ select public.register_guest(
    'registration-capacity', 'new-device-0002', 'Шестнадцатый', 'Гость',
    'common', null, true
  ) $$,
  '55000',
  'registration capacity reached',
  'event expected guest count is enforced below the hard ceiling'
);

select * from finish();
rollback;
