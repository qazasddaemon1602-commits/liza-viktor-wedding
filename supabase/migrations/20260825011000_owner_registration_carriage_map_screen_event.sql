create or replace function public.owner_publish_registration_carriage_map(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_event_slug text;
  v_map jsonb;
  v_screen_event_id uuid;
begin
  if v_owner is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;

  select event.slug into v_event_slug
  from public.events event
  where event.id = p_event_id
    and event.owner_user_id = v_owner;

  if v_event_slug is null then
    raise exception 'owner access required or event not found' using errcode = '42501';
  end if;

  v_map := public.get_registration_carriage_map(v_event_slug);
  if coalesce(v_map->>'status', '') not in ('registration', 'complete') then
    raise exception 'carriage map is unavailable' using errcode = '55000';
  end if;

  delete from public.screen_events
  where event_id = p_event_id
    and expires_at < pg_catalog.now() - interval '5 minutes';

  insert into public.screen_events (
    event_id,
    event_slug,
    kind,
    payload,
    public_visible,
    expires_at
  ) values (
    p_event_id,
    v_event_slug,
    'carriage_map_show',
    pg_catalog.jsonb_build_object('map', v_map),
    true,
    pg_catalog.now() + interval '30 seconds'
  )
  returning id into v_screen_event_id;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    p_event_id,
    v_owner,
    'registration_carriage_map_published_to_screen',
    pg_catalog.jsonb_build_object('screenEventId', v_screen_event_id)
  );

  return pg_catalog.jsonb_build_object(
    'status', 'published',
    'screenEventId', v_screen_event_id
  );
end;
$$;

revoke all on function public.owner_publish_registration_carriage_map(uuid)
  from public, anon;
grant execute on function public.owner_publish_registration_carriage_map(uuid)
  to authenticated;
