create or replace function public.owner_control_ilya_song(
  p_event_slug text,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_event_id uuid;
  v_event_row_id uuid;
  v_payload jsonb;
  v_expires_at timestamptz;
begin
  if v_owner is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;

  select e.id into v_event_id
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug)
    and e.owner_user_id = v_owner;

  if v_event_id is null then
    raise exception 'owner access required or event not found' using errcode = '42501';
  end if;

  if p_action not in ('play', 'stop') then
    raise exception 'unknown Ilya song action' using errcode = '22023';
  end if;

  update public.screen_events
  set expires_at = now()
  where event_id = v_event_id
    and kind = 'ilya_song'
    and expires_at > now();

  if p_action = 'play' then
    v_payload := jsonb_build_object(
      'action', 'play',
      'title', 'Песня про Илью',
      'artist', 'Посажёный отец',
      'durationMs', 233080
    );
    v_expires_at := now() + interval '4 minutes';
  else
    v_payload := jsonb_build_object('action', 'stop');
    v_expires_at := now() + interval '20 seconds';
  end if;

  insert into public.screen_events(
    event_id,
    event_slug,
    kind,
    payload,
    public_visible,
    expires_at
  )
  values (
    v_event_id,
    public._normalize_spaces(p_event_slug),
    'ilya_song',
    v_payload,
    true,
    v_expires_at
  )
  returning id into v_event_row_id;

  return jsonb_build_object(
    'status', 'ok',
    'eventId', v_event_row_id,
    'action', p_action
  );
end;
$$;

revoke all on function public.owner_control_ilya_song(text, text) from public, anon;
grant execute on function public.owner_control_ilya_song(text, text) to authenticated;
