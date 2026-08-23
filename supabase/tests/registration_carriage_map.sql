begin;

create extension if not exists pgtap with schema extensions;

select plan(38);

create or replace function pg_temp.call_registration_carriage_map(p_event_slug text)
returns jsonb
language plpgsql
as $$
declare
  v_result jsonb;
begin
  if pg_catalog.to_regprocedure(
    'public.get_registration_carriage_map(text)'
  ) is null then
    return null;
  end if;

  execute 'select public.get_registration_carriage_map($1)'
    into v_result
    using p_event_slug;

  return v_result;
end;
$$;

select has_function(
  'public',
  'get_registration_carriage_map',
  array['text'],
  'public registration carriage map RPC exists'
);

select ok(
  coalesce(
    (
      select procedure.prosecdef
      from pg_proc procedure
      join pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = 'get_registration_carriage_map'
        and pg_get_function_identity_arguments(procedure.oid) =
          'p_event_slug text'
    ),
    false
  ),
  'registration carriage map is SECURITY DEFINER'
);

select ok(
  coalesce(
    (
      select 'search_path=""' = any(procedure.proconfig)
      from pg_proc procedure
      join pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = 'get_registration_carriage_map'
        and pg_get_function_identity_arguments(procedure.oid) =
          'p_event_slug text'
    ),
    false
  ),
  'registration carriage map has a fixed empty search path'
);

select ok(
  coalesce(
    (
      select has_function_privilege('anon', procedure.oid, 'EXECUTE')
      from pg_proc procedure
      join pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = 'get_registration_carriage_map'
        and pg_get_function_identity_arguments(procedure.oid) =
          'p_event_slug text'
    ),
    false
  ),
  'anonymous projectors can execute the registration carriage map RPC'
);

select ok(
  coalesce(
    (
      select has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      from pg_proc procedure
      join pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = 'get_registration_carriage_map'
        and pg_get_function_identity_arguments(procedure.oid) =
          'p_event_slug text'
    ),
    false
  ),
  'authenticated projectors can execute the registration carriage map RPC'
);

select ok(
  not exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    cross join lateral aclexplode(
      coalesce(procedure.proacl, acldefault('f', procedure.proowner))
    ) privilege
    where namespace.nspname = 'public'
      and procedure.proname = 'get_registration_carriage_map'
      and pg_get_function_identity_arguments(procedure.oid) =
        'p_event_slug text'
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  'registration carriage map is not executable through the PUBLIC role'
);

insert into auth.users(id)
values ('83000000-0000-4000-8000-000000000001');

alter table public.events
  drop constraint events_expected_guest_count_check;
alter table public.guests
  alter column carriage_id drop not null;

insert into public.events(
  id, slug, name, expected_guest_count, owner_user_id, next_ticket_sequence
)
values
  (
    '83000000-0000-4000-8000-000000000010',
    'registration-carriage-map-main',
    'Registration carriage map main fixture',
    8,
    '83000000-0000-4000-8000-000000000001',
    8
  ),
  (
    '83000000-0000-4000-8000-000000000020',
    'registration-carriage-map-complete',
    'Registration carriage map complete fixture',
    2,
    '83000000-0000-4000-8000-000000000001',
    3
  ),
  (
    '83000000-0000-4000-8000-000000000030',
    'registration-carriage-map-zero',
    'Registration carriage map zero fixture',
    0,
    '83000000-0000-4000-8000-000000000001',
    2
  ),
  (
    '83000000-0000-4000-8000-000000000040',
    'registration-carriage-map-cap',
    'Registration carriage map cap fixture',
    45,
    '83000000-0000-4000-8000-000000000001',
    41
  );

insert into public.event_state(event_id)
values
  ('83000000-0000-4000-8000-000000000010'),
  ('83000000-0000-4000-8000-000000000020'),
  ('83000000-0000-4000-8000-000000000030'),
  ('83000000-0000-4000-8000-000000000040');

insert into public.carriages(
  id, event_id, number, label, accent_hex, visual_mark, sort_order, enabled
)
values
  ('83000000-0000-4000-8000-000000000011', '83000000-0000-4000-8000-000000000010', 4, 'ВАГОН №4', '#444444', 'IV', 1, true),
  ('83000000-0000-4000-8000-000000000012', '83000000-0000-4000-8000-000000000010', 2, 'ВАГОН №2', '#222222', 'II', 2, true),
  ('83000000-0000-4000-8000-000000000013', '83000000-0000-4000-8000-000000000010', 5, 'ВАГОН №5', '#555555', 'V', 3, true),
  ('83000000-0000-4000-8000-000000000014', '83000000-0000-4000-8000-000000000010', 1, 'ВАГОН №1', '#111111', 'I', 4, true),
  ('83000000-0000-4000-8000-000000000015', '83000000-0000-4000-8000-000000000010', 3, 'ВАГОН №3', '#333333', 'III', 5, true),
  ('83000000-0000-4000-8000-000000000016', '83000000-0000-4000-8000-000000000010', 6, 'ВАГОН №6', '#666666', 'VI', 6, false),
  ('83000000-0000-4000-8000-000000000021', '83000000-0000-4000-8000-000000000020', 1, 'ВАГОН №1', '#111111', 'I', 1, true),
  ('83000000-0000-4000-8000-000000000022', '83000000-0000-4000-8000-000000000020', 2, 'ВАГОН №2', '#222222', 'II', 2, true),
  ('83000000-0000-4000-8000-000000000031', '83000000-0000-4000-8000-000000000030', 1, 'ВАГОН №1', '#111111', 'I', 1, true),
  ('83000000-0000-4000-8000-000000000032', '83000000-0000-4000-8000-000000000030', 2, 'ВАГОН №2', '#222222', 'II', 2, true),
  ('83000000-0000-4000-8000-000000000041', '83000000-0000-4000-8000-000000000040', 1, 'ВАГОН №1', '#111111', 'I', 1, true),
  ('83000000-0000-4000-8000-000000000042', '83000000-0000-4000-8000-000000000040', 2, 'ВАГОН №2', '#222222', 'II', 2, true);

insert into public.guests(
  id, event_id, first_name, last_name, affiliation_type, affiliation_detail,
  carriage_id, ticket_sequence, ticket_number, registered_at
)
values
  ('83000000-0000-4000-8000-000000000101', '83000000-0000-4000-8000-000000000010', 'AlicePrivate', 'SmithPrivate', 'liza', 'TOP_SECRET_AFFILIATION', '83000000-0000-4000-8000-000000000011', 3, 'PRIVATE-TOKEN-003', '2026-08-23 10:00:00+00'),
  ('83000000-0000-4000-8000-000000000102', '83000000-0000-4000-8000-000000000010', 'Иван', 'Ёлкин', 'viktor', null, '83000000-0000-4000-8000-000000000011', 2, 'PRIVATE-TOKEN-002', '2026-08-23 09:00:00+00'),
  ('83000000-0000-4000-8000-000000000103', '83000000-0000-4000-8000-000000000010', '9-Marie', '2-ONeil', 'common', null, '83000000-0000-4000-8000-000000000011', 1, 'PRIVATE-TOKEN-001', '2026-08-23 09:00:00+00'),
  ('83000000-0000-4000-8000-000000000104', '83000000-0000-4000-8000-000000000010', 'Active', 'Passenger', 'family', null, '83000000-0000-4000-8000-000000000015', 4, 'PRIVATE-TOKEN-004', '2026-08-23 11:00:00+00'),
  ('83000000-0000-4000-8000-000000000105', '83000000-0000-4000-8000-000000000010', 'Disabled', 'Passenger', 'other', null, '83000000-0000-4000-8000-000000000016', 5, 'PRIVATE-TOKEN-005', '2026-08-23 12:00:00+00'),
  ('83000000-0000-4000-8000-000000000106', '83000000-0000-4000-8000-000000000010', 'Null', 'Passenger', 'other', null, null, 6, 'PRIVATE-TOKEN-006', '2026-08-23 13:00:00+00'),
  ('83000000-0000-4000-8000-000000000107', '83000000-0000-4000-8000-000000000010', 'Bunker', 'Fixture', 'other', '__BUNKER_TEST__', '83000000-0000-4000-8000-000000000011', 7, 'PRIVATE-TOKEN-007', '2026-08-23 08:00:00+00'),
  ('83000000-0000-4000-8000-000000000108', '83000000-0000-4000-8000-000000000010', '123', '---', 'other', null, '83000000-0000-4000-8000-000000000012', 8, 'PRIVATE-TOKEN-008', '2026-08-23 14:00:00+00'),
  ('83000000-0000-4000-8000-000000000201', '83000000-0000-4000-8000-000000000020', 'Complete', 'One', 'liza', null, '83000000-0000-4000-8000-000000000021', 1, 'COMPLETE-001', '2026-08-23 09:00:00+00'),
  ('83000000-0000-4000-8000-000000000202', '83000000-0000-4000-8000-000000000020', 'Complete', 'Two', 'viktor', null, '83000000-0000-4000-8000-000000000022', 2, 'COMPLETE-002', '2026-08-23 10:00:00+00'),
  ('83000000-0000-4000-8000-000000000301', '83000000-0000-4000-8000-000000000030', 'Zero', 'Expected', 'common', null, '83000000-0000-4000-8000-000000000031', 1, 'ZERO-001', '2026-08-23 09:00:00+00');

insert into public.guests(
  id, event_id, first_name, last_name, affiliation_type, carriage_id,
  ticket_sequence, ticket_number, registered_at
)
select
  (
    '84000000-0000-4000-8000-' ||
    lpad(guest_number::text, 12, '0')
  )::uuid,
  '83000000-0000-4000-8000-000000000040'::uuid,
  'Cap',
  'Guest' || guest_number::text,
  'common',
  case
    when guest_number % 2 = 0
      then '83000000-0000-4000-8000-000000000041'::uuid
    else '83000000-0000-4000-8000-000000000042'::uuid
  end,
  guest_number,
  'CAP-' || lpad(guest_number::text, 3, '0'),
  '2026-08-23 09:00:00+00'::timestamptz + guest_number * interval '1 second'
from generate_series(1, 40) guest_number;

create temp table registration_carriage_map_guest_snapshot as
select to_jsonb(guest) as guest
from public.guests guest
where guest.event_id in (
  '83000000-0000-4000-8000-000000000010'::uuid,
  '83000000-0000-4000-8000-000000000020'::uuid,
  '83000000-0000-4000-8000-000000000030'::uuid,
  '83000000-0000-4000-8000-000000000040'::uuid
)
order by guest.id;

select is(
  pg_temp.call_registration_carriage_map('registration-carriage-map-missing')
    ->> 'status',
  'not_found',
  'unknown event slug returns not_found'
);
select is(
  (
    pg_temp.call_registration_carriage_map('registration-carriage-map-missing')
      ->> 'expectedGuestCount'
  )::integer,
  0,
  'not_found response has zero expected guests'
);
select is(
  (
    pg_temp.call_registration_carriage_map('registration-carriage-map-missing')
      ->> 'registeredGuestCount'
  )::integer,
  0,
  'not_found response has zero registered guests'
);
select is(
  (
    pg_temp.call_registration_carriage_map('registration-carriage-map-missing')
      ->> 'unassignedCount'
  )::integer,
  0,
  'not_found response has zero unassigned guests'
);
select is(
  pg_temp.call_registration_carriage_map('registration-carriage-map-missing')
    -> 'carriages',
  '[]'::jsonb,
  'not_found response has an empty carriage list'
);
select ok(
  length(
    pg_temp.call_registration_carriage_map('registration-carriage-map-missing')
      ->> 'serverNow'
  ) > 0,
  'not_found response includes server time'
);

select is(
  pg_temp.call_registration_carriage_map('registration-carriage-map-main')
    ->> 'status',
  'registration',
  'incomplete registration remains in registration state'
);
set local role anon;
select is(
  public.get_registration_carriage_map('registration-carriage-map-main')
    ->> 'status',
  'registration',
  'anonymous API role can execute the private-table read model'
);
reset role;
select is(
  (
    pg_temp.call_registration_carriage_map('registration-carriage-map-main')
      ->> 'expectedGuestCount'
  )::integer,
  8,
  'registration response exposes the expected guest count'
);
select is(
  (
    pg_temp.call_registration_carriage_map('registration-carriage-map-main')
      ->> 'registeredGuestCount'
  )::integer,
  7,
  'Bunker test guests are excluded from the registered count'
);
select is(
  (
    pg_temp.call_registration_carriage_map('registration-carriage-map-main')
      ->> 'unassignedCount'
  )::integer,
  2,
  'null and disabled-carriage guests are both unassigned'
);
select ok(
  not (
    pg_temp.call_registration_carriage_map('registration-carriage-map-main')
      ::text like '%83000000-0000-4000-8000-000000000107%'
  ),
  'Bunker test guests are excluded from carriage payloads'
);

update public.carriages
set enabled = sort_order <= 2
where event_id = '83000000-0000-4000-8000-000000000010';
select is(
  jsonb_array_length(
    pg_temp.call_registration_carriage_map('registration-carriage-map-main')
      -> 'carriages'
  ),
  2,
  'map supports two active carriages'
);
update public.carriages
set enabled = sort_order <= 3
where event_id = '83000000-0000-4000-8000-000000000010';
select is(
  jsonb_array_length(
    pg_temp.call_registration_carriage_map('registration-carriage-map-main')
      -> 'carriages'
  ),
  3,
  'map supports three active carriages'
);
update public.carriages
set enabled = sort_order <= 4
where event_id = '83000000-0000-4000-8000-000000000010';
select is(
  jsonb_array_length(
    pg_temp.call_registration_carriage_map('registration-carriage-map-main')
      -> 'carriages'
  ),
  4,
  'map supports four active carriages'
);
update public.carriages
set enabled = sort_order <= 5
where event_id = '83000000-0000-4000-8000-000000000010';
select is(
  jsonb_array_length(
    pg_temp.call_registration_carriage_map('registration-carriage-map-main')
      -> 'carriages'
  ),
  5,
  'map supports five active carriages'
);

select is(
  (
    select jsonb_agg((carriage ->> 'number')::integer)
    from jsonb_array_elements(
      pg_temp.call_registration_carriage_map('registration-carriage-map-main')
        -> 'carriages'
    ) carriage
  ),
  '[4, 2, 5, 1, 3]'::jsonb,
  'active carriages use deterministic configured ordering'
);
select is(
  (
    select jsonb_agg(guest ->> 'id')
    from jsonb_array_elements(
      pg_temp.call_registration_carriage_map('registration-carriage-map-main')
        -> 'carriages' -> 0 -> 'guests'
    ) guest
  ),
  '[
    "83000000-0000-4000-8000-000000000103",
    "83000000-0000-4000-8000-000000000102",
    "83000000-0000-4000-8000-000000000101"
  ]'::jsonb,
  'guest order is registered_at, ticket_sequence, id'
);
select is(
  (
    select jsonb_agg((guest ->> 'seatIndex')::integer)
    from jsonb_array_elements(
      pg_temp.call_registration_carriage_map('registration-carriage-map-main')
        -> 'carriages' -> 0 -> 'guests'
    ) guest
  ),
  '[1, 2, 3]'::jsonb,
  'seatIndex is deterministic and one-based within each carriage'
);
select is(
  (
    select jsonb_agg(guest ->> 'initials')
    from jsonb_array_elements(
      pg_temp.call_registration_carriage_map('registration-carriage-map-main')
        -> 'carriages' -> 0 -> 'guests'
    ) guest
  ),
  '["MO", "ИЁ", "AS"]'::jsonb,
  'initials contain only the normalized first two letters'
);
select is(
  (
    select guest ->> 'initials'
    from jsonb_array_elements(
      pg_temp.call_registration_carriage_map('registration-carriage-map-main')
        -> 'carriages'
    ) carriage
    cross join lateral jsonb_array_elements(carriage -> 'guests') guest
    where guest ->> 'id' = '83000000-0000-4000-8000-000000000108'
  ),
  'Г',
  'names without letters receive a safe non-empty letter fallback'
);
select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      pg_temp.call_registration_carriage_map('registration-carriage-map-main')
        -> 'carriages'
    ) carriage
    cross join lateral jsonb_array_elements(carriage -> 'guests') guest
    where (
      select array_agg(key order by key)
      from jsonb_object_keys(guest) key
    ) <> array['id', 'initials', 'seatIndex']::text[]
  ),
  'every public guest object contains only id, initials and seatIndex'
);
select ok(
  pg_temp.call_registration_carriage_map('registration-carriage-map-main')
    ::text !~* 'AlicePrivate|SmithPrivate|TOP_SECRET_AFFILIATION|PRIVATE-TOKEN|firstName|lastName|phone|token|affiliation',
  'public payload contains no names, phone, token or affiliation data'
);
select is(
  pg_temp.call_registration_carriage_map('registration-carriage-map-complete')
    ->> 'status',
  'complete',
  'registration completes when registered guests reach expected guests'
);
select is(
  (
    pg_temp.call_registration_carriage_map('registration-carriage-map-complete')
      ->> 'registeredGuestCount'
  )::integer,
  2,
  'complete response preserves the registered count'
);
select is(
  pg_temp.call_registration_carriage_map('registration-carriage-map-cap')
    ->> 'status',
  'complete',
  'registration completes at the forty-guest public cap'
);
select is(
  (
    pg_temp.call_registration_carriage_map('registration-carriage-map-cap')
      ->> 'registeredGuestCount'
  )::integer,
  40,
  'forty-guest completion counts every real registration'
);
select is(
  pg_temp.call_registration_carriage_map('registration-carriage-map-zero')
    ->> 'status',
  'registration',
  'zero expected guests never completes automatically'
);
select is(
  (
    pg_temp.call_registration_carriage_map('registration-carriage-map-zero')
      ->> 'registeredGuestCount'
  )::integer,
  1,
  'zero-expected response still reports real registrations'
);

select ok(
  (
    select array_agg(key order by key)
    from jsonb_object_keys(
      pg_temp.call_registration_carriage_map('registration-carriage-map-main')
    ) key
  ) = array[
    'carriages',
    'expectedGuestCount',
    'registeredGuestCount',
    'serverNow',
    'status',
    'unassignedCount'
  ]::text[],
  'top-level response exposes only the documented carriage-map fields'
);
select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      pg_temp.call_registration_carriage_map('registration-carriage-map-main')
        -> 'carriages'
    ) carriage
    where (
      select array_agg(key order by key)
      from jsonb_object_keys(carriage) key
    ) <> array[
      'accentHex', 'guests', 'id', 'label', 'number', 'visualMark'
    ]::text[]
  ),
  'every carriage exposes only the documented public fields'
);
select is(
  (
    select jsonb_agg(to_jsonb(guest) order by guest.id)
    from public.guests guest
    where guest.event_id in (
      '83000000-0000-4000-8000-000000000010'::uuid,
      '83000000-0000-4000-8000-000000000020'::uuid,
      '83000000-0000-4000-8000-000000000030'::uuid,
      '83000000-0000-4000-8000-000000000040'::uuid
    )
  ),
  (
    select jsonb_agg(snapshot.guest order by snapshot.guest ->> 'id')
    from registration_carriage_map_guest_snapshot snapshot
  ),
  'registration carriage map never mutates registrations, assignments or tickets'
);

select * from finish();
rollback;
