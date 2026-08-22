begin;

create extension if not exists pgtap with schema extensions;

select plan(23);

select has_table('public', 'bunker_character_profiles', 'character configuration exists');
select has_table('public', 'bunker_wagon_state', 'wagon runtime state exists');
select has_table('public', 'bunker_inventory_lots', 'inventory lots exist');
select has_table('public', 'bunker_archive_entries', 'wagon archive exists');
select has_table('public', 'bunker_game_events', 'append-only-ish game journal exists');

select hasnt_column(
  'public', 'bunker_character_profiles', 'name',
  'character configuration never stores fictional names'
);
select has_column('public', 'bunker_guest_profiles', 'character_profile_key', 'guest profile keeps its assigned character key');
select has_column('public', 'bunker_guest_profiles', 'character_status', 'guest profile keeps its character status');
select has_column('public', 'bunker_guest_profiles', 'ability_uses_remaining', 'guest profile tracks remaining ability uses');
select has_column('public', 'bunker_state', 'global_game_state', 'Bunker state stores the authoritative global stage');
select has_column('public', 'bunker_state', 'final_started_at', 'Bunker state stores the final countdown anchor');
select col_has_check(
  'public', 'bunker_inventory_lots', 'quantity',
  'inventory quantity is protected by a database check'
);
select has_function(
  'public', '_assign_late_bunker_guest', array[]::text[],
  'late registration assignment hook exists'
);
select has_trigger(
  'public', 'guests', 'assign_late_bunker_guest',
  'new registrations enter the active Bunker run automatically'
);
select has_function(
  'public', 'get_guest_bunker_runtime', array['text', 'text'],
  'guest runtime can be restored through a server-side snapshot'
);

select is(
  (select count(*)::integer from public.bunker_character_profiles),
  36,
  'the exact approved pool contains thirty-six profiles'
);
select is(
  (select count(distinct profession)::integer from public.bunker_character_profiles),
  36,
  'every approved profile has its own profession label'
);

select ok(
  (select bool_and(cardinality(tags) > 0) from public.bunker_character_profiles),
  'every character has at least one tag'
);
select ok(
  (select bool_and(special_ability ~ '^[a-z][a-z0-9_]+$') from public.bunker_character_profiles),
  'every character has one normalized special ability'
);

select ok(
  not has_table_privilege('anon', 'public.bunker_character_profiles', 'SELECT'),
  'anonymous clients cannot read the secret character pool directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.bunker_inventory_lots', 'UPDATE'),
  'authenticated clients cannot mutate inventory directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.bunker_game_events', 'UPDATE'),
  'game journal cannot be rewritten directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.bunker_game_events', 'DELETE'),
  'game journal cannot be deleted directly'
);

select * from finish();
rollback;
