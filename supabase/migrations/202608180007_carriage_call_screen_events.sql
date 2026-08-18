create or replace function public.owner_publish_carriage_call_screen_event(p_call_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_call public.carriage_calls%rowtype;
  v_event_slug text;
  v_targets jsonb;
  v_screen_event_id uuid;
begin
  if v_owner is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;

  select cc.*
  into v_call
  from public.carriage_calls cc
  join public.events e on e.id = cc.event_id
  where cc.id = p_call_id
    and e.owner_user_id = v_owner;

  if v_call.id is null then
    raise exception 'owner access required or call not found' using errcode = '42501';
  end if;

  if not v_call.show_on_screen then
    raise exception 'call is not approved for projector' using errcode = '22023';
  end if;

  select e.slug
  into v_event_slug
  from public.events e
  where e.id = v_call.event_id
    and e.owner_user_id = v_owner;

  if v_event_slug is null then
    raise exception 'owner access required' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'number', c.number,
        'label', c.label,
        'accentHex', c.accent_hex,
        'visualMark', c.visual_mark
      ) order by c.number
    ),
    '[]'::jsonb
  )
  into v_targets
  from public.carriage_call_targets t
  join public.carriages c on c.id = t.carriage_id
  where t.call_id = v_call.id;

  if jsonb_array_length(v_targets) = 0 then
    raise exception 'call has no carriage targets' using errcode = '22023';
  end if;

  insert into public.screen_events (
    event_id,
    event_slug,
    kind,
    payload,
    public_visible,
    expires_at
  ) values (
    v_call.event_id,
    v_event_slug,
    'carriage_call',
    jsonb_build_object(
      'callId', v_call.id,
      'message', v_call.message,
      'carriages', v_targets
    ),
    true,
    now() + interval '30 seconds'
  )
  returning id into v_screen_event_id;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    v_call.event_id,
    v_owner,
    'carriage_call_published_to_screen',
    jsonb_build_object(
      'callId', v_call.id,
      'screenEventId', v_screen_event_id
    )
  );

  return jsonb_build_object(
    'status', 'published',
    'screenEventId', v_screen_event_id
  );
end;
$$;

revoke all on function public.owner_publish_carriage_call_screen_event(uuid) from public, anon;
grant execute on function public.owner_publish_carriage_call_screen_event(uuid) to authenticated;
