begin;

create extension if not exists pgtap with schema extensions;

select plan(57);

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

select ok(
  (
    select bool_and(
      strpos(definition, 'from public.final_five_role_access') > 0
        and strpos(definition, 'from public.final_five_role_access')
          < strpos(definition, 'from public.bunker_state')
        and strpos(
          definition,
          $$char_length(coalesce(p_token, '')) > 128$$
        ) > 0
        and strpos(
          definition,
          $$char_length(coalesce(p_token, '')) > 128$$
        ) < strpos(definition, 'from public.bunker_state')
        and substring(
          definition
          from 1
          for strpos(definition, 'from public.bunker_state') - 1
        ) !~ 'for share'
    )
    from (
      select lower(pg_get_functiondef(procedure_oid)) as definition
      from unnest(array[
        'public.get_liza_bunker_operator_state(text,text)'::regprocedure,
        'public.submit_liza_bunker_operator_phrase(text,text,text,text)'::regprocedure
      ]) procedure_oid
    ) definitions
  ),
  'private RPCs bound token work and reject invalid credentials before locking state'
);

select ok(
  (
    select bool_and(
      strpos(state_tail, 'for update') > 0
        and strpos(state_tail, 'from public.final_five_role_access') > 0
        and strpos(state_tail, 'from public.final_five_role_access')
          > strpos(state_tail, 'for update')
        and substring(
          state_tail
          from strpos(state_tail, 'from public.final_five_role_access')
        ) ~ 'for share'
        and substring(
          state_tail
          from strpos(state_tail, 'from public.final_five_role_access')
        ) ~ $$role = 'liza'$$
        and substring(
          state_tail
          from strpos(state_tail, 'from public.final_five_role_access')
        ) ~ 'revoked_at is null'
        and substring(
          state_tail
          from strpos(state_tail, 'from public.final_five_role_access')
        ) ~ '_final_five_token_hash\(p_token\)'
    )
    from (
      select substring(
        definition
        from strpos(definition, 'from public.bunker_state')
      ) as state_tail
      from (
        select lower(pg_get_functiondef(procedure_oid)) as definition
        from unnest(array[
          'public.get_liza_bunker_operator_state(text,text)'::regprocedure,
          'public.submit_liza_bunker_operator_phrase(text,text,text,text)'::regprocedure
        ]) procedure_oid
      ) function_definitions
    ) definitions
  ),
  'private RPCs lock state before locking and revalidating the matching Liza access row'
);

select ok(
  (
    with function_definition as (
      select lower(pg_get_functiondef(
        'public.get_bunker_operator_feed(text)'::regprocedure
      )) as definition
    ), lock_position as (
      select definition, strpos(definition, 'for update') as lock_at
      from function_definition
    )
    select lock_at > 0
      and length(definition) - length(replace(definition, 'for update', '')) =
        length('for update')
      and substring(definition from 1 for lock_at - 1) ~
        'from public\.bunker_state'
      and substring(definition from 1 for lock_at - 1) ~
        'from public\.bunker_operator_messages'
      and substring(definition from 1 for lock_at - 1) ~
        'if v_fallback_required then'
      and substring(definition from lock_at) ~
        'from public\.bunker_game_runs'
      and substring(definition from lock_at) ~
        'from public\.bunker_mission_instances'
      and substring(definition from lock_at) ~
        'from public\.bunker_operator_messages'
      and substring(definition from lock_at) ~
        'on conflict \(event_id, run_nonce, stage\) do nothing'
    from lock_position
  ),
  'public feed locks only the fallback branch and revalidates authoritative state'
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

create temporary table bunker_operator_invalid_baseline as
select
  to_jsonb(state) as state_payload,
  (
    select count(*)
    from public.bunker_operator_messages message
    where message.event_id = state.event_id
  ) as message_count
from public.bunker_state state
where state.event_id = '00000000-0000-4000-8000-000000000802';

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

select is(
  public.get_liza_bunker_operator_state(
    'bunker-operator-contract', repeat('x', 129)
  )->>'status',
  'invalid_access',
  'an over-limit token cannot read private operator state'
);

select throws_ok(
  $$ select public.submit_liza_bunker_operator_phrase(
    'bunker-operator-contract', repeat('x', 129),
    'MISSION_02', 'm02_signal'
  ) $$,
  '42501',
  'invalid Liza operator access',
  'an over-limit token cannot submit an operator phrase'
);

select ok(
  (
    select to_jsonb(state) = baseline.state_payload
      and (
        select count(*)
        from public.bunker_operator_messages message
        where message.event_id = state.event_id
      ) = baseline.message_count
    from public.bunker_state state
    cross join bunker_operator_invalid_baseline baseline
    where state.event_id = '00000000-0000-4000-8000-000000000802'
  ),
  'invalid, wrong-role, and over-limit credentials do not mutate Bunker state or messages'
);

update public.final_five_role_access
set revoked_at = clock_timestamp()
where event_id = '00000000-0000-4000-8000-000000000802'
  and role = 'liza';

select is(
  public.get_liza_bunker_operator_state(
    'bunker-operator-contract', 'liza-operator-token-1234'
  )->>'status',
  'invalid_access',
  'a revoked Liza token cannot read private operator state'
);

select throws_ok(
  $$ select public.submit_liza_bunker_operator_phrase(
    'bunker-operator-contract', 'liza-operator-token-1234',
    'MISSION_02', 'm02_signal'
  ) $$,
  '42501',
  'invalid Liza operator access',
  'a revoked Liza token cannot submit an operator phrase'
);

update public.final_five_role_access
set revoked_at = null,
    token_hash = public._final_five_token_hash('rotated-liza-token-5678')
where event_id = '00000000-0000-4000-8000-000000000802'
  and role = 'liza';

select ok(
  public.get_liza_bunker_operator_state(
    'bunker-operator-contract', 'liza-operator-token-1234'
  )->>'status' = 'invalid_access'
    and public.get_liza_bunker_operator_state(
      'bunker-operator-contract', 'rotated-liza-token-5678'
    )->>'status' = 'idle',
  'token rotation invalidates the old token and admits only the replacement'
);

select throws_ok(
  $$ select public.submit_liza_bunker_operator_phrase(
    'bunker-operator-contract', 'liza-operator-token-1234',
    'MISSION_02', 'm02_signal'
  ) $$,
  '42501',
  'invalid Liza operator access',
  'a rotated-away Liza token cannot submit an operator phrase'
);

update public.final_five_role_access
set token_hash = public._final_five_token_hash('liza-operator-token-1234')
where event_id = '00000000-0000-4000-8000-000000000802'
  and role = 'liza';

select throws_ok(
  $$ select public.submit_liza_bunker_operator_phrase(
    'bunker-operator-contract', 'liza-operator-token-1234',
    'MISSION_02', 'm02_signal'
  ) $$,
  '55000',
  'active Bunker V2 run required',
  'operator submission requires an active V2 run'
);

select is(
  public.get_liza_bunker_operator_state(
    'bunker-operator-contract', 'liza-operator-token-1234'
  )->>'status',
  'idle',
  'private operator state remains idle while the Bunker run is inactive'
);

update public.bunker_state
set status = 'active',
    started_at = clock_timestamp(),
    run_nonce = '00000000-0000-4000-8000-000000000804',
    global_game_state = 'MISSION_02'
where event_id = '00000000-0000-4000-8000-000000000802';

select ok(
  (
    with response as (
      select public.get_liza_bunker_operator_state(
        'bunker-operator-contract', 'liza-operator-token-1234'
      ) as body
    )
    select body->>'status' = 'idle'
      and (body->>'bunkerActive')::boolean is false
    from response
  ),
  'private operator state rejects a state nonce with no current run row'
);

select throws_ok(
  $$ select public.submit_liza_bunker_operator_phrase(
    'bunker-operator-contract', 'liza-operator-token-1234',
    'MISSION_02', 'm02_signal'
  ) $$,
  '55000',
  'active Bunker V2 run required',
  'submission rejects a state nonce with no current run row'
);

insert into public.bunker_game_runs(
  run_nonce, event_id, wagon_count, guest_count, plan,
  contract_version, plan_version
)
values (
  '00000000-0000-4000-8000-000000000805',
  '00000000-0000-4000-8000-000000000802',
  2,
  0,
  '{}'::jsonb,
  1,
  null
);

update public.bunker_state
set run_nonce = '00000000-0000-4000-8000-000000000805'
where event_id = '00000000-0000-4000-8000-000000000802';

select ok(
  (
    with response as (
      select public.get_liza_bunker_operator_state(
        'bunker-operator-contract', 'liza-operator-token-1234'
      ) as body
    )
    select body->>'status' = 'idle'
      and (body->>'bunkerActive')::boolean is false
    from response
  ),
  'private operator state rejects a legacy V1 run'
);

select throws_ok(
  $$ select public.submit_liza_bunker_operator_phrase(
    'bunker-operator-contract', 'liza-operator-token-1234',
    'MISSION_02', 'm02_signal'
  ) $$,
  '55000',
  'active Bunker V2 run required',
  'submission rejects a legacy V1 run'
);

update public.bunker_state
set status = 'active',
    started_at = clock_timestamp() - interval '5 minutes',
    run_nonce = '00000000-0000-4000-8000-000000000803',
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

select ok(
  (
    with response as (
      select public.get_bunker_operator_feed(
        'bunker-operator-contract'
      ) as body
    )
    select body->>'status' = 'active'
      and body->>'globalGameState' = 'MISSION_02'
      and body->'message' = 'null'::jsonb
      and (
        select count(*)
        from public.bunker_operator_messages message
        where message.event_id = '00000000-0000-4000-8000-000000000802'
          and message.run_nonce = '00000000-0000-4000-8000-000000000803'
      ) = 0
    from response
  ),
  'a pre-deadline feed poll returns without creating a fallback message'
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

update public.bunker_mission_instances
set started_at = clock_timestamp() - interval '45 seconds'
where event_id = '00000000-0000-4000-8000-000000000802'
  and run_nonce = '00000000-0000-4000-8000-000000000803'
  and mission_code = 'MISSION_02';

select ok(
  (
    with retry_after_deadline as (
      select public.submit_liza_bunker_operator_phrase(
        'bunker-operator-contract', 'liza-operator-token-1234',
        'MISSION_02', 'm02_fragments'
      ) as body
    )
    select body->>'status' = 'locked'
      and body#>>'{message,optionKey}' = 'm02_signal'
      and body#>>'{message,source}' = 'selected'
    from retry_after_deadline
  ),
  'a retry from another tab after the exact deadline returns the stored choice as locked'
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
  'the post-deadline idempotent retry does not create a duplicate message'
);

update public.bunker_state
set global_game_state = 'MISSION_04'
where event_id = '00000000-0000-4000-8000-000000000802';

insert into public.bunker_mission_instances(
  event_id, run_nonce, mission_code, scope_kind, scope_key,
  status, definition, started_at
)
values (
  '00000000-0000-4000-8000-000000000802',
  '00000000-0000-4000-8000-000000000803',
  'MISSION_04', 'global', 'operator-expired-validation',
  'active', '{}'::jsonb, clock_timestamp() - interval '46 seconds'
)
on conflict (run_nonce, mission_code, scope_key) do update
set status = 'active', started_at = excluded.started_at;

select throws_ok(
  $$ select public.submit_liza_bunker_operator_phrase(
    'bunker-operator-contract', 'liza-operator-token-1234',
    'MISSION_04', 'not-in-the-server-catalog'
  ) $$,
  '22023',
  'invalid operator phrase option',
  'a new invalid option remains rejected after the deadline'
);

select throws_ok(
  $$ select public.submit_liza_bunker_operator_phrase(
    'bunker-operator-contract', 'liza-operator-token-1234',
    'MISSION_06', 'm06_between'
  ) $$,
  '55000',
  'operator stage is not active',
  'a new wrong-stage submission remains rejected after the deadline'
);

select throws_ok(
  $$ select public.submit_liza_bunker_operator_phrase(
    'bunker-operator-contract', 'liza-operator-token-1234',
    'MISSION_04', 'm04_connection'
  ) $$,
  '55000',
  'operator send window is closed',
  'a new valid current-stage submission is rejected after the exact deadline'
);

select is(
  (
    select count(*)::integer
    from public.bunker_operator_messages message
    where message.event_id = '00000000-0000-4000-8000-000000000802'
      and message.run_nonce = '00000000-0000-4000-8000-000000000803'
      and message.stage = 'MISSION_04'
  ),
  0,
  'a rejected post-deadline first submission stores no operator message'
);

delete from public.bunker_mission_instances instance
where instance.event_id = '00000000-0000-4000-8000-000000000802'
  and instance.run_nonce = '00000000-0000-4000-8000-000000000803'
  and instance.mission_code = 'MISSION_04'
  and instance.scope_key = 'operator-expired-validation';

update public.bunker_state
set global_game_state = 'MISSION_02'
where event_id = '00000000-0000-4000-8000-000000000802';

update public.bunker_mission_instances
set started_at = clock_timestamp() - interval '10 seconds'
where event_id = '00000000-0000-4000-8000-000000000802'
  and run_nonce = '00000000-0000-4000-8000-000000000803'
  and mission_code = 'MISSION_02';

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
  (
    with feed as (
      select public.get_bunker_operator_feed(
        'bunker-operator-contract'
      ) as body
    )
    select (
      select array_agg(key order by key)
      from jsonb_object_keys(body) key
    ) = array[
      'active', 'globalGameState', 'message',
      'revealed', 'serverNow', 'status'
    ]
      and (
        select array_agg(key order by key)
        from jsonb_object_keys(body->'message') key
      ) = array['body', 'id', 'publishedAt', 'source', 'stage']
      and not body ?| array[
        'role', 'portrait', 'identity', 'token', 'tokenHash', 'token_hash'
      ]
      and not (body->'message') ?| array[
        'role', 'portrait', 'identity', 'token', 'tokenHash', 'token_hash'
      ]
      and position('Лиза' in body::text) = 0
      and position('лиза' in lower(body::text)) = 0
      and position('liza' in lower(body::text)) = 0
      and position('liza-operator-token-1234' in body::text) = 0
      and position(
        public._final_five_token_hash('liza-operator-token-1234')
        in body::text
      ) = 0
    from feed
  ),
  'the public feed exposes only anonymous allow-listed fields before BUNKER_OPEN'
);

create temporary table operator_phrase_cases(
  stage text not null,
  stage_order integer not null,
  option_order integer not null,
  option_key text not null,
  body text not null,
  is_fallback boolean not null,
  primary key(stage, option_key)
) on commit drop;

insert into operator_phrase_cases(
  stage, stage_order, option_order, option_key, body, is_fallback
)
values
  ('MISSION_02', 1, 1, 'm02_signal',
    'Сигнал слабый, но я вас слышу. Продолжайте.', true),
  ('MISSION_02', 1, 2, 'm02_fragments',
    'Не доверяйте одному фрагменту. Сверяйте всё, что нашли.', false),
  ('MISSION_04', 2, 1, 'm04_connection',
    'Один вагон не дойдёт. Держите связь.', true),
  ('MISSION_04', 2, 2, 'm04_share',
    'Передавайте не только слова. Делитесь тем, что спасёт других.', false),
  ('MISSION_06', 3, 1, 'm06_between',
    'У каждого только часть маршрута. Ответ — между вами.', false),
  ('MISSION_06', 3, 2, 'm06_every_fragment',
    'Состав почти у цели. Ни один фрагмент не лишний.', true),
  ('FINAL_30', 4, 1, 'final_waiting',
    'Ворота ещё держатся. Я жду ваш сигнал.', true),
  ('FINAL_30', 4, 2, 'final_viktor',
    'Ещё немного. Доведите поезд Виктора до конца.', false);

create temporary table operator_catalog_results(
  stage text primary key,
  options jsonb not null
) on commit drop;

create temporary table operator_invalid_results(
  stage text primary key,
  rejected boolean not null
) on commit drop;

create temporary table operator_submission_results(
  stage text not null,
  stage_order integer not null,
  option_order integer not null,
  option_key text,
  body text,
  source text,
  status text,
  primary key(stage, option_order)
) on commit drop;

do $catalog_matrix$
declare
  v_case record;
  v_response jsonb;
begin
  for v_case in
    select phrase.*
    from operator_phrase_cases phrase
    order by phrase.stage_order, phrase.option_order
  loop
    update public.bunker_state
    set global_game_state = v_case.stage
    where event_id = '00000000-0000-4000-8000-000000000802';

    insert into public.bunker_mission_instances(
      event_id, run_nonce, mission_code, scope_kind, scope_key,
      status, definition, started_at
    ) values (
      '00000000-0000-4000-8000-000000000802',
      '00000000-0000-4000-8000-000000000803',
      v_case.stage,
      'global',
      'operator-catalog',
      'active',
      '{}'::jsonb,
      clock_timestamp() - interval '10 seconds'
    )
    on conflict (run_nonce, mission_code, scope_key) do update
    set status = 'active',
        started_at = excluded.started_at;

    if v_case.option_order = 1 then
      insert into operator_catalog_results(stage, options)
      select v_case.stage, state->'options'
      from (
        select public.get_liza_bunker_operator_state(
          'bunker-operator-contract', 'liza-operator-token-1234'
        ) as state
      ) response;

      begin
        perform public.submit_liza_bunker_operator_phrase(
          'bunker-operator-contract', 'liza-operator-token-1234',
          v_case.stage, 'invalid_' || lower(v_case.stage)
        );
        insert into operator_invalid_results(stage, rejected)
        values (v_case.stage, false);
      exception
        when sqlstate '22023' then
          insert into operator_invalid_results(stage, rejected)
          values (v_case.stage, true);
        when others then
          insert into operator_invalid_results(stage, rejected)
          values (v_case.stage, false);
      end;
    end if;

    delete from public.bunker_operator_messages message
    where message.event_id = '00000000-0000-4000-8000-000000000802'
      and message.run_nonce = '00000000-0000-4000-8000-000000000803'
      and message.stage = v_case.stage;

    begin
      v_response := public.submit_liza_bunker_operator_phrase(
        'bunker-operator-contract', 'liza-operator-token-1234',
        v_case.stage, v_case.option_key
      );
      insert into operator_submission_results(
        stage, stage_order, option_order, option_key, body, source, status
      ) values (
        v_case.stage,
        v_case.stage_order,
        v_case.option_order,
        v_response#>>'{message,optionKey}',
        v_response#>>'{message,body}',
        v_response#>>'{message,source}',
        v_response->>'status'
      );
    exception when others then
      insert into operator_submission_results(
        stage, stage_order, option_order, option_key, body, source, status
      ) values (
        v_case.stage,
        v_case.stage_order,
        v_case.option_order,
        null,
        sqlerrm,
        null,
        'error:' || sqlstate
      );
    end;
  end loop;
end;
$catalog_matrix$;

select results_eq(
  $$
    select result.stage, result.options
    from operator_catalog_results result
    join (
      select phrase.stage, min(phrase.stage_order) as stage_order
      from operator_phrase_cases phrase
      group by phrase.stage
    ) ordering using (stage)
    order by ordering.stage_order
  $$,
  $$
    select phrase.stage,
      jsonb_agg(
        jsonb_build_object('key', phrase.option_key, 'body', phrase.body)
        order by phrase.option_order
      ) as options
    from operator_phrase_cases phrase
    group by phrase.stage, phrase.stage_order
    order by phrase.stage_order
  $$,
  'private state exposes both exact approved keys and bodies for all four stages'
);

select ok(
  (
    select count(*) = 4 and bool_and(result.rejected)
    from operator_invalid_results result
  ),
  'server catalog validation rejects an unknown option key in every stage'
);

select results_eq(
  $$
    select result.stage, result.option_order, result.option_key,
      result.body, result.source, result.status
    from operator_submission_results result
    order by result.stage_order, result.option_order
  $$,
  $$
    select phrase.stage, phrase.option_order, phrase.option_key,
      phrase.body, 'selected'::text, 'accepted'::text
    from operator_phrase_cases phrase
    order by phrase.stage_order, phrase.option_order
  $$,
  'submission accepts and snapshots both exact catalog options for all four stages'
);

delete from public.bunker_operator_messages message
where message.event_id = '00000000-0000-4000-8000-000000000802'
  and message.run_nonce = '00000000-0000-4000-8000-000000000803';

create temporary table operator_fallback_results(
  stage text primary key,
  stage_order integer not null,
  option_key text,
  body text,
  source text,
  entered_at timestamptz,
  published_at timestamptz,
  first_id text,
  second_id text,
  row_count integer,
  private_state_valid boolean,
  feed_server_time_present boolean
) on commit drop;

do $fallback_matrix$
declare
  v_case record;
  v_entered_at timestamptz;
  v_feed jsonb;
  v_feed_again jsonb;
  v_private jsonb;
  v_option_key text;
  v_published_at timestamptz;
  v_row_count integer;
begin
  for v_case in
    select phrase.*
    from operator_phrase_cases phrase
    where phrase.is_fallback
    order by phrase.stage_order
  loop
    delete from public.bunker_operator_messages message
    where message.event_id = '00000000-0000-4000-8000-000000000802'
      and message.run_nonce = '00000000-0000-4000-8000-000000000803';

    v_entered_at := clock_timestamp() - interval '46 seconds';

    update public.bunker_state
    set global_game_state = v_case.stage
    where event_id = '00000000-0000-4000-8000-000000000802';

    update public.bunker_mission_instances instance
    set started_at = v_entered_at,
        status = 'active'
    where instance.event_id = '00000000-0000-4000-8000-000000000802'
      and instance.run_nonce = '00000000-0000-4000-8000-000000000803'
      and instance.mission_code = v_case.stage;

    v_feed := public.get_bunker_operator_feed('bunker-operator-contract');
    v_feed_again := public.get_bunker_operator_feed('bunker-operator-contract');
    v_private := public.get_liza_bunker_operator_state(
      'bunker-operator-contract', 'liza-operator-token-1234'
    );

    select message.option_key, message.published_at
    into v_option_key, v_published_at
    from public.bunker_operator_messages message
    where message.event_id = '00000000-0000-4000-8000-000000000802'
      and message.run_nonce = '00000000-0000-4000-8000-000000000803'
      and message.stage = v_case.stage;

    select count(*)::integer
    into v_row_count
    from public.bunker_operator_messages message
    where message.event_id = '00000000-0000-4000-8000-000000000802'
      and message.run_nonce = '00000000-0000-4000-8000-000000000803'
      and message.stage = v_case.stage;

    insert into operator_fallback_results(
      stage, stage_order, option_key, body, source,
      entered_at, published_at, first_id, second_id, row_count,
      private_state_valid, feed_server_time_present
    ) values (
      v_case.stage,
      v_case.stage_order,
      v_option_key,
      v_feed#>>'{message,body}',
      v_feed#>>'{message,source}',
      v_entered_at,
      v_published_at,
      v_feed#>>'{message,id}',
      v_feed_again#>>'{message,id}',
      v_row_count,
      v_private->>'status' = 'active'
        and v_private->>'stage' = v_case.stage
        and (v_private->>'windowOpen')::boolean is false
        and v_private#>>'{selectedMessage,source}' = 'fallback'
        and (v_private->>'enteredAt')::timestamptz = v_entered_at
        and (v_private->>'sendUntil')::timestamptz =
          v_entered_at + interval '45 seconds'
        and v_private ? 'serverNow',
      v_feed ? 'serverNow'
    );
  end loop;
end;
$fallback_matrix$;

select results_eq(
  $$
    select result.stage, result.option_key, result.body, result.source
    from operator_fallback_results result
    order by result.stage_order
  $$,
  $$
    select phrase.stage, phrase.option_key, phrase.body, 'fallback'::text
    from operator_phrase_cases phrase
    where phrase.is_fallback
    order by phrase.stage_order
  $$,
  'all four stages use the exact deterministic fallback mapping, including M06 option two'
);

select ok(
  (
    select count(*) = 4
      and bool_and(
        result.published_at = result.entered_at + interval '45 seconds'
      )
    from operator_fallback_results result
  ),
  'every fallback publication is anchored to its server stage timestamp plus 45 seconds'
);

select ok(
  (
    select count(*) = 4
      and bool_and(result.first_id = result.second_id)
      and bool_and(result.row_count = 1)
    from operator_fallback_results result
  ),
  'repeated polling persists one stable fallback row in every stage'
);

select ok(
  (
    select count(*) = 4 and bool_and(result.private_state_valid)
    from operator_fallback_results result
  ),
  'private state converges on the same expired fallback for every stage'
);

select ok(
  (
    select count(*) = 4 and bool_and(result.feed_server_time_present)
    from operator_fallback_results result
  ),
  'every fallback feed response includes authoritative server time'
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
