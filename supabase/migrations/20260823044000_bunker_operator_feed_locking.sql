-- Keep high-frequency public feed polling lock-free unless an expired stage
-- actually needs its deterministic fallback persisted. Historical operator
-- migrations remain immutable.

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
  v_fallback_required boolean := false;
  v_has_current_message boolean := false;
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

  -- Ordinary two-second polls use an unlocked snapshot. The only write this
  -- RPC may perform is guarded by the locked, fully revalidated branch below.
  select state.*
  into v_state
  from public.bunker_state state
  where state.event_id = v_event_id;

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
      select exists (
        select 1
        from public.bunker_operator_messages message
        where message.event_id = v_event_id
          and message.run_nonce = v_state.run_nonce::text
          and message.stage = v_stage
      )
      into v_has_current_message;

      v_fallback_required := not v_has_current_message;
    end if;
  end if;

  if v_fallback_required then
    -- Serialize only the possible insert with stage transitions and operator
    -- submission. Everything derived above is discarded and recomputed.
    select state.*
    into v_state
    from public.bunker_state state
    where state.event_id = v_event_id
    for update;

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

    v_contract_version := null;
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
    v_entered_at := null;
    v_send_until := null;
    v_has_current_message := false;
    v_fallback_key := null;
    v_fallback_body := null;

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
        select exists (
          select 1
          from public.bunker_operator_messages message
          where message.event_id = v_event_id
            and message.run_nonce = v_state.run_nonce::text
            and message.stage = v_stage
        )
        into v_has_current_message;

        if not v_has_current_message then
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

          if v_fallback_key is not null then
            insert into public.bunker_operator_messages(
              event_id, run_nonce, stage, option_key,
              body, source, published_at
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
      end if;
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

revoke all on function public.get_bunker_operator_feed(text)
  from public, anon, authenticated;
grant execute on function public.get_bunker_operator_feed(text)
  to anon, authenticated;
