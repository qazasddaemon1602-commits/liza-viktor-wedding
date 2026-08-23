begin;

create extension if not exists pgtap with schema extensions;

select plan(32);

select has_table(
  'public', 'bunker_operator_messages',
  'operator transmissions have a server-owned persistence table'
);

select ok(
  (
    select array_agg(column_name || ':' || data_type order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bunker_operator_messages'
  ) = array[
    'id:uuid',
    'event_id:uuid',
    'run_nonce:text',
    'stage:text',
    'option_key:text',
    'body:text',
    'source:text',
    'published_at:timestamp with time zone',
    'created_at:timestamp with time zone'
  ],
  'operator message storage has the approved columns and types'
);

select ok(
  exists (
    select 1
    from pg_constraint constraint_definition
    where constraint_definition.conrelid =
      'public.bunker_operator_messages'::regclass
      and constraint_definition.contype = 'p'
      and pg_get_constraintdef(constraint_definition.oid) = 'PRIMARY KEY (id)'
  ),
  'operator messages use id as their primary key'
);

select ok(
  exists (
    select 1
    from pg_constraint constraint_definition
    where constraint_definition.conrelid =
      'public.bunker_operator_messages'::regclass
      and constraint_definition.contype = 'u'
      and pg_get_constraintdef(constraint_definition.oid) =
        'UNIQUE (event_id, run_nonce, stage)'
  ),
  'one operator message is allowed for each event, run and stage'
);

select ok(
  (
    select table_definition.relrowsecurity
    from pg_class table_definition
    where table_definition.oid = 'public.bunker_operator_messages'::regclass
  ),
  'operator message storage has row-level security enabled'
);

select ok(
  not has_table_privilege('anon', 'public.bunker_operator_messages', 'SELECT')
    and not has_table_privilege('anon', 'public.bunker_operator_messages', 'INSERT')
    and not has_table_privilege('anon', 'public.bunker_operator_messages', 'UPDATE')
    and not has_table_privilege('anon', 'public.bunker_operator_messages', 'DELETE'),
  'anonymous clients have no direct operator message privileges'
);

select ok(
  not has_table_privilege('authenticated', 'public.bunker_operator_messages', 'SELECT')
    and not has_table_privilege('authenticated', 'public.bunker_operator_messages', 'INSERT')
    and not has_table_privilege('authenticated', 'public.bunker_operator_messages', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.bunker_operator_messages', 'DELETE'),
  'authenticated clients have no direct operator message privileges'
);

select has_function(
  'public', 'get_liza_bunker_operator_state', array['text', 'text'],
  'the private Liza operator read model exists'
);
select has_function(
  'public', 'submit_liza_bunker_operator_phrase',
  array['text', 'text', 'text', 'text'],
  'the one-send Liza operator command exists'
);
select has_function(
  'public', 'get_bunker_operator_feed', array['text'],
  'the public operator transmission read model exists'
);

select ok(
  (
    select bool_and(
      procedure.prosecdef
      and coalesce('search_path=""' = any(procedure.proconfig), false)
    )
    from pg_proc procedure
    where procedure.oid = any(array[
      'public.get_liza_bunker_operator_state(text,text)'::regprocedure,
      'public.submit_liza_bunker_operator_phrase(text,text,text,text)'::regprocedure,
      'public.get_bunker_operator_feed(text)'::regprocedure
    ])
  ),
  'all operator RPCs are security definers with a fixed empty search path'
);

select ok(
  has_function_privilege(
    'anon', 'public.get_liza_bunker_operator_state(text,text)', 'EXECUTE'
  )
    and has_function_privilege(
      'authenticated',
      'public.get_liza_bunker_operator_state(text,text)', 'EXECUTE'
    )
    and has_function_privilege(
      'anon',
      'public.submit_liza_bunker_operator_phrase(text,text,text,text)',
      'EXECUTE'
    )
    and has_function_privilege(
      'authenticated',
      'public.submit_liza_bunker_operator_phrase(text,text,text,text)',
      'EXECUTE'
    )
    and has_function_privilege(
      'anon', 'public.get_bunker_operator_feed(text)', 'EXECUTE'
    )
    and has_function_privilege(
      'authenticated', 'public.get_bunker_operator_feed(text)', 'EXECUTE'
    )
    and not exists (
      select 1
      from pg_proc procedure
      cross join lateral aclexplode(
        coalesce(procedure.proacl, acldefault('f', procedure.proowner))
      ) privilege
      where procedure.oid = any(array[
        'public.get_liza_bunker_operator_state(text,text)'::regprocedure,
        'public.submit_liza_bunker_operator_phrase(text,text,text,text)'::regprocedure,
        'public.get_bunker_operator_feed(text)'::regprocedure
      ])
        and privilege.grantee = 0
        and privilege.privilege_type = 'EXECUTE'
    ),
  'operator RPCs have explicit API grants and no PUBLIC execute grant'
);

select ok(
  pg_get_functiondef(
    'public._delete_bunker_game_run(uuid,uuid)'::regprocedure
  ) ~ 'delete from public\.bunker_operator_messages',
  'the dependency-safe run teardown deletes operator transmissions'
);

insert into auth.users(id)
values ('00000000-0000-4000-8000-000000000801');

insert into public.events(id, slug, name, owner_user_id)
values (
  '00000000-0000-4000-8000-000000000802',
  'bunker-operator-contract',
  'Bunker operator contract',
  '00000000-0000-4000-8000-000000000801'
);

insert into public.event_state(event_id)
values ('00000000-0000-4000-8000-000000000802');

insert into public.bunker_game_runs(
  run_nonce, event_id, wagon_count, guest_count, plan,
  contract_version, plan_version
)
values (
  '00000000-0000-4000-8000-000000000803',
  '00000000-0000-4000-8000-000000000802',
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
  '00000000-0000-4000-8000-000000000802',
  'idle',
  null,
  '00000000-0000-4000-8000-000000000803',
  'LOBBY'
);

insert into public.final_five_role_access(
  event_id, role, token_hash, revoked_at
)
values
  (
    '00000000-0000-4000-8000-000000000802',
    'liza',
    public._final_five_token_hash('liza-operator-token-1234'),
    null
  ),
  (
    '00000000-0000-4000-8000-000000000802',
    'viktor',
    public._final_five_token_hash('viktor-role-token-12345'),
    null
  );

select is(
  public.get_liza_bunker_operator_state(
    'bunker-operator-contract', 'invalid-operator-token'
  )->>'status',
  'invalid_access',
  'an invalid token cannot read the private Liza operator state'
);

select is(
  public.get_liza_bunker_operator_state(
    'bunker-operator-contract', 'viktor-role-token-12345'
  )->>'status',
  'invalid_access',
  'a valid token for the wrong final-five role cannot read Liza state'
);

select throws_ok(
  $$ select public.submit_liza_bunker_operator_phrase(
    'bunker-operator-contract', 'invalid-operator-token',
    'MISSION_02', 'm02_signal'
  ) $$,
  '42501',
  'invalid Liza operator access',
  'an invalid token cannot submit an operator phrase'
);

select throws_ok(
  $$ select public.submit_liza_bunker_operator_phrase(
    'bunker-operator-contract', 'viktor-role-token-12345',
    'MISSION_02', 'm02_signal'
  ) $$,
  '42501',
  'invalid Liza operator access',
  'the Viktor token cannot submit a Liza operator phrase'
);

select throws_ok(
  $$ select public.submit_liza_bunker_operator_phrase(
    'bunker-operator-contract', 'liza-operator-token-1234',
    'MISSION_02', 'm02_signal'
  ) $$,
  '55000',
  'active Bunker V2 run required',
  'operator submission requires an active V2 run'
);

update public.bunker_state
set status = 'active',
    started_at = clock_timestamp() - interval '5 minutes',
    global_game_state = 'MISSION_02'
where event_id = '00000000-0000-4000-8000-000000000802';

insert into public.bunker_mission_instances(
  event_id, run_nonce, mission_code, scope_kind, scope_key,
  status, definition, started_at
)
values (
  '00000000-0000-4000-8000-000000000802',
  '00000000-0000-4000-8000-000000000803',
  'MISSION_02',
  'global',
  'operator-test',
  'active',
  '{}'::jsonb,
  clock_timestamp() - interval '10 seconds'
);

select throws_ok(
  $$ select public.submit_liza_bunker_operator_phrase(
    'bunker-operator-contract', 'liza-operator-token-1234',
    'MISSION_04', 'm04_connection'
  ) $$,
  '55000',
  'operator stage is not active',
  'the server rejects a phrase for a different stage'
);

select throws_ok(
  $$ select public.submit_liza_bunker_operator_phrase(
    'bunker-operator-contract', 'liza-operator-token-1234',
    'MISSION_02', 'untrusted-client-copy'
  ) $$,
  '22023',
  'invalid operator phrase option',
  'the server rejects an option outside its own phrase catalog'
);

create temporary table operator_submit_result(result jsonb) on commit drop;
insert into operator_submit_result(result)
select public.submit_liza_bunker_operator_phrase(
  'bunker-operator-contract', 'liza-operator-token-1234',
  'MISSION_02', 'm02_signal'
);

select ok(
  (
    select result->>'status' = 'accepted'
      and result#>>'{message,stage}' = 'MISSION_02'
      and result#>>'{message,optionKey}' = 'm02_signal'
      and result#>>'{message,body}' =
        'Сигнал слабый, но я вас слышу. Продолжайте.'
      and result#>>'{message,source}' = 'selected'
      and result ? 'serverNow'
    from operator_submit_result
  ),
  'a valid Liza submission stores and returns only server catalog copy'
);

select ok(
  (
    with retry as (
      select public.submit_liza_bunker_operator_phrase(
        'bunker-operator-contract', 'liza-operator-token-1234',
        'MISSION_02', 'm02_fragments'
      ) as body
    )
    select body->>'status' = 'locked'
      and body#>>'{message,optionKey}' = 'm02_signal'
    from retry
  ),
  'a second submission returns the first saved choice instead of overwriting it'
);

select is(
  (
    select count(*)::integer
    from public.bunker_operator_messages message
    where message.event_id = '00000000-0000-4000-8000-000000000802'
      and message.run_nonce = '00000000-0000-4000-8000-000000000803'
      and message.stage = 'MISSION_02'
  ),
  1,
  'one-send idempotency creates exactly one row for the run stage'
);

select throws_ok(
  $test$
  do $duplicate$
  begin
    insert into public.bunker_operator_messages(
      event_id, run_nonce, stage, option_key, body, source
    ) values (
      '00000000-0000-4000-8000-000000000802',
      '00000000-0000-4000-8000-000000000803',
      'MISSION_02',
      'm02_fragments',
      'Не доверяйте одному фрагменту. Сверяйте всё, что нашли.',
      'selected'
    );
  exception when unique_violation then
    raise exception 'duplicate operator run stage' using errcode = '23505';
  end;
  $duplicate$
  $test$,
  '23505',
  'duplicate operator run stage',
  'the database constraint rejects a second row for the same run stage'
);

select ok(
  (
    with response as (
      select public.get_liza_bunker_operator_state(
        'bunker-operator-contract', 'liza-operator-token-1234'
      ) as body
    )
    select body->>'status' = 'active'
      and body->>'stage' = 'MISSION_02'
      and body ? 'enteredAt'
      and body ? 'sendUntil'
      and body ? 'serverNow'
      and jsonb_array_length(body->'options') = 2
      and body#>>'{selectedMessage,optionKey}' = 'm02_signal'
    from response
  ),
  'the active private state returns server timing, two options and the saved choice'
);

select ok(
  position(
    'liza' in lower(
      public.get_bunker_operator_feed('bunker-operator-contract')::text
    )
  ) = 0
    and position(
      'liza' in lower(
        public.get_liza_bunker_operator_state(
          'bunker-operator-contract', 'liza-operator-token-1234'
        )::text
      )
    ) = 0,
  'operator read models do not reveal Liza identity before BUNKER_OPEN'
);

update public.bunker_state
set global_game_state = 'MISSION_04'
where event_id = '00000000-0000-4000-8000-000000000802';

update public.bunker_operator_messages
set published_at = clock_timestamp() - interval '2 minutes',
    created_at = clock_timestamp() - interval '2 minutes'
where event_id = '00000000-0000-4000-8000-000000000802'
  and stage = 'MISSION_02';

insert into public.bunker_mission_instances(
  event_id, run_nonce, mission_code, scope_kind, scope_key,
  status, definition, started_at
)
values (
  '00000000-0000-4000-8000-000000000802',
  '00000000-0000-4000-8000-000000000803',
  'MISSION_04',
  'group',
  'operator-test',
  'active',
  '{}'::jsonb,
  clock_timestamp() - interval '46 seconds'
);

create temporary table operator_fallback_feed(result jsonb) on commit drop;
insert into operator_fallback_feed(result)
select public.get_bunker_operator_feed('bunker-operator-contract');

select ok(
  (
    select result->>'status' = 'active'
      and result ? 'serverNow'
      and result#>>'{message,stage}' = 'MISSION_04'
      and result#>>'{message,body}' =
        'Один вагон не дойдёт. Держите связь.'
      and result#>>'{message,source}' = 'fallback'
    from operator_fallback_feed
  ),
  'the feed deterministically publishes the approved fallback after 45 seconds'
);

select ok(
  (
    select message.published_at = instance.started_at + interval '45 seconds'
    from public.bunker_operator_messages message
    join public.bunker_mission_instances instance
      on instance.event_id = message.event_id
      and instance.run_nonce::text = message.run_nonce
      and instance.mission_code = message.stage
    where message.event_id = '00000000-0000-4000-8000-000000000802'
      and message.stage = 'MISSION_04'
  ),
  'fallback publication is anchored to the server stage timestamp'
);

select is(
  public.get_bunker_operator_feed('bunker-operator-contract')#>>'{message,id}',
  (select result#>>'{message,id}' from operator_fallback_feed),
  'repeated feed reads return the same persisted fallback message'
);

select is(
  (
    select count(*)::integer
    from public.bunker_operator_messages message
    where message.event_id = '00000000-0000-4000-8000-000000000802'
      and message.run_nonce = '00000000-0000-4000-8000-000000000803'
      and message.stage = 'MISSION_04'
      and message.source = 'fallback'
  ),
  1,
  'polling never creates duplicate fallback rows'
);

select ok(
  (
    with response as (
      select public.get_liza_bunker_operator_state(
        'bunker-operator-contract', 'liza-operator-token-1234'
      ) as body
    )
    select body->>'status' = 'active'
      and (body->>'windowOpen')::boolean is false
      and body#>>'{selectedMessage,source}' = 'fallback'
      and body ? 'enteredAt'
      and body ? 'sendUntil'
      and body ? 'serverNow'
    from response
  ),
  'the private state converges on the same expired-window fallback'
);

update public.bunker_state
set run_nonce = null,
    status = 'idle',
    started_at = null,
    global_game_state = 'LOBBY'
where event_id = '00000000-0000-4000-8000-000000000802';

select is(
  (
    select count(*)::integer
    from public.bunker_operator_messages message
    where message.event_id = '00000000-0000-4000-8000-000000000802'
  ),
  0,
  'authoritative run teardown removes all operator messages for that run'
);

select * from finish();
rollback;
