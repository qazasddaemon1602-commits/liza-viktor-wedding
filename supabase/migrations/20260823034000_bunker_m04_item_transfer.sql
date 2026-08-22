-- Keep the original global-mission implementation as an internal core so this
-- migration can add the M04 transfer transaction without duplicating the
-- validation for M01-M06.
do $$
begin
  if to_regprocedure(
    'public._bunker_global_mission_action_core(uuid,uuid,uuid,text)'
  ) is null then
    alter function public._bunker_global_mission_action(uuid, uuid, uuid, text)
      rename to _bunker_global_mission_action_core;
  end if;
end;
$$;

create or replace function public._bunker_global_mission_action(
  p_event_id uuid,
  p_run_nonce uuid,
  p_carriage_id uuid,
  p_mission_state text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_action jsonb;
  v_transferable_items jsonb := '[]'::jsonb;
begin
  v_action := public._bunker_global_mission_action_core(
    p_event_id,
    p_run_nonce,
    p_carriage_id,
    p_mission_state
  );

  if v_action is null or p_mission_state <> 'MISSION_04' then
    return v_action;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'itemKey', available.item_key,
        'quantity', available.quantity
      ) order by available.item_key
    ),
    '[]'::jsonb
  )
  into v_transferable_items
  from (
    select item.item_key, sum(item.quantity)::integer as quantity
    from public.bunker_inventory_lots item
    where item.event_id = p_event_id
      and item.run_nonce = p_run_nonce
      and item.carriage_id = p_carriage_id
      and item.status = 'available'
    group by item.item_key
  ) available;

  return jsonb_set(
    v_action,
    '{requirements,transferableItems}',
    v_transferable_items,
    true
  );
end;
$$;

do $$
begin
  if to_regprocedure(
    'public._submit_guest_bunker_global_mission_core(text,text,text,jsonb)'
  ) is null then
    alter function public.submit_guest_bunker_global_mission(text, text, text, jsonb)
      rename to _submit_guest_bunker_global_mission_core;
  end if;
end;
$$;

create or replace function public.submit_guest_bunker_global_mission(
  p_event_slug text,
  p_device_key text,
  p_mission_state text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_event_id uuid;
  v_guest_id uuid;
  v_carriage_id uuid;
  v_run_nonce uuid;
  v_plan jsonb;
  v_group jsonb := '[]'::jsonb;
  v_transfer_item_key text;
  v_transfer_to_text text;
  v_transfer_to_wagon_id uuid;
  v_source public.bunker_inventory_lots%rowtype;
  v_destination_lot_id uuid;
  v_transfer_item_label text;
  v_transfer_to_wagon_label text;
  v_transfer_summary text;
  v_submitted_payload jsonb;
begin
  v_result := public._submit_guest_bunker_global_mission_core(
    p_event_slug,
    p_device_key,
    p_mission_state,
    p_payload
  );

  if p_mission_state <> 'MISSION_04'
    or coalesce((v_result->>'changed')::boolean, false) = false then
    return v_result;
  end if;

  v_transfer_item_key := nullif(btrim(coalesce(p_payload->>'transferItemKey', '')), '');
  v_transfer_to_text := nullif(btrim(coalesce(p_payload->>'transferToWagonId', '')), '');

  if v_transfer_item_key is null then
    if v_transfer_to_text is not null then
      raise exception 'invalid Mission 04 transfer item' using errcode = '22023';
    end if;
    return v_result;
  end if;

  if v_transfer_item_key !~ '^[a-z][a-z0-9_]+$'
    or v_transfer_to_text is null
    or v_transfer_to_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'invalid Mission 04 transfer destination' using errcode = '22023';
  end if;
  v_transfer_to_wagon_id := v_transfer_to_text::uuid;

  select event.id into v_event_id
  from public.events event
  where event.slug = public._normalize_spaces(p_event_slug);

  v_guest_id := public._bunker_guest_id(p_event_slug, p_device_key);
  select guest.carriage_id into v_carriage_id
  from public.guests guest
  where guest.id = v_guest_id and guest.event_id = v_event_id;

  select state.run_nonce into v_run_nonce
  from public.bunker_state state
  where state.event_id = v_event_id;

  select run.plan into v_plan
  from public.bunker_game_runs run
  where run.event_id = v_event_id and run.run_nonce = v_run_nonce;

  select mission_group.value into v_group
  from jsonb_array_elements(
    coalesce(v_plan#>'{mission04,groups}', '[]'::jsonb)
  ) mission_group(value)
  where exists (
    select 1
    from jsonb_array_elements_text(mission_group.value) member(value)
    where member.value = v_carriage_id::text
  )
  limit 1;

  if v_group is null or not exists (
    select 1
    from jsonb_array_elements_text(v_group) member(value)
    where member.value = v_transfer_to_wagon_id::text
      and member.value <> v_carriage_id::text
  ) then
    raise exception 'invalid Mission 04 transfer destination' using errcode = '22023';
  end if;

  select carriage.label into v_transfer_to_wagon_label
  from public.carriages carriage
  where carriage.id = v_transfer_to_wagon_id
    and carriage.event_id = v_event_id
    and carriage.enabled;

  if v_transfer_to_wagon_label is null then
    raise exception 'invalid Mission 04 transfer destination' using errcode = '22023';
  end if;

  select item.* into v_source
  from public.bunker_inventory_lots item
  where item.event_id = v_event_id
    and item.run_nonce = v_run_nonce
    and item.carriage_id = v_carriage_id
    and item.item_key = v_transfer_item_key
    and item.status = 'available'
  order by item.acquired_at, item.id
  limit 1
  for update;

  if v_source.id is null then
    raise exception 'invalid Mission 04 inventory item' using errcode = '22023';
  end if;

  v_transfer_item_label := case v_source.item_key
    when 'medkit' then 'Аптечка'
    when 'radio' then 'Рация'
    when 'generator' then 'Генератор'
    when 'tools' then 'Инструменты'
    when 'water' then 'Вода'
    when 'gas_mask' then 'Противогаз'
    else initcap(replace(v_source.item_key, '_', ' '))
  end;
  v_transfer_summary := v_transfer_item_label
    || ' → ' || v_transfer_to_wagon_label
    || ' · ' || v_source.quantity::text || ' ШТ.';

  update public.bunker_inventory_lots item
  set status = 'transferred',
      transferred_to = v_transfer_to_wagon_id,
      used_at = null,
      metadata = item.metadata || jsonb_build_object(
        'transferredByMission', 'MISSION_04',
        'transferredAt', clock_timestamp()
      )
  where item.id = v_source.id;

  insert into public.bunker_inventory_lots(
    event_id,
    run_nonce,
    carriage_id,
    item_key,
    quantity,
    status,
    acquired_at,
    source_lot_id,
    metadata
  ) values (
    v_event_id,
    v_run_nonce,
    v_transfer_to_wagon_id,
    v_source.item_key,
    v_source.quantity,
    'available',
    clock_timestamp(),
    v_source.id,
    v_source.metadata || jsonb_build_object(
      'receivedByMission', 'MISSION_04',
      'sourceWagonId', v_carriage_id
    )
  )
  returning id into v_destination_lot_id;

  insert into public.bunker_game_events(
    event_id,
    run_nonce,
    carriage_id,
    guest_id,
    event_type,
    actor_type,
    payload
  ) values (
    v_event_id,
    v_run_nonce,
    v_carriage_id,
    v_guest_id,
    'inventory_transferred',
    'guest',
    jsonb_build_object(
      'missionState', 'MISSION_04',
      'itemKey', v_source.item_key,
      'quantity', v_source.quantity,
      'fromWagonId', v_carriage_id,
      'toWagonId', v_transfer_to_wagon_id,
      'itemLabel', v_transfer_item_label,
      'toWagonLabel', v_transfer_to_wagon_label,
      'summary', v_transfer_summary,
      'sourceLotId', v_source.id,
      'destinationLotId', v_destination_lot_id
    )
  );

  v_submitted_payload := coalesce(v_result->'submittedPayload', '{}'::jsonb)
    || jsonb_build_object(
      'transferItemKey', v_source.item_key,
      'transferToWagonId', v_transfer_to_wagon_id,
      'transferQuantity', v_source.quantity,
      'transferItemLabel', v_transfer_item_label,
      'transferToWagonLabel', v_transfer_to_wagon_label,
      'transferSummary', v_transfer_summary
    );

  update public.bunker_global_mission_progress progress
  set submitted_payload = v_submitted_payload,
      updated_at = now()
  where progress.event_id = v_event_id
    and progress.run_nonce = v_run_nonce
    and progress.carriage_id = v_carriage_id
    and progress.mission_state = 'MISSION_04';

  update public.bunker_game_events game_event
  set payload = jsonb_set(
    game_event.payload,
    '{submittedPayload}',
    v_submitted_payload,
    true
  )
  where game_event.id = (
    select completed.id
    from public.bunker_game_events completed
    where completed.event_id = v_event_id
      and completed.run_nonce = v_run_nonce
      and completed.carriage_id = v_carriage_id
      and completed.event_type = 'global_mission_completed'
      and completed.payload->>'missionState' = 'MISSION_04'
    order by completed.id desc
    limit 1
  );

  return jsonb_set(v_result, '{submittedPayload}', v_submitted_payload, true);
end;
$$;

revoke all on function public._bunker_global_mission_action_core(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public._bunker_global_mission_action(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public._submit_guest_bunker_global_mission_core(text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.submit_guest_bunker_global_mission(text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_guest_bunker_global_mission(text, text, text, jsonb)
  to anon, authenticated;
