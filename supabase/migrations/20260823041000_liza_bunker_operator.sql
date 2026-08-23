-- Server-authoritative BK-17 transmissions. This layer is narrative only and
-- deliberately does not alter any M01-M06 answers, timers or completion gates.

create table public.bunker_operator_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  run_nonce text not null check (length(btrim(run_nonce)) > 0),
  stage text not null check (
    stage in ('MISSION_02', 'MISSION_04', 'MISSION_06', 'FINAL_30')
  ),
  option_key text not null check (length(btrim(option_key)) > 0),
  body text not null check (length(btrim(body)) > 0),
  source text not null check (source in ('selected', 'fallback')),
  published_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  unique (event_id, run_nonce, stage)
);

create index bunker_operator_messages_latest_idx
  on public.bunker_operator_messages(event_id, run_nonce, published_at desc);

alter table public.bunker_operator_messages enable row level security;
revoke all on table public.bunker_operator_messages
  from public, anon, authenticated;

create or replace function public.get_liza_bunker_operator_state(
  p_event_slug text,
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_access_event_id uuid;
  v_state public.bunker_state%rowtype;
  v_contract_version integer;
  v_now timestamptz := clock_timestamp();
  v_stage text;
  v_entered_at timestamptz;
  v_send_until timestamptz;
  v_fallback_key text;
  v_fallback_body text;
  v_options jsonb;
  v_message public.bunker_operator_messages%rowtype;
begin
  -- Keep attacker-controlled hashing bounded, and reject malformed credentials
  -- before any row lock can contend with the authoritative Bunker state.
  if char_length(coalesce(p_token, '')) < 16
    or char_length(coalesce(p_token, '')) > 128 then
    return jsonb_build_object('status', 'invalid_access');
  end if;

  select event.id
  into v_event_id
  from public.events event
  where event.slug = public._normalize_spaces(p_event_slug);

  if v_event_id is null then
    return jsonb_build_object('status', 'invalid_access');
  end if;

  if not exists (
    select 1
    from public.final_five_role_access access
    where access.event_id = v_event_id
      and access.role = 'liza'
      and access.revoked_at is null
      and access.token_hash = public._final_five_token_hash(p_token)
  ) then
    return jsonb_build_object('status', 'invalid_access');
  end if;

  select state.*
  into v_state
  from public.bunker_state state
  where state.event_id = v_event_id
  for update;

  -- State is the common first lock for Bunker reset/commands. Lock the access
  -- row only afterwards, so a token rotated while this call waited cannot be
  -- accepted and reset retains the same state -> access lock order.
  select access.event_id
  into v_access_event_id
  from public.final_five_role_access access
  where access.event_id = v_event_id
    and access.role = 'liza'
    and access.revoked_at is null
    and access.token_hash = public._final_five_token_hash(p_token)
  for share;

  if v_access_event_id is null then
    return jsonb_build_object('status', 'invalid_access');
  end if;

  -- Evaluate the window only after acquiring the authoritative state lock.
  v_now := clock_timestamp();

  if v_state.event_id is null
    or v_state.status <> 'active'
    or v_state.run_nonce is null then
    return jsonb_build_object(
      'status', 'idle',
      'bunkerActive', false,
      'serverNow', v_now
    );
  end if;

  select run.contract_version
  into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = v_event_id
    and run.run_nonce = v_state.run_nonce;

  if v_contract_version is distinct from 2 then
    return jsonb_build_object(
      'status', 'idle',
      'bunkerActive', false,
      'serverNow', v_now
    );
  end if;

  if v_state.global_game_state = 'BUNKER_OPEN' then
    return jsonb_build_object(
      'status', 'revealed',
      'bunkerActive', true,
      'globalGameState', v_state.global_game_state,
      'serverNow', v_now
    );
  end if;

  if v_state.global_game_state = 'FINISHED' then
    return jsonb_build_object(
      'status', 'finished',
      'bunkerActive', true,
      'globalGameState', v_state.global_game_state,
      'serverNow', v_now
    );
  end if;

  v_stage := case
    when v_state.global_game_state in (
      'MISSION_02', 'MISSION_04', 'MISSION_06', 'FINAL_30'
    ) then v_state.global_game_state
    else null
  end;

  if v_stage is null then
    return jsonb_build_object(
      'status', 'idle',
      'bunkerActive', true,
      'globalGameState', v_state.global_game_state,
      'serverNow', v_now
    );
  end if;

  select min(instance.started_at)
  into v_entered_at
  from public.bunker_mission_instances instance
  where instance.event_id = v_event_id
    and instance.run_nonce = v_state.run_nonce
    and instance.mission_code = v_stage
    and instance.started_at is not null;

  if v_entered_at is null then
    return jsonb_build_object(
      'status', 'idle',
      'bunkerActive', true,
      'globalGameState', v_state.global_game_state,
      'serverNow', v_now
    );
  end if;

  v_send_until := v_entered_at + interval '45 seconds';

  if v_now >= v_send_until then
    select fallback.option_key, fallback.body
    into v_fallback_key, v_fallback_body
    from (values
      ('MISSION_02', 'm02_signal',
        'Сигнал слабый, но я вас слышу. Продолжайте.'),
      ('MISSION_04', 'm04_connection',
        'Один вагон не дойдёт. Держите связь.'),
      ('MISSION_06', 'm06_every_fragment',
        'Состав почти у цели. Ни один фрагмент не лишний.'),
      ('FINAL_30', 'final_waiting',
        'Ворота ещё держатся. Я жду ваш сигнал.')
    ) as fallback(stage, option_key, body)
    where fallback.stage = v_stage;

    insert into public.bunker_operator_messages(
      event_id, run_nonce, stage, option_key, body, source, published_at
    ) values (
      v_event_id,
      v_state.run_nonce::text,
      v_stage,
      v_fallback_key,
      v_fallback_body,
      'fallback',
      v_send_until
    )
    on conflict (event_id, run_nonce, stage) do nothing;
  end if;

  select message.*
  into v_message
  from public.bunker_operator_messages message
  where message.event_id = v_event_id
    and message.run_nonce = v_state.run_nonce::text
    and message.stage = v_stage;

  v_options := case v_stage
    when 'MISSION_02' then jsonb_build_array(
      jsonb_build_object(
        'key', 'm02_signal',
        'body', 'Сигнал слабый, но я вас слышу. Продолжайте.'
      ),
      jsonb_build_object(
        'key', 'm02_fragments',
        'body', 'Не доверяйте одному фрагменту. Сверяйте всё, что нашли.'
      )
    )
    when 'MISSION_04' then jsonb_build_array(
      jsonb_build_object(
        'key', 'm04_connection',
        'body', 'Один вагон не дойдёт. Держите связь.'
      ),
      jsonb_build_object(
        'key', 'm04_share',
        'body', 'Передавайте не только слова. Делитесь тем, что спасёт других.'
      )
    )
    when 'MISSION_06' then jsonb_build_array(
      jsonb_build_object(
        'key', 'm06_between',
        'body', 'У каждого только часть маршрута. Ответ — между вами.'
      ),
      jsonb_build_object(
        'key', 'm06_every_fragment',
        'body', 'Состав почти у цели. Ни один фрагмент не лишний.'
      )
    )
    when 'FINAL_30' then jsonb_build_array(
      jsonb_build_object(
        'key', 'final_waiting',
        'body', 'Ворота ещё держатся. Я жду ваш сигнал.'
      ),
      jsonb_build_object(
        'key', 'final_viktor',
        'body', 'Ещё немного. Доведите поезд Виктора до конца.'
      )
    )
  end;

  return jsonb_build_object(
    'status', 'active',
    'bunkerActive', true,
    'globalGameState', v_state.global_game_state,
    'stage', v_stage,
    'enteredAt', v_entered_at,
    'sendUntil', v_send_until,
    'serverNow', v_now,
    'windowOpen', v_now >= v_entered_at
      and v_now < v_send_until
      and v_message.id is null,
    'options', v_options,
    'selectedMessage', case
      when v_message.id is null then null
      else jsonb_build_object(
        'id', v_message.id,
        'stage', v_message.stage,
        'optionKey', v_message.option_key,
        'body', v_message.body,
        'source', v_message.source,
        'publishedAt', v_message.published_at
      )
    end
  );
end;
$$;

create or replace function public.submit_liza_bunker_operator_phrase(
  p_event_slug text,
  p_token text,
  p_stage text,
  p_option_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_access_event_id uuid;
  v_state public.bunker_state%rowtype;
  v_contract_version integer;
  v_now timestamptz := clock_timestamp();
  v_entered_at timestamptz;
  v_send_until timestamptz;
  v_body text;
  v_message public.bunker_operator_messages%rowtype;
begin
  -- This is only a cheap rejection gate. The credential is authoritatively
  -- revalidated and locked after bunker_state below.
  if char_length(coalesce(p_token, '')) < 16
    or char_length(coalesce(p_token, '')) > 128 then
    raise exception 'invalid Liza operator access' using errcode = '42501';
  end if;

  select event.id
  into v_event_id
  from public.events event
  where event.slug = public._normalize_spaces(p_event_slug);

  if v_event_id is null then
    raise exception 'invalid Liza operator access' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.final_five_role_access access
    where access.event_id = v_event_id
      and access.role = 'liza'
      and access.revoked_at is null
      and access.token_hash = public._final_five_token_hash(p_token)
  ) then
    raise exception 'invalid Liza operator access' using errcode = '42501';
  end if;

  select state.*
  into v_state
  from public.bunker_state state
  where state.event_id = v_event_id
  for update;

  -- Revalidate and lock the exact credential after any state-row wait. A
  -- concurrent revoke/rotation either completes first and fails this lookup,
  -- or waits until this command transaction has finished.
  select access.event_id
  into v_access_event_id
  from public.final_five_role_access access
  where access.event_id = v_event_id
    and access.role = 'liza'
    and access.revoked_at is null
    and access.token_hash = public._final_five_token_hash(p_token)
  for share;

  if v_access_event_id is null then
    raise exception 'invalid Liza operator access' using errcode = '42501';
  end if;

  -- A caller that waited on the run lock must not use a stale pre-lock time.
  v_now := clock_timestamp();

  if v_state.event_id is null
    or v_state.status <> 'active'
    or v_state.run_nonce is null then
    raise exception 'active Bunker V2 run required' using errcode = '55000';
  end if;

  select run.contract_version
  into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = v_event_id
    and run.run_nonce = v_state.run_nonce;

  if v_contract_version is distinct from 2 then
    raise exception 'active Bunker V2 run required' using errcode = '55000';
  end if;

  if p_stage is null
    or p_stage not in ('MISSION_02', 'MISSION_04', 'MISSION_06', 'FINAL_30')
    or p_stage is distinct from v_state.global_game_state then
    raise exception 'operator stage is not active' using errcode = '55000';
  end if;

  v_body := case p_stage
    when 'MISSION_02' then case p_option_key
      when 'm02_signal' then
        'Сигнал слабый, но я вас слышу. Продолжайте.'
      when 'm02_fragments' then
        'Не доверяйте одному фрагменту. Сверяйте всё, что нашли.'
    end
    when 'MISSION_04' then case p_option_key
      when 'm04_connection' then
        'Один вагон не дойдёт. Держите связь.'
      when 'm04_share' then
        'Передавайте не только слова. Делитесь тем, что спасёт других.'
    end
    when 'MISSION_06' then case p_option_key
      when 'm06_between' then
        'У каждого только часть маршрута. Ответ — между вами.'
      when 'm06_every_fragment' then
        'Состав почти у цели. Ни один фрагмент не лишний.'
    end
    when 'FINAL_30' then case p_option_key
      when 'final_waiting' then
        'Ворота ещё держатся. Я жду ваш сигнал.'
      when 'final_viktor' then
        'Ещё немного. Доведите поезд Виктора до конца.'
    end
  end;

  if v_body is null then
    raise exception 'invalid operator phrase option' using errcode = '22023';
  end if;

  select min(instance.started_at)
  into v_entered_at
  from public.bunker_mission_instances instance
  where instance.event_id = v_event_id
    and instance.run_nonce = v_state.run_nonce
    and instance.mission_code = p_stage
    and instance.started_at is not null;

  if v_entered_at is null then
    raise exception 'operator stage is not active' using errcode = '55000';
  end if;

  v_send_until := v_entered_at + interval '45 seconds';
  if v_now < v_entered_at or v_now >= v_send_until then
    raise exception 'operator send window is closed' using errcode = '55000';
  end if;

  select message.*
  into v_message
  from public.bunker_operator_messages message
  where message.event_id = v_event_id
    and message.run_nonce = v_state.run_nonce::text
    and message.stage = p_stage;

  if v_message.id is not null then
    return jsonb_build_object(
      'status', 'locked',
      'serverNow', v_now,
      'message', jsonb_build_object(
        'id', v_message.id,
        'stage', v_message.stage,
        'optionKey', v_message.option_key,
        'body', v_message.body,
        'source', v_message.source,
        'publishedAt', v_message.published_at
      )
    );
  end if;

  insert into public.bunker_operator_messages(
    event_id, run_nonce, stage, option_key, body, source, published_at
  ) values (
    v_event_id,
    v_state.run_nonce::text,
    p_stage,
    p_option_key,
    v_body,
    'selected',
    v_now
  )
  returning * into v_message;

  return jsonb_build_object(
    'status', 'accepted',
    'serverNow', v_now,
    'message', jsonb_build_object(
      'id', v_message.id,
      'stage', v_message.stage,
      'optionKey', v_message.option_key,
      'body', v_message.body,
      'source', v_message.source,
      'publishedAt', v_message.published_at
    )
  );
end;
$$;

create or replace function public.get_bunker_operator_feed(
  p_event_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_state public.bunker_state%rowtype;
  v_contract_version integer;
  v_now timestamptz := clock_timestamp();
  v_stage text;
  v_entered_at timestamptz;
  v_send_until timestamptz;
  v_fallback_key text;
  v_fallback_body text;
  v_message public.bunker_operator_messages%rowtype;
begin
  select event.id
  into v_event_id
  from public.events event
  where event.slug = public._normalize_spaces(p_event_slug);

  if v_event_id is null then
    return jsonb_build_object(
      'status', 'idle',
      'active', false,
      'revealed', false,
      'serverNow', v_now,
      'message', null
    );
  end if;

  select state.*
  into v_state
  from public.bunker_state state
  where state.event_id = v_event_id
  for update;

  -- Keep fallback eligibility serialized with stage transitions.
  v_now := clock_timestamp();

  if v_state.event_id is null
    or v_state.status <> 'active'
    or v_state.run_nonce is null then
    return jsonb_build_object(
      'status', 'idle',
      'active', false,
      'revealed', false,
      'serverNow', v_now,
      'message', null
    );
  end if;

  select run.contract_version
  into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = v_event_id
    and run.run_nonce = v_state.run_nonce;

  if v_contract_version is distinct from 2 then
    return jsonb_build_object(
      'status', 'idle',
      'active', false,
      'revealed', false,
      'serverNow', v_now,
      'message', null
    );
  end if;

  v_stage := case
    when v_state.global_game_state in (
      'MISSION_02', 'MISSION_04', 'MISSION_06', 'FINAL_30'
    ) then v_state.global_game_state
    else null
  end;

  if v_stage is not null then
    select min(instance.started_at)
    into v_entered_at
    from public.bunker_mission_instances instance
    where instance.event_id = v_event_id
      and instance.run_nonce = v_state.run_nonce
      and instance.mission_code = v_stage
      and instance.started_at is not null;

    if v_entered_at is not null then
      v_send_until := v_entered_at + interval '45 seconds';
    end if;

    if v_send_until is not null and v_now >= v_send_until then
      select fallback.option_key, fallback.body
      into v_fallback_key, v_fallback_body
      from (values
        ('MISSION_02', 'm02_signal',
          'Сигнал слабый, но я вас слышу. Продолжайте.'),
        ('MISSION_04', 'm04_connection',
          'Один вагон не дойдёт. Держите связь.'),
        ('MISSION_06', 'm06_every_fragment',
          'Состав почти у цели. Ни один фрагмент не лишний.'),
        ('FINAL_30', 'final_waiting',
          'Ворота ещё держатся. Я жду ваш сигнал.')
      ) as fallback(stage, option_key, body)
      where fallback.stage = v_stage;

      insert into public.bunker_operator_messages(
        event_id, run_nonce, stage, option_key, body, source, published_at
      ) values (
        v_event_id,
        v_state.run_nonce::text,
        v_stage,
        v_fallback_key,
        v_fallback_body,
        'fallback',
        v_send_until
      )
      on conflict (event_id, run_nonce, stage) do nothing;
    end if;
  end if;

  select message.*
  into v_message
  from public.bunker_operator_messages message
  where message.event_id = v_event_id
    and message.run_nonce = v_state.run_nonce::text
  order by message.published_at desc, message.created_at desc, message.id
  limit 1;

  return jsonb_build_object(
    'status', 'active',
    'active', true,
    'globalGameState', v_state.global_game_state,
    'revealed', v_state.global_game_state in ('BUNKER_OPEN', 'FINISHED'),
    'serverNow', v_now,
    'message', case
      when v_message.id is null then null
      else jsonb_build_object(
        'id', v_message.id,
        'stage', v_message.stage,
        'body', v_message.body,
        'source', v_message.source,
        'publishedAt', v_message.published_at
      )
    end
  );
end;
$$;

revoke all on function public.get_liza_bunker_operator_state(text, text)
  from public, anon, authenticated;
revoke all on function public.submit_liza_bunker_operator_phrase(
  text, text, text, text
) from public, anon, authenticated;
revoke all on function public.get_bunker_operator_feed(text)
  from public, anon, authenticated;

grant execute on function public.get_liza_bunker_operator_state(text, text)
  to anon, authenticated;
grant execute on function public.submit_liza_bunker_operator_phrase(
  text, text, text, text
) to anon, authenticated;
grant execute on function public.get_bunker_operator_feed(text)
  to anon, authenticated;

-- Keep run cleanup dependency-safe while extending it to the non-FK text run
-- identifier used by operator transmissions.
create or replace function public._delete_bunker_game_run(
  p_event_id uuid,
  p_run_nonce uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if p_event_id is null or p_run_nonce is null then
    return;
  end if;

  delete from public.bunker_operator_messages message
  where message.event_id = p_event_id
    and message.run_nonce = p_run_nonce::text;

  loop
    delete from public.bunker_archive_entitlements entitlement
    where entitlement.event_id = p_event_id
      and entitlement.run_nonce = p_run_nonce
      and not exists (
        select 1
        from public.bunker_archive_entitlements child
        where child.event_id = entitlement.event_id
          and child.run_nonce = entitlement.run_nonce
          and child.source_entitlement_id = entitlement.id
      );
    get diagnostics v_deleted = row_count;
    exit when v_deleted = 0;
  end loop;

  if exists (
    select 1
    from public.bunker_archive_entitlements entitlement
    where entitlement.event_id = p_event_id
      and entitlement.run_nonce = p_run_nonce
  ) then
    raise exception 'cyclic Bunker archive entitlement provenance'
      using errcode = '23514';
  end if;

  delete from public.bunker_final_parameters parameter
  where parameter.event_id = p_event_id
    and parameter.run_nonce = p_run_nonce;

  delete from public.bunker_inventory_transfers transfer
  where transfer.event_id = p_event_id
    and transfer.run_nonce = p_run_nonce;

  update public.bunker_inventory_lots lot
  set source_lot_id = null
  where lot.event_id = p_event_id
    and lot.run_nonce = p_run_nonce
    and lot.source_lot_id is not null;

  delete from public.bunker_game_runs run
  where run.event_id = p_event_id
    and run.run_nonce = p_run_nonce;
end;
$$;

revoke all on function public._delete_bunker_game_run(uuid, uuid)
  from public, anon, authenticated;

-- Re-state both authoritative destructive reset entry points in this forward
-- migration. Their established confirmations and non-Bunker cleanup stay
-- unchanged; every historical run continues through the extended helper.
create or replace function public.owner_bunker_v2_reset_game_and_registrations(
  p_event_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
  v_run_nonce uuid;
begin
  perform public._require_bunker_owner(p_event_id);

  if coalesce(p_confirmation, '') <> 'СБРОСИТЬ ИГРУ И РЕГИСТРАЦИИ' then
    raise exception 'explicit game and registration reset confirmation required'
      using errcode = '22023';
  end if;

  perform public.owner_reset_bunker_progress(p_event_id, gen_random_uuid());

  for v_run_nonce in
    select run.run_nonce
    from public.bunker_game_runs run
    where run.event_id = p_event_id
    order by run.run_nonce
  loop
    perform public._delete_bunker_game_run(p_event_id, v_run_nonce);
  end loop;

  delete from public.guests guest
  where guest.event_id = p_event_id;
  get diagnostics v_deleted = row_count;

  update public.carriages
  set enabled = true
  where event_id = p_event_id;

  update public.events
  set registration_open = true,
      composition_locked = false,
      next_ticket_sequence = 1
  where id = p_event_id;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    p_event_id,
    auth.uid(),
    'bunker_game_and_registrations_reset',
    jsonb_build_object(
      'deletedGuests', v_deleted,
      'historicalBunkerRunsCleared', true
    )
  );

  return jsonb_build_object(
    'status', 'reset',
    'deletedGuests', v_deleted,
    'preservedCoupleAnswers', true,
    'historicalBunkerRunsCleared', true
  );
end;
$$;

revoke all on function public.owner_bunker_v2_reset_game_and_registrations(
  uuid, text
) from public, anon, authenticated;
grant execute on function public.owner_bunker_v2_reset_game_and_registrations(
  uuid, text
) to authenticated;

create or replace function public.owner_reset_event_test_data(
  p_event_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_run_nonce uuid;
begin
  perform public._require_bunker_owner(p_event_id);

  if coalesce(p_confirmation, '') <> 'СБРОСИТЬ' then
    raise exception 'explicit reset confirmation required' using errcode = '22023';
  end if;

  perform public.owner_reset_bunker_progress(p_event_id, gen_random_uuid());

  for v_run_nonce in
    select run.run_nonce
    from public.bunker_game_runs run
    where run.event_id = p_event_id
    order by run.run_nonce
  loop
    perform public._delete_bunker_game_run(p_event_id, v_run_nonce);
  end loop;

  v_result := public._owner_reset_event_test_data_without_v2(
    p_event_id,
    p_confirmation
  );

  return v_result || jsonb_build_object(
    'bunkerV2RunReset', true,
    'historicalBunkerRunsCleared', true
  );
end;
$$;

revoke all on function public.owner_reset_event_test_data(uuid, text)
  from public, anon, authenticated;
grant execute on function public.owner_reset_event_test_data(uuid, text)
  to authenticated;
