begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

insert into auth.users(id, aud, role, email)
values (
  '00000000-0000-4000-8000-000000000951',
  'authenticated',
  'authenticated',
  'bunker-route-story@example.test'
);

insert into public.events(id, slug, name, owner_user_id)
values (
  '00000000-0000-4000-8000-000000000952',
  'bunker-route-story-contract',
  'Bunker route story contract',
  '00000000-0000-4000-8000-000000000951'
);

insert into public.bunker_game_runs(
  run_nonce, event_id, wagon_count, guest_count, plan,
  contract_version, plan_version
)
values (
  '00000000-0000-4000-8000-000000000953',
  '00000000-0000-4000-8000-000000000952',
  2,
  0,
  '{}'::jsonb,
  2,
  1
);

insert into public.bunker_state(
  event_id, status, started_at, run_nonce, global_game_state
)
values (
  '00000000-0000-4000-8000-000000000952',
  'active',
  clock_timestamp(),
  '00000000-0000-4000-8000-000000000953',
  'MISSION_01'
);

alter table public.bunker_mission_instances
  disable trigger zz_bunker_route_story_before_insert;
insert into public.bunker_mission_instances(
  event_id, run_nonce, mission_code, scope_kind, scope_key,
  status, definition, started_at
)
values (
  '00000000-0000-4000-8000-000000000952',
  '00000000-0000-4000-8000-000000000953',
  'MISSION_01',
  'global',
  'story-existing',
  'active',
  jsonb_build_object(
    'contractVersion', 2,
    'quota', jsonb_build_object('exclude', 1),
    'presentation', jsonb_build_object('deadlineSeconds', 240),
    'mechanicalSentinel', jsonb_build_object('answer', 'unchanged')
  ),
  clock_timestamp()
);
alter table public.bunker_mission_instances
  enable trigger zz_bunker_route_story_before_insert;

alter table public.bunker_archive_entries
  disable trigger zz_bunker_route_story_archive_before_write;
insert into public.bunker_archive_entries(
  event_id, run_nonce, artifact_key, content_type, content
)
values (
  '00000000-0000-4000-8000-000000000952',
  '00000000-0000-4000-8000-000000000953',
  'BK-17',
  'document',
  jsonb_build_object(
    'mechanicalSentinel', jsonb_build_object('answer', 'unchanged')
  )
);
alter table public.bunker_archive_entries
  enable trigger zz_bunker_route_story_archive_before_write;

select ok(
  exists (
    select 1
    from pg_proc procedure
    where procedure.oid = 'public._apply_bunker_route_story()'::regprocedure
      and procedure.prosecdef
      and coalesce('search_path=""' = any(procedure.proconfig), false)
  ),
  'the story backfill is security definer with a fixed empty search path'
);

select ok(
  not exists (
    select 1
    from pg_proc procedure,
      lateral aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) acl
    where procedure.oid = 'public._apply_bunker_route_story()'::regprocedure
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  )
    and not has_function_privilege('anon', 'public._apply_bunker_route_story()', 'execute')
    and not has_function_privilege('authenticated', 'public._apply_bunker_route_story()', 'execute'),
  'the internal story backfill is not exposed through Data API roles'
);

select public._apply_bunker_route_story();

select is(
  (
    select definition->>'goal'
    from public.bunker_mission_instances
    where run_nonce = '00000000-0000-4000-8000-000000000953'
      and mission_code = 'MISSION_01'
      and scope_key = 'story-existing'
  ),
  'Проверить состав, чтобы довести поезд Виктора до BK-17.',
  'the existing current M01 definition receives the public route goal'
);

select ok(
  (
    select definition ?& array['title', 'subtitle', 'intro', 'story', 'goal']
      and position('Лиза' in definition::text) = 0
    from public.bunker_mission_instances
    where run_nonce = '00000000-0000-4000-8000-000000000953'
      and mission_code = 'MISSION_01'
      and scope_key = 'story-existing'
  ),
  'the existing current definition receives all anonymous story fields'
);

select is(
  (
    select definition -> 'mechanicalSentinel'
    from public.bunker_mission_instances
    where run_nonce = '00000000-0000-4000-8000-000000000953'
      and mission_code = 'MISSION_01'
      and scope_key = 'story-existing'
  ),
  '{"answer":"unchanged"}'::jsonb,
  'the backfill preserves an existing mission mechanical sentinel'
);

select is(
  (
    select definition -> 'quota'
    from public.bunker_mission_instances
    where run_nonce = '00000000-0000-4000-8000-000000000953'
      and mission_code = 'MISSION_01'
      and scope_key = 'story-existing'
  ),
  '{"exclude":1}'::jsonb,
  'the backfill preserves representative quota mechanics'
);

select ok(
  (
    select content->>'title' = 'Маршрут BK-17'
      and content->>'summary' like '%поезда Виктора%'
    from public.bunker_archive_entries
    where run_nonce = '00000000-0000-4000-8000-000000000953'
      and artifact_key = 'BK-17'
  ),
  'the existing archive entry receives the current route copy'
);

select is(
  (
    select content -> 'mechanicalSentinel'
    from public.bunker_archive_entries
    where run_nonce = '00000000-0000-4000-8000-000000000953'
      and artifact_key = 'BK-17'
  ),
  '{"answer":"unchanged"}'::jsonb,
  'the archive backfill preserves existing non-story content'
);

insert into public.bunker_mission_instances(
  event_id, run_nonce, mission_code, scope_kind, scope_key,
  status, definition, started_at
)
values (
  '00000000-0000-4000-8000-000000000952',
  '00000000-0000-4000-8000-000000000953',
  'MISSION_04',
  'global',
  'story-future',
  'active',
  jsonb_build_object(
    'contractVersion', 2,
    'wagonIds', jsonb_build_array('wagon-1', 'wagon-2'),
    'mechanicalSentinel', jsonb_build_object('answer', 'unchanged')
  ),
  clock_timestamp()
);

select ok(
  (
    select definition ?& array['title', 'subtitle', 'intro', 'story', 'goal']
      and definition->>'goal' = 'Восстановить связь, чтобы довести поезд Виктора до BK-17.'
    from public.bunker_mission_instances
    where run_nonce = '00000000-0000-4000-8000-000000000953'
      and mission_code = 'MISSION_04'
      and scope_key = 'story-future'
  ),
  'the insert trigger applies the same story fields to a future V2 instance'
);

select ok(
  (
    select definition->'wagonIds' = '["wagon-1","wagon-2"]'::jsonb
      and definition->'mechanicalSentinel' = '{"answer":"unchanged"}'::jsonb
    from public.bunker_mission_instances
    where run_nonce = '00000000-0000-4000-8000-000000000953'
      and mission_code = 'MISSION_04'
      and scope_key = 'story-future'
  ),
  'the insert trigger preserves representative future mission mechanics'
);

create temporary table route_story_snapshot as
select 'instance'::text as kind, id::text as id, definition as payload
from public.bunker_mission_instances
where run_nonce = '00000000-0000-4000-8000-000000000953'
union all
select 'archive'::text, id::text, content
from public.bunker_archive_entries
where run_nonce = '00000000-0000-4000-8000-000000000953';

select public._apply_bunker_route_story();
select public._apply_bunker_route_story();

select is(
  (
    select count(*)::integer
    from route_story_snapshot snapshot
    where not exists (
      select 1
      from (
        select 'instance'::text as kind, instance.id::text as id,
          instance.definition as payload
        from public.bunker_mission_instances instance
        where instance.run_nonce = '00000000-0000-4000-8000-000000000953'
        union all
        select 'archive', archive.id::text, archive.content
        from public.bunker_archive_entries archive
        where archive.run_nonce = '00000000-0000-4000-8000-000000000953'
      ) current_row
      where current_row.kind = snapshot.kind
        and current_row.id = snapshot.id
        and current_row.payload = snapshot.payload
    )
  ),
  0,
  'rerunning the story backfill leaves enriched rows byte-for-byte stable'
);

select is(
  (
    select count(*)::integer
    from public.bunker_mission_instances
    where run_nonce = '00000000-0000-4000-8000-000000000953'
  ),
  2,
  'rerunning the backfill creates no duplicate mission instances'
);

select is(
  (
    select count(*)::integer
    from public.bunker_archive_entries
    where run_nonce = '00000000-0000-4000-8000-000000000953'
  ),
  1,
  'rerunning the backfill creates no duplicate archive entries'
);

select * from finish();
rollback;
