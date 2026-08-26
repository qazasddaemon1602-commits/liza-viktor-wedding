drop function if exists public.owner_control_ilya_song(text, text);

create function public.owner_control_ilya_song(
  p_event_slug text,
  p_action text,
  p_track_id text default 'ilya-toast'
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
  v_title text;
  v_artist text;
  v_duration_ms integer;
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
    raise exception 'unknown wedding music action' using errcode = '22023';
  end if;

  if p_action = 'play' then
    select track.title, track.artist, track.duration_ms
    into v_title, v_artist, v_duration_ms
    from (
      values
        ('ilya-toast', 'Песня про Илью', 'Посажёный отец', 233080),
        ('koshkin-dom', 'Кошкин дом', 'Свадебный плейлист', 347680),
        ('koshkin-dom-2', 'Кошкин дом — версия 2', 'Свадебный плейлист', 350281),
        ('koshkin-dom-3', 'Кошкин дом — версия 3', 'Свадебный плейлист', 354721),
        ('last-route', 'Последний маршрут', 'Свадебный плейлист', 227440)
    ) as track(id, title, artist, duration_ms)
    where track.id = p_track_id;

    if v_title is null then
      raise exception 'unknown wedding music track' using errcode = '22023';
    end if;
  end if;

  update public.screen_events
  set expires_at = now()
  where event_id = v_event_id
    and kind = 'ilya_song'
    and expires_at > now();

  if p_action = 'play' then
    v_payload := jsonb_build_object(
      'action', 'play',
      'trackId', p_track_id,
      'title', v_title,
      'artist', v_artist,
      'durationMs', v_duration_ms
    );
    v_expires_at := now()
      + make_interval(secs => ceil(v_duration_ms / 1000.0)::integer + 20);
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
    'action', p_action,
    'trackId', case when p_action = 'play' then p_track_id else null end
  );
end;
$$;

revoke all on function public.owner_control_ilya_song(text, text, text) from public, anon;
grant execute on function public.owner_control_ilya_song(text, text, text) to authenticated;
