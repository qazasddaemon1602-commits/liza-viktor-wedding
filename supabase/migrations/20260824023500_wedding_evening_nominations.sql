create or replace function public._wedding_evening_nominations(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_nominations jsonb := '[]'::jsonb;
  v_first record;
  v_champion record;
  v_run_nonce uuid;
  v_wagon record;
  v_detective record;
begin
  select
    g.first_name || ' ' || upper(left(g.last_name, 1)) || '.' as display_name,
    g.ticket_number,
    c.label as carriage_label
  into v_first
  from public.guests g
  join public.carriages c on c.id = g.carriage_id
  where g.event_id = p_event_id
    and coalesce(g.affiliation_detail, '') <> '__BUNKER_TEST__'
    and g.first_name not like '__%'
  order by g.registered_at, g.ticket_sequence, g.id
  limit 1;

  if v_first.display_name is not null then
    v_nominations := v_nominations || jsonb_build_array(jsonb_build_object(
      'key', 'first_passenger',
      'title', 'ПЕРВЫЙ ПАССАЖИР',
      'recipient', v_first.display_name,
      'detail', coalesce(v_first.ticket_number, v_first.carriage_label)
    ));
  end if;

  select
    g.first_name || ' ' || upper(left(g.last_name, 1)) || '.' as display_name,
    c.label as carriage_label
  into v_champion
  from public.mk_tournaments t
  join public.guests g on g.id = t.champion_guest_id and g.event_id = t.event_id
  join public.carriages c on c.id = g.carriage_id
  where t.event_id = p_event_id
    and t.champion_guest_id is not null
    and coalesce(g.affiliation_detail, '') <> '__BUNKER_TEST__'
  order by t.updated_at desc
  limit 1;

  if v_champion.display_name is not null then
    v_nominations := v_nominations || jsonb_build_array(jsonb_build_object(
      'key', 'mk_champion',
      'title', 'ЧЕМПИОН ПОСЛЕДНЕГО КРУГА',
      'recipient', v_champion.display_name,
      'detail', v_champion.carriage_label
    ));
  end if;

  select s.run_nonce into v_run_nonce
  from public.bunker_state s
  where s.event_id = p_event_id;

  if v_run_nonce is not null then
    with wagon_progress as (
      select
        i.scope_key::uuid as carriage_id,
        count(*) filter (where i.completed_at is not null)::integer as completed_count,
        max(i.completed_at) filter (where i.completed_at is not null) as last_completed_at
      from public.bunker_mission_instances i
      where i.event_id = p_event_id
        and i.run_nonce = v_run_nonce
        and i.scope_kind = 'wagon'
        and i.mission_code in ('MISSION_01','MISSION_02','MISSION_03','MISSION_05')
      group by i.scope_key
    )
    select
      c.label as carriage_label,
      p.completed_count,
      p.last_completed_at
    into v_wagon
    from wagon_progress p
    join public.carriages c on c.id = p.carriage_id and c.event_id = p_event_id
    where p.completed_count = 4
    order by p.last_completed_at asc nulls last, c.number
    limit 1;

    if v_wagon.carriage_label is not null then
      v_nominations := v_nominations || jsonb_build_array(jsonb_build_object(
        'key', 'steadfast_wagon',
        'title', 'САМЫЙ СТОЙКИЙ ВАГОН',
        'recipient', v_wagon.carriage_label,
        'detail', '4/4 ВАГОННЫХ МИССИЙ · ПЕРВЫМ ДО ФИНИША'
      ));
    end if;

    select
      c.label as carriage_label,
      i.completed_at
    into v_detective
    from public.bunker_mission_instances i
    join public.carriages c
      on c.id = i.scope_key::uuid
     and c.event_id = i.event_id
    where i.event_id = p_event_id
      and i.run_nonce = v_run_nonce
      and i.scope_kind = 'wagon'
      and i.mission_code = 'MISSION_02'
      and i.completed_at is not null
    order by i.completed_at, c.number
    limit 1;

    if v_detective.carriage_label is not null then
      v_nominations := v_nominations || jsonb_build_array(jsonb_build_object(
        'key', 'detective_wagon',
        'title', 'ДЕТЕКТИВ BK-17',
        'recipient', v_detective.carriage_label,
        'detail', 'ПЕРВЫМ ЗАКРЫЛ «ЧЁРНЫЙ ЯЩИК»'
      ));
    end if;
  end if;

  return v_nominations;
end;
$$;

create or replace function public.owner_get_evening_nominations(p_event_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_event_id uuid;
  v_nominations jsonb;
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

  v_nominations := public._wedding_evening_nominations(v_event_id);
  return jsonb_build_object('status', 'ok', 'nominations', v_nominations);
end;
$$;

create or replace function public.owner_publish_evening_nominations(p_event_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_event_id uuid;
  v_nominations jsonb;
  v_count integer;
  v_screen_event_id uuid;
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

  v_nominations := public._wedding_evening_nominations(v_event_id);
  v_count := jsonb_array_length(v_nominations);

  if v_count = 0 then
    return jsonb_build_object('status', 'empty', 'publishedCount', 0);
  end if;

  insert into public.screen_events(event_id,event_slug,kind,payload,public_visible,expires_at)
  values(
    v_event_id,
    public._normalize_spaces(p_event_slug),
    'evening_nominations',
    jsonb_build_object('nominations', v_nominations),
    true,
    now() + interval '45 seconds'
  )
  returning id into v_screen_event_id;

  return jsonb_build_object(
    'status', 'published',
    'eventId', v_screen_event_id,
    'publishedCount', v_count
  );
end;
$$;

revoke all on function public._wedding_evening_nominations(uuid) from public, anon, authenticated;
revoke all on function public.owner_get_evening_nominations(text) from public, anon;
revoke all on function public.owner_publish_evening_nominations(text) from public, anon;
grant execute on function public.owner_get_evening_nominations(text) to authenticated;
grant execute on function public.owner_publish_evening_nominations(text) to authenticated;
