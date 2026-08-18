create or replace function public.owner_send_carriage_call(
  p_event_id uuid,
  p_carriage_ids uuid[],
  p_message text,
  p_show_on_screen boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_message text := public._normalize_spaces(p_message);
  v_call public.carriage_calls%rowtype;
  v_requested_count integer;
  v_valid_count integer;
begin
  if v_owner is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.owner_user_id = v_owner
  ) then
    raise exception 'owner access required' using errcode = '42501';
  end if;

  if coalesce(v_message, '') = '' then
    raise exception 'call message is required' using errcode = '22023';
  end if;

  select count(*) into v_requested_count
  from (select distinct id from unnest(coalesce(p_carriage_ids, '{}'::uuid[])) as x(id)) requested;

  if v_requested_count = 0 then
    raise exception 'at least one carriage is required' using errcode = '22023';
  end if;

  select count(*) into v_valid_count
  from public.carriages c
  where c.event_id = p_event_id
    and c.enabled
    and c.id in (
      select distinct id
      from unnest(p_carriage_ids) as x(id)
    );

  if v_valid_count <> v_requested_count then
    raise exception 'invalid carriage target' using errcode = '22023';
  end if;

  update public.carriage_calls
  set active = false,
      cleared_at = coalesce(cleared_at, now())
  where event_id = p_event_id
    and active;

  insert into public.carriage_calls (
    event_id,
    message,
    active,
    show_on_screen,
    created_by
  ) values (
    p_event_id,
    v_message,
    true,
    coalesce(p_show_on_screen, false),
    v_owner
  )
  returning * into v_call;

  insert into public.carriage_call_targets(call_id, carriage_id)
  select v_call.id, id
  from (
    select distinct id
    from unnest(p_carriage_ids) as x(id)
  ) targets;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    p_event_id,
    v_owner,
    'carriage_call_sent',
    jsonb_build_object(
      'callId', v_call.id,
      'carriageIds', to_jsonb(p_carriage_ids),
      'message', v_message,
      'showOnScreen', v_call.show_on_screen
    )
  );

  return jsonb_build_object(
    'status', 'sent',
    'callId', v_call.id,
    'message', v_call.message,
    'targetCarriageIds', to_jsonb(p_carriage_ids),
    'showOnScreen', v_call.show_on_screen,
    'createdAt', v_call.created_at
  );
end;
$$;

create or replace function public.owner_clear_carriage_call(p_call_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_call public.carriage_calls%rowtype;
begin
  if v_owner is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;

  select cc.* into v_call
  from public.carriage_calls cc
  join public.events e on e.id = cc.event_id
  where cc.id = p_call_id
    and e.owner_user_id = v_owner
  for update of cc;

  if v_call.id is null then
    raise exception 'owner access required or call not found' using errcode = '42501';
  end if;

  update public.carriage_calls
  set active = false,
      cleared_at = coalesce(cleared_at, now())
  where id = v_call.id;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    v_call.event_id,
    v_owner,
    'carriage_call_cleared',
    jsonb_build_object('callId', v_call.id)
  );

  return jsonb_build_object(
    'status', 'cleared',
    'callId', v_call.id
  );
end;
$$;

create or replace function public.get_guest_active_carriage_calls(
  p_event_slug text,
  p_device_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_guest public.guests%rowtype;
  v_carriage public.carriages%rowtype;
  v_device_hash text;
begin
  if coalesce(public._normalize_spaces(p_event_slug), '') = '' then
    raise exception 'event slug is required' using errcode = '22023';
  end if;

  if coalesce(btrim(p_device_key), '') = '' then
    raise exception 'device key is required' using errcode = '22023';
  end if;

  select e.* into v_event
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug);

  if v_event.id is null then
    return jsonb_build_object('status', 'not_found', 'calls', '[]'::jsonb);
  end if;

  v_device_hash := public._device_hash(p_device_key);

  select g.* into v_guest
  from public.guest_device_bindings b
  join public.guests g on g.id = b.guest_id
  where b.event_id = v_event.id
    and b.device_key_hash = v_device_hash;

  if v_guest.id is null then
    return jsonb_build_object('status', 'not_found', 'calls', '[]'::jsonb);
  end if;

  select c.* into v_carriage
  from public.carriages c
  where c.id = v_guest.carriage_id;

  return jsonb_build_object(
    'status', 'ok',
    'carriage', jsonb_build_object(
      'id', v_carriage.id,
      'number', v_carriage.number,
      'label', v_carriage.label,
      'accentHex', v_carriage.accent_hex,
      'visualMark', v_carriage.visual_mark
    ),
    'calls', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', cc.id,
            'message', cc.message,
            'showOnScreen', cc.show_on_screen,
            'createdAt', cc.created_at
          ) order by cc.created_at desc
        ),
        '[]'::jsonb
      )
      from public.carriage_calls cc
      join public.carriage_call_targets t on t.call_id = cc.id
      where cc.event_id = v_event.id
        and cc.active
        and t.carriage_id = v_guest.carriage_id
    )
  );
end;
$$;

revoke all on function public.owner_send_carriage_call(uuid, uuid[], text, boolean) from public;
grant execute on function public.owner_send_carriage_call(uuid, uuid[], text, boolean) to authenticated;

revoke all on function public.owner_clear_carriage_call(uuid) from public;
grant execute on function public.owner_clear_carriage_call(uuid) to authenticated;

revoke all on function public.get_guest_active_carriage_calls(text, text) from public;
grant execute on function public.get_guest_active_carriage_calls(text, text) to anon, authenticated;
