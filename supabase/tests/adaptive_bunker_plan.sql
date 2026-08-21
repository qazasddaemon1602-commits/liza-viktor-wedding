begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select has_table('public', 'bunker_game_runs', 'adaptive runs are persisted');
select has_column('public', 'bunker_game_runs', 'plan', 'run stores its authoritative plan');
select has_column('public', 'bunker_guest_profiles', 'ability_tags', 'profiles carry gameplay abilities');
select has_column('public', 'bunker_mission_templates', 'variant_index', 'missions use reusable variants');
select hasnt_column(
  'public',
  'bunker_mission_templates',
  'carriage_number',
  'mission templates are no longer bound to a fixed wagon number'
);
select has_function(
  'public',
  '_create_bunker_game_plan',
  array['uuid', 'uuid'],
  'adaptive game planner exists in the database'
);
select ok(
  not has_function_privilege(
    'anon',
    'public._create_bunker_game_plan(uuid, uuid)',
    'EXECUTE'
  ),
  'anonymous clients cannot create or replace game plans'
);
select ok(
  has_function_privilege(
    'anon',
    'public.get_guest_bunker_state(text, text)',
    'EXECUTE'
  ),
  'guest state remains available through the existing public RPC contract'
);

select * from finish();
rollback;
