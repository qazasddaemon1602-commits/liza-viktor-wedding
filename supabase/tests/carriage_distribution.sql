begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

select has_function(
  'public',
  'owner_apply_carriage_distribution',
  array['uuid', 'integer'],
  'owner carriage distribution RPC exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.owner_apply_carriage_distribution(uuid, integer)',
    'EXECUTE'
  ),
  'anonymous clients cannot redistribute guests'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.owner_apply_carriage_distribution(uuid, integer)',
    'EXECUTE'
  ),
  'authenticated owner sessions can invoke carriage distribution RPC'
);

select throws_ok(
  $$ select public.owner_apply_carriage_distribution(
    '00000000-0000-0000-0000-000000000000'::uuid,
    1
  ) $$,
  '22023',
  'carriage count must be between 2 and 5',
  'unsupported carriage counts are rejected before any mutation'
);

select * from finish();
rollback;
