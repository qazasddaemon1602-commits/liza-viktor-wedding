create table public.bunker_global_mission_progress (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  run_nonce uuid not null,
  carriage_id uuid not null references public.carriages(id) on delete cascade,
  mission_state text not null check (mission_state in (
    'MISSION_01', 'MISSION_02', 'MISSION_03',
    'MISSION_04', 'MISSION_05', 'MISSION_06'
  )),
  submitted_payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(submitted_payload) = 'object'),
  completed_at timestamptz not null default clock_timestamp(),
  completed_by_guest_id uuid references public.guests(id) on delete set null,
  forced_by_owner boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_nonce, carriage_id, mission_state),
  foreign key (event_id, run_nonce)
    references public.bunker_game_runs(event_id, run_nonce) on delete cascade
);

create index bunker_global_mission_progress_event_run_idx
  on public.bunker_global_mission_progress(event_id, run_nonce, mission_state);

alter table public.bunker_global_mission_progress enable row level security;
revoke all on table public.bunker_global_mission_progress
  from public, anon, authenticated;

create or replace function public._bunker_global_mission_progress_summary(
  p_event_id uuid,
  p_run_nonce uuid,
  p_mission_state text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_total integer := 0;
  v_completed integer := 0;
begin
  if p_mission_state not in (
    'MISSION_01', 'MISSION_02', 'MISSION_03',
    'MISSION_04', 'MISSION_05', 'MISSION_06'
  ) then
    return null;
  end if;

  select count(*)::integer into v_total
  from public.carriages carriage
  where carriage.event_id = p_event_id and carriage.enabled;

  select count(*)::integer into v_completed
  from public.bunker_global_mission_progress progress
  join public.carriages carriage
    on carriage.id = progress.carriage_id
   and carriage.event_id = p_event_id
   and carriage.enabled
  where progress.event_id = p_event_id
    and progress.run_nonce = p_run_nonce
    and progress.mission_state = p_mission_state;

  return jsonb_build_object(
    'missionState', p_mission_state,
    'completedWagons', v_completed,
    'totalWagons', v_total,
    'complete', v_total > 0 and v_completed = v_total
  );
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
  v_progress public.bunker_global_mission_progress%rowtype;
  v_plan jsonb;
  v_requirements jsonb := '{}'::jsonb;
  v_exclusion_count integer := 0;
  v_group jsonb := '[]'::jsonb;
  v_group_wagons jsonb := '[]'::jsonb;
  v_partner_wagons jsonb := '[]'::jsonb;
  v_required_wagons jsonb := '[]'::jsonb;
  v_reward_fragment text;
  v_wagon_count integer := 1;
  v_wagon_ordinal integer := 1;
  v_group_count integer := 0;
  v_group_ordinal integer := 0;
  v_message_fragment text;
begin
  if p_mission_state not in (
    'MISSION_01', 'MISSION_02', 'MISSION_03',
    'MISSION_04', 'MISSION_05', 'MISSION_06'
  ) then
    return null;
  end if;

  select progress.* into v_progress
  from public.bunker_global_mission_progress progress
  where progress.event_id = p_event_id
    and progress.run_nonce = p_run_nonce
    and progress.carriage_id = p_carriage_id
    and progress.mission_state = p_mission_state;

  select run.plan into v_plan
  from public.bunker_game_runs run
  where run.event_id = p_event_id and run.run_nonce = p_run_nonce;

  select ranked.wagon_count, ranked.wagon_ordinal
  into v_wagon_count, v_wagon_ordinal
  from (
    select carriage.id,
      count(*) over ()::integer as wagon_count,
      row_number() over (order by carriage.sort_order, carriage.number, carriage.id)::integer as wagon_ordinal
    from public.carriages carriage
    where carriage.event_id = p_event_id and carriage.enabled
  ) ranked
  where ranked.id = p_carriage_id;
  v_wagon_count := greatest(coalesce(v_wagon_count, 1), 1);
  v_wagon_ordinal := greatest(coalesce(v_wagon_ordinal, 1), 1);

  if p_mission_state = 'MISSION_01' then
    select coalesce((mission.value->>'exclusionCount')::integer, 0)
    into v_exclusion_count
    from jsonb_array_elements(coalesce(v_plan->'mission01', '[]'::jsonb)) mission(value)
    where mission.value->>'wagonId' = p_carriage_id::text;

    v_requirements := jsonb_build_object(
      'exclusionCount', v_exclusion_count,
      'selectableProfiles', coalesce((
        select jsonb_agg(jsonb_build_object(
          'profileId', profile.id,
          'guestId', guest.id,
          'realName', guest.first_name || ' ' || upper(left(guest.last_name, 1)) || '.',
          'profession', profile.profession,
          'status', profile.character_status
        ) order by guest.registered_at, guest.id)
        from public.bunker_guest_profiles profile
        join public.guests guest
          on guest.id = profile.guest_id and guest.event_id = p_event_id
        where profile.event_id = p_event_id
          and profile.run_nonce = p_run_nonce
          and guest.carriage_id = p_carriage_id
      ), '[]'::jsonb)
    );
  elsif p_mission_state = 'MISSION_02' then
    v_requirements := jsonb_build_object(
      'minLength', 30,
      'requiredTerms', jsonb_build_array(
        'bk-17', 'bk17', 'сектор', 'маршрут', 'тоннел', 'питан', 'канал 04'
      ),
      'fragments', coalesce((
        select jsonb_agg(fragment.value order by fragment.ordinal)
        from jsonb_array_elements(jsonb_build_array(
          '21:43 · Диспетчер: маршрут подтверждён, объект BK-17 ждёт состав.',
          '21:47 · Перед переводом стрелки зафиксирован резкий скачок питания.',
          '21:48 · Автоматика получила служебную команду: «КАНАЛ 04».',
          '21:49 · Машинист: этого ответвления нет в пассажирском расписании.',
          '21:50 · Неизвестный голос: продолжайте движение через Тоннель B.',
          '21:52 · Последняя запись: конечная точка — закрытый Сектор 04.'
        )) with ordinality fragment(value, ordinal)
        where ((fragment.ordinal - 1)::integer % v_wagon_count) = v_wagon_ordinal - 1
      ), '[]'::jsonb)
    );
  elsif p_mission_state = 'MISSION_03' then
    v_requirements := jsonb_build_object(
      'availableItemKeys', coalesce((
        select jsonb_agg(available.item_key order by available.item_key)
        from (
          select distinct item.item_key
          from public.bunker_inventory_lots item
          where item.event_id = p_event_id
            and item.run_nonce = p_run_nonce
            and item.carriage_id = p_carriage_id
            and item.status = 'available'
        ) available
      ), '[]'::jsonb),
      'minItems', 1,
      'maxItems', 3
    );
  elsif p_mission_state = 'MISSION_04' then
    select mission_group.value into v_group
    from jsonb_array_elements(
      coalesce(v_plan#>'{mission04,groups}', '[]'::jsonb)
    ) mission_group(value)
    where exists (
      select 1 from jsonb_array_elements_text(mission_group.value) member(value)
      where member.value = p_carriage_id::text
    )
    limit 1;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', carriage.id,
      'number', carriage.number,
      'label', carriage.label
    ) order by member.ordinal), '[]'::jsonb)
    into v_group_wagons
    from jsonb_array_elements_text(coalesce(v_group, '[]'::jsonb))
      with ordinality member(value, ordinal)
    join public.carriages carriage
      on carriage.id = member.value::uuid and carriage.event_id = p_event_id;

    select coalesce(jsonb_agg(wagon order by (wagon->>'number')::integer), '[]'::jsonb)
    into v_partner_wagons
    from jsonb_array_elements(v_group_wagons) wagon
    where wagon->>'id' <> p_carriage_id::text;

    select count(*)::integer,
      (max(member.ordinal) filter (where member.value = p_carriage_id::text))::integer
    into v_group_count, v_group_ordinal
    from jsonb_array_elements_text(coalesce(v_group, '[]'::jsonb))
      with ordinality member(value, ordinal);
    v_message_fragment := case
      when v_group_count = 2 and v_group_ordinal = 1 then 'СЕКТОР 04 ПРИНИМАЕТ СОСТАВ'
      when v_group_count = 2 then 'ПО ТОННЕЛЮ B ПОСЛЕ ОБМЕНА'
      when v_group_ordinal = 1 then 'СЕКТОР 04'
      when v_group_ordinal = 2 then 'ТОННЕЛЬ B'
      else 'ОБМЕН ПОДТВЕРЖДЁН'
    end;

    v_requirements := jsonb_build_object(
      'groupWagons', v_group_wagons,
      'partnerWagons', v_partner_wagons,
      'messageFragment', v_message_fragment,
      'minLength', 15,
      'requiredIncludes', jsonb_build_array('04'),
      'requiredTerms', jsonb_build_array(
        'тоннел', 'tunnel', 'маршрут', 'канал', 'сектор'
      )
    );
  elsif p_mission_state = 'MISSION_05' then
    v_requirements := jsonb_build_object(
      'routeChoices', jsonb_build_array('safe', 'short'),
      'availableItemKeys', coalesce((
        select jsonb_agg(available.item_key order by available.item_key)
        from (
          select distinct item.item_key
          from public.bunker_inventory_lots item
          where item.event_id = p_event_id
            and item.run_nonce = p_run_nonce
            and item.carriage_id = p_carriage_id
            and item.status = 'available'
        ) available
      ), '[]'::jsonb)
    );
  elsif p_mission_state = 'MISSION_06' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', carriage.id,
      'number', carriage.number,
      'label', carriage.label
    ) order by required.ordinal), '[]'::jsonb)
    into v_required_wagons
    from jsonb_array_elements(coalesce(v_plan->'mission06', '[]'::jsonb)) mission(value)
    cross join lateral jsonb_array_elements_text(
      coalesce(mission.value->'requiredWagonIds', '[]'::jsonb)
    ) with ordinality required(value, ordinal)
    join public.carriages carriage
      on carriage.id = required.value::uuid and carriage.event_id = p_event_id
    where mission.value->>'wagonId' = p_carriage_id::text;

    if v_progress.id is not null then
      select legacy.reward_fragment into v_reward_fragment
      from public.bunker_team_progress legacy
      where legacy.event_id = p_event_id
        and legacy.run_nonce = p_run_nonce
        and legacy.carriage_id = p_carriage_id
        and legacy.stage = 'mission_b';
    end if;

    v_requirements := jsonb_build_object(
      'requiredWagons', v_required_wagons,
      'protocolFragments', coalesce((
        select jsonb_agg(fragment.value order by fragment.ordinal)
        from jsonb_array_elements(jsonb_build_array(
          'ОБЪЕКТ · BK-17',
          'МАРШРУТ · ТОННЕЛЬ B',
          'ТОЧКА · СЕКТОР 04',
          'УРОВЕНЬ ДОСТУПА · 04',
          'АРХИВНАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ · 4719'
        )) with ordinality fragment(value, ordinal)
        where ((fragment.ordinal - 1)::integer % v_wagon_count) = v_wagon_ordinal - 1
      ), '[]'::jsonb),
      'rewardFragment', v_reward_fragment
    );
  end if;

  return jsonb_build_object(
    'missionState', p_mission_state,
    'completed', v_progress.id is not null,
    'completedAt', v_progress.completed_at,
    'submittedPayload', case
      when v_progress.id is null then null else v_progress.submitted_payload
    end,
    'requirements', v_requirements
  );
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
  v_event_id uuid;
  v_guest public.guests%rowtype;
  v_state public.bunker_state%rowtype;
  v_progress public.bunker_global_mission_progress%rowtype;
  v_plan jsonb;
  v_expected_count integer := 0;
  v_selected_count integer := 0;
  v_available_count integer := 0;
  v_chronology text;
  v_message text;
  v_route_choice text;
  v_item_key text;
  v_group jsonb := '[]'::jsonb;
  v_partner_ids jsonb := '[]'::jsonb;
  v_submitted_payload jsonb := '{}'::jsonb;
  v_completed_at timestamptz := clock_timestamp();
begin
  if p_mission_state not in (
    'MISSION_01', 'MISSION_02', 'MISSION_03',
    'MISSION_04', 'MISSION_05', 'MISSION_06'
  ) or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid Bunker global mission payload' using errcode = '22023';
  end if;

  select event.id into v_event_id
  from public.events event
  where event.slug = public._normalize_spaces(p_event_slug);

  select guest.* into v_guest
  from public.guests guest
  where guest.id = public._bunker_guest_id(p_event_slug, p_device_key)
    and guest.event_id = v_event_id;
  if v_event_id is null or v_guest.id is null or v_guest.carriage_id is null then
    raise exception 'guest access required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.carriages carriage
    where carriage.id = v_guest.carriage_id
      and carriage.event_id = v_event_id
      and carriage.enabled
  ) then
    raise exception 'active Bunker wagon required' using errcode = '42501';
  end if;

  select state.* into v_state
  from public.bunker_state state
  where state.event_id = v_event_id
  for update;
  if v_state.event_id is null
    or v_state.status <> 'active'
    or v_state.run_nonce is null
    or v_state.global_game_state <> p_mission_state then
    raise exception 'Bunker global mission is not current' using errcode = '55000';
  end if;

  select progress.* into v_progress
  from public.bunker_global_mission_progress progress
  where progress.event_id = v_event_id
    and progress.run_nonce = v_state.run_nonce
    and progress.carriage_id = v_guest.carriage_id
    and progress.mission_state = p_mission_state;
  if v_progress.id is not null then
    return jsonb_build_object(
      'status', 'completed',
      'missionState', p_mission_state,
      'carriageId', v_guest.carriage_id,
      'completedAt', v_progress.completed_at,
      'changed', false,
      'submittedPayload', v_progress.submitted_payload
    );
  end if;

  select run.plan into v_plan
  from public.bunker_game_runs run
  where run.event_id = v_event_id and run.run_nonce = v_state.run_nonce;

  if p_mission_state = 'MISSION_01' then
    if jsonb_typeof(p_payload->'selectedProfileIds') <> 'array'
      or exists (
        select 1 from jsonb_array_elements_text(p_payload->'selectedProfileIds') selected(value)
        where selected.value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      ) then
      raise exception 'invalid Mission 01 profile selection' using errcode = '22023';
    end if;
    select coalesce((mission.value->>'exclusionCount')::integer, 0)
    into v_expected_count
    from jsonb_array_elements(coalesce(v_plan->'mission01', '[]'::jsonb)) mission(value)
    where mission.value->>'wagonId' = v_guest.carriage_id::text;
    v_expected_count := coalesce(v_expected_count, 0);
    select count(distinct selected.value)::integer into v_selected_count
    from jsonb_array_elements_text(p_payload->'selectedProfileIds') selected(value);
    if v_expected_count < 1
      or v_selected_count <> v_expected_count
      or v_selected_count <> jsonb_array_length(p_payload->'selectedProfileIds')
      or v_selected_count <> (
        select count(*)::integer
        from public.bunker_guest_profiles profile
        join public.guests guest on guest.id = profile.guest_id
        where profile.event_id = v_event_id
          and profile.run_nonce = v_state.run_nonce
          and guest.carriage_id = v_guest.carriage_id
          and profile.character_status <> 'excluded'
          and profile.id in (
            select selected.value::uuid
            from jsonb_array_elements_text(p_payload->'selectedProfileIds') selected(value)
          )
      ) then
      raise exception 'invalid Mission 01 profile selection' using errcode = '22023';
    end if;

    update public.bunker_guest_profiles profile
    set character_status = 'excluded'
    where profile.event_id = v_event_id
      and profile.run_nonce = v_state.run_nonce
      and profile.id in (
        select selected.value::uuid
        from jsonb_array_elements_text(p_payload->'selectedProfileIds') selected(value)
      );
    v_submitted_payload := jsonb_build_object(
      'selectedProfileIds', p_payload->'selectedProfileIds'
    );
  elsif p_mission_state = 'MISSION_02' then
    v_chronology := btrim(coalesce(p_payload->>'chronology', ''));
    if length(v_chronology) < 30
      or lower(v_chronology) !~ '(bk-?17|сектор|маршрут|тоннел|питан|канал 04)' then
      raise exception 'invalid Mission 02 chronology' using errcode = '22023';
    end if;
    v_submitted_payload := jsonb_build_object('chronology', v_chronology);
  elsif p_mission_state = 'MISSION_03' then
    if jsonb_typeof(p_payload->'itemKeys') <> 'array' then
      raise exception 'invalid Mission 03 inventory selection' using errcode = '22023';
    end if;
    select count(distinct selected.value)::integer into v_selected_count
    from jsonb_array_elements_text(p_payload->'itemKeys') selected(value);
    select count(distinct item.item_key)::integer into v_available_count
    from public.bunker_inventory_lots item
    where item.event_id = v_event_id
      and item.run_nonce = v_state.run_nonce
      and item.carriage_id = v_guest.carriage_id
      and item.status = 'available'
      and item.item_key in (
        select selected.value
        from jsonb_array_elements_text(p_payload->'itemKeys') selected(value)
      );
    if v_selected_count not between 1 and 3
      or v_selected_count <> jsonb_array_length(p_payload->'itemKeys')
      or v_available_count <> v_selected_count then
      raise exception 'invalid Mission 03 inventory selection' using errcode = '22023';
    end if;

    update public.bunker_inventory_lots item
    set quantity = case when item.quantity > 1 then item.quantity - 1 else item.quantity end,
        status = case when item.quantity > 1 then 'available' else 'used' end,
        used_at = case when item.quantity > 1 then null else v_completed_at end
    where item.id in (
      select chosen.id
      from (
        select distinct on (candidate.item_key) candidate.id, candidate.item_key
        from public.bunker_inventory_lots candidate
        where candidate.event_id = v_event_id
          and candidate.run_nonce = v_state.run_nonce
          and candidate.carriage_id = v_guest.carriage_id
          and candidate.status = 'available'
          and candidate.item_key in (
            select selected.value
            from jsonb_array_elements_text(p_payload->'itemKeys') selected(value)
          )
        order by candidate.item_key, candidate.acquired_at, candidate.id
      ) chosen
      );
    update public.bunker_wagon_state wagon
    set power_status = case
          when (p_payload->'itemKeys') ? 'generator' then 'stable'
          else power_status
        end,
        communication_status = case
          when (p_payload->'itemKeys') ? 'radio' then 'working'
          else communication_status
        end,
        navigation_status = case
          when (p_payload->'itemKeys') ? 'tools' then 'working'
          else navigation_status
        end,
        technical_door_status = case
          when (p_payload->'itemKeys') ? 'tools' then 'unlocked'
          else technical_door_status
        end,
        water_status = case
          when (p_payload->'itemKeys') ? 'water' then 'limited'
          else water_status
        end,
        power_instability = case
          when (p_payload->'itemKeys') ? 'generator' then greatest(0, power_instability - 1)
          else power_instability
        end,
        updated_at = now()
    where wagon.event_id = v_event_id
      and wagon.run_nonce = v_state.run_nonce
      and wagon.carriage_id = v_guest.carriage_id;
    v_submitted_payload := jsonb_build_object('itemKeys', p_payload->'itemKeys');
  elsif p_mission_state = 'MISSION_04' then
    v_message := btrim(coalesce(p_payload->>'message', ''));
    if length(v_message) < 15
      or v_message !~* '04'
      or lower(v_message) !~ '(тоннел|tunnel|маршрут|канал|сектор)' then
      raise exception 'invalid Mission 04 exchange' using errcode = '22023';
    end if;
    select mission_group.value into v_group
    from jsonb_array_elements(
      coalesce(v_plan#>'{mission04,groups}', '[]'::jsonb)
    ) mission_group(value)
    where exists (
      select 1 from jsonb_array_elements_text(mission_group.value) member(value)
      where member.value = v_guest.carriage_id::text
    )
    limit 1;
    if v_group is null then
      raise exception 'Mission 04 wagon group is missing' using errcode = '55000';
    end if;

    select coalesce(jsonb_agg(member.value order by member.ordinal), '[]'::jsonb)
    into v_partner_ids
    from jsonb_array_elements_text(v_group) with ordinality member(value, ordinal)
    where member.value <> v_guest.carriage_id::text;
    if p_payload ? 'partnerWagonIds' then
      if jsonb_typeof(p_payload->'partnerWagonIds') <> 'array'
        or (select count(distinct supplied.value)
            from jsonb_array_elements_text(p_payload->'partnerWagonIds') supplied(value))
          <> jsonb_array_length(v_partner_ids)
        or exists (
          select 1 from jsonb_array_elements_text(p_payload->'partnerWagonIds') supplied(value)
          where not (v_partner_ids ? supplied.value)
        ) then
        raise exception 'invalid Mission 04 wagon group' using errcode = '22023';
      end if;
    end if;
    update public.bunker_wagon_state wagon
    set communication_status = 'working', coordination_bonus = true, updated_at = now()
    where wagon.event_id = v_event_id
      and wagon.run_nonce = v_state.run_nonce
      and wagon.carriage_id = v_guest.carriage_id;
    v_submitted_payload := jsonb_build_object(
      'message', v_message,
      'partnerWagonIds', v_partner_ids
    );
  elsif p_mission_state = 'MISSION_05' then
    v_route_choice := p_payload->>'routeChoice';
    v_item_key := nullif(btrim(coalesce(p_payload->>'itemKey', '')), '');
    if v_route_choice not in ('safe', 'short') then
      raise exception 'invalid Mission 05 route' using errcode = '22023';
    end if;
    if v_item_key is not null and not exists (
      select 1 from public.bunker_inventory_lots item
      where item.event_id = v_event_id
        and item.run_nonce = v_state.run_nonce
        and item.carriage_id = v_guest.carriage_id
        and item.item_key = v_item_key
        and item.status = 'available'
    ) then
      raise exception 'invalid Mission 05 inventory item' using errcode = '22023';
    end if;
    if v_item_key is not null then
      update public.bunker_inventory_lots item
      set status = 'used', used_at = v_completed_at
      where item.id = (
        select available.id
        from public.bunker_inventory_lots available
        where available.event_id = v_event_id
          and available.run_nonce = v_state.run_nonce
          and available.carriage_id = v_guest.carriage_id
          and available.item_key = v_item_key
          and available.status = 'available'
        order by available.acquired_at, available.id
        limit 1
      );
    end if;
    update public.bunker_wagon_state wagon
    set route_choice = case when v_route_choice = 'safe' then 'A' else 'B' end,
        route_bonus = case when v_route_choice = 'safe' then 2 else 1 end
          + case when v_item_key is null then 0 else 1 end,
        updated_at = now()
    where wagon.event_id = v_event_id
      and wagon.run_nonce = v_state.run_nonce
      and wagon.carriage_id = v_guest.carriage_id;
    v_submitted_payload := jsonb_build_object(
      'routeChoice', v_route_choice,
      'itemKey', v_item_key
    );
  else
    if p_payload->'protocolConfirmed' is distinct from 'true'::jsonb
      or regexp_replace(coalesce(p_payload->>'protocolCode', ''), '[^0-9]', '', 'g') <> '4719' then
      raise exception 'invalid Mission 06 protocol' using errcode = '22023';
    end if;
    perform public._ensure_bunker_team_progress(v_event_id, v_state.run_nonce);
    update public.bunker_team_progress legacy
    set completed_at = coalesce(legacy.completed_at, v_completed_at),
        completed_by_guest_id = coalesce(legacy.completed_by_guest_id, v_guest.id),
        updated_at = now()
    where legacy.event_id = v_event_id
      and legacy.run_nonce = v_state.run_nonce
      and legacy.carriage_id = v_guest.carriage_id
      and legacy.stage = 'mission_b';
    v_submitted_payload := jsonb_build_object(
      'protocolConfirmed', true,
      'protocolCode', '4719'
    );
  end if;

  insert into public.bunker_global_mission_progress(
    event_id, run_nonce, carriage_id, mission_state,
    submitted_payload, completed_at, completed_by_guest_id
  ) values (
    v_event_id, v_state.run_nonce, v_guest.carriage_id, p_mission_state,
    v_submitted_payload, v_completed_at, v_guest.id
  )
  returning * into v_progress;

  insert into public.bunker_game_events(
    event_id, run_nonce, carriage_id, guest_id,
    event_type, actor_type, payload
  ) values (
    v_event_id, v_state.run_nonce, v_guest.carriage_id, v_guest.id,
    'global_mission_completed', 'guest',
    jsonb_build_object(
      'missionState', p_mission_state,
      'submittedPayload', v_submitted_payload
    )
  );

  return jsonb_build_object(
    'status', 'completed',
    'missionState', p_mission_state,
    'carriageId', v_guest.carriage_id,
    'completedAt', v_progress.completed_at,
    'changed', true,
    'submittedPayload', v_progress.submitted_payload
  );
end;
$$;

create or replace function public.owner_force_complete_bunker_global_mission(
  p_event_id uuid,
  p_carriage_id uuid,
  p_mission_state text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.bunker_state%rowtype;
  v_progress public.bunker_global_mission_progress%rowtype;
  v_completed_at timestamptz := clock_timestamp();
  v_changed boolean := false;
begin
  perform public._require_bunker_owner(p_event_id);
  select state.* into v_state
  from public.bunker_state state
  where state.event_id = p_event_id
  for update;
  if v_state.event_id is null
    or v_state.status <> 'active'
    or v_state.run_nonce is null
    or v_state.global_game_state <> p_mission_state
    or p_mission_state not in (
      'MISSION_01', 'MISSION_02', 'MISSION_03',
      'MISSION_04', 'MISSION_05', 'MISSION_06'
    ) then
    raise exception 'Bunker global mission is not current' using errcode = '55000';
  end if;
  if not exists (
    select 1 from public.carriages carriage
    where carriage.id = p_carriage_id
      and carriage.event_id = p_event_id
      and carriage.enabled
  ) then
    raise exception 'active Bunker wagon required' using errcode = '22023';
  end if;

  insert into public.bunker_global_mission_progress(
    event_id, run_nonce, carriage_id, mission_state,
    submitted_payload, completed_at, forced_by_owner
  ) values (
    p_event_id, v_state.run_nonce, p_carriage_id, p_mission_state,
    jsonb_build_object('forced', true), v_completed_at, true
  )
  on conflict (run_nonce, carriage_id, mission_state) do nothing
  returning * into v_progress;

  if v_progress.id is null then
    select progress.* into v_progress
    from public.bunker_global_mission_progress progress
    where progress.run_nonce = v_state.run_nonce
      and progress.carriage_id = p_carriage_id
      and progress.mission_state = p_mission_state;
  else
    v_changed := true;
    if p_mission_state = 'MISSION_06' then
      perform public._ensure_bunker_team_progress(p_event_id, v_state.run_nonce);
      update public.bunker_team_progress legacy
      set completed_at = coalesce(legacy.completed_at, v_completed_at),
          updated_at = now()
      where legacy.event_id = p_event_id
        and legacy.run_nonce = v_state.run_nonce
        and legacy.carriage_id = p_carriage_id
        and legacy.stage = 'mission_b';
    end if;
  end if;

  return jsonb_build_object(
    'status', 'completed',
    'missionState', p_mission_state,
    'carriageId', p_carriage_id,
    'completedAt', v_progress.completed_at,
    'changed', v_changed,
    'submittedPayload', v_progress.submitted_payload
  );
end;
$$;

alter function public.get_guest_bunker_runtime(text, text)
  rename to _get_guest_bunker_runtime_before_global_missions;
revoke all on function public._get_guest_bunker_runtime_before_global_missions(text, text)
  from public, anon, authenticated;

create or replace function public.get_guest_bunker_runtime(
  p_event_slug text,
  p_device_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_event_id uuid;
  v_state text;
begin
  v_result := public._get_guest_bunker_runtime_before_global_missions(
    p_event_slug,
    p_device_key
  );
  if v_result->>'status' <> 'active' then
    return v_result;
  end if;

  select event.id into v_event_id
  from public.events event
  where event.slug = public._normalize_spaces(p_event_slug);
  v_state := v_result#>>'{game,state}';

  return v_result || jsonb_build_object(
    'missionAction', public._bunker_global_mission_action(
      v_event_id,
      (v_result#>>'{game,runNonce}')::uuid,
      (v_result#>>'{wagon,id}')::uuid,
      v_state
    )
  );
end;
$$;

alter function public.get_bunker_screen_state(text)
  rename to _get_bunker_screen_state_before_global_missions;
revoke all on function public._get_bunker_screen_state_before_global_missions(text)
  from public, anon, authenticated;

create or replace function public.get_bunker_screen_state(p_event_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_event_id uuid;
  v_state public.bunker_state%rowtype;
  v_now timestamptz := clock_timestamp();
  v_teams jsonb := '[]'::jsonb;
  v_remaining integer := 0;
  v_duration integer := 0;
begin
  v_result := public._get_bunker_screen_state_before_global_missions(p_event_slug);
  if v_result->>'status' <> 'active' then
    return v_result;
  end if;

  select event.id into v_event_id
  from public.events event
  where event.slug = public._normalize_spaces(p_event_slug);
  select state.* into v_state
  from public.bunker_state state
  where state.event_id = v_event_id;

  select coalesce(jsonb_agg(
    team.value || jsonb_build_object(
      'currentMissionComplete', case
        when v_state.global_game_state in (
          'MISSION_01', 'MISSION_02', 'MISSION_03',
          'MISSION_04', 'MISSION_05', 'MISSION_06'
        ) then exists (
          select 1
          from public.carriages carriage
          join public.bunker_global_mission_progress progress
            on progress.carriage_id = carriage.id
           and progress.event_id = v_event_id
           and progress.run_nonce = v_state.run_nonce
           and progress.mission_state = v_state.global_game_state
          where carriage.event_id = v_event_id
            and carriage.number = (team.value->>'carriageNumber')::integer
        )
        else false
      end
    ) order by team.ordinal
  ), '[]'::jsonb)
  into v_teams
  from jsonb_array_elements(coalesce(v_result->'teams', '[]'::jsonb))
    with ordinality team(value, ordinal);

  if v_state.global_game_state = 'FINAL_30' and v_state.final_started_at is not null then
    v_duration := v_state.final_duration;
    v_remaining := greatest(
      0,
      v_state.final_duration
        - floor(extract(epoch from (v_now - v_state.final_started_at)))::integer
    );
  elsif v_state.global_game_state in ('BUNKER_OPEN', 'FINISHED') then
    v_duration := v_state.final_duration;
    v_remaining := 0;
  else
    v_duration := (v_result->>'durationSeconds')::integer;
    v_remaining := (v_result->>'remainingSeconds')::integer;
  end if;

  return v_result || jsonb_build_object(
    'startedAt', case
      when v_state.global_game_state = 'FINAL_30' and v_state.final_started_at is not null
        then v_state.final_started_at
      else (v_result->>'startedAt')::timestamptz
    end,
    'durationSeconds', v_duration,
    'remainingSeconds', v_remaining,
    'unlocked', v_state.unlocked_at is not null
      or v_state.global_game_state in ('BUNKER_OPEN', 'FINISHED'),
    'teams', v_teams,
    'missionProgress', public._bunker_global_mission_progress_summary(
      v_event_id,
      v_state.run_nonce,
      v_state.global_game_state
    ),
    'serverNow', v_now
  );
end;
$$;

alter function public.owner_get_bunker_control(uuid)
  rename to _owner_get_bunker_control_before_global_missions;
revoke all on function public._owner_get_bunker_control_before_global_missions(uuid)
  from public, anon, authenticated;

create or replace function public.owner_get_bunker_control(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_state public.bunker_state%rowtype;
  v_now timestamptz := clock_timestamp();
  v_remaining integer := 0;
  v_duration integer := 0;
begin
  perform public._require_bunker_owner(p_event_id);
  v_result := public._owner_get_bunker_control_before_global_missions(p_event_id);
  select state.* into v_state
  from public.bunker_state state
  where state.event_id = p_event_id;
  if v_state.event_id is null then
    return v_result;
  end if;

  if v_state.global_game_state = 'FINAL_30' and v_state.final_started_at is not null then
    v_duration := v_state.final_duration;
    v_remaining := greatest(
      0,
      v_state.final_duration
        - floor(extract(epoch from (v_now - v_state.final_started_at)))::integer
    );
  elsif v_state.global_game_state in ('BUNKER_OPEN', 'FINISHED') then
    v_duration := v_state.final_duration;
    v_remaining := 0;
  else
    v_duration := coalesce((v_result->>'durationSeconds')::integer, v_state.duration_seconds);
    v_remaining := coalesce((v_result->>'remainingSeconds')::integer, 0);
  end if;

  return v_result || jsonb_build_object(
    'startedAt', case
      when v_state.global_game_state = 'FINAL_30' and v_state.final_started_at is not null
        then v_state.final_started_at
      else (v_result->>'startedAt')::timestamptz
    end,
    'durationSeconds', v_duration,
    'remainingSeconds', v_remaining,
    'missionProgress', public._bunker_global_mission_progress_summary(
      p_event_id,
      v_state.run_nonce,
      v_state.global_game_state
    ),
    'serverNow', v_now
  );
end;
$$;

alter function public.owner_advance_bunker_game_state(uuid, text)
  rename to _owner_advance_bunker_game_state_before_global_missions;
revoke all on function public._owner_advance_bunker_game_state_before_global_missions(uuid, text)
  from public, anon, authenticated;

create or replace function public.owner_advance_bunker_game_state(
  p_event_id uuid,
  p_next_state text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.bunker_state%rowtype;
  v_summary jsonb;
  v_result jsonb;
begin
  perform public._require_bunker_owner(p_event_id);
  select state.* into v_state
  from public.bunker_state state
  where state.event_id = p_event_id
  for update;

  if v_state.global_game_state in (
    'MISSION_01', 'MISSION_02', 'MISSION_03',
    'MISSION_04', 'MISSION_05', 'MISSION_06'
  ) and p_next_state is distinct from v_state.global_game_state then
    v_summary := public._bunker_global_mission_progress_summary(
      p_event_id,
      v_state.run_nonce,
      v_state.global_game_state
    );
    if coalesce((v_summary->>'complete')::boolean, false) is not true then
      raise exception 'all active wagons must complete %', v_state.global_game_state
        using errcode = '55000';
    end if;
  end if;

  v_result := public._owner_advance_bunker_game_state_before_global_missions(
    p_event_id,
    p_next_state
  );

  if p_next_state = 'BUNKER_OPEN' then
    update public.bunker_state
    set unlocked_at = coalesce(unlocked_at, clock_timestamp()),
        bunker_revealed = true,
        updated_at = now()
    where event_id = p_event_id;
  end if;

  return v_result;
end;
$$;

create or replace function public.submit_guest_bunker_final_code(
  p_event_slug text,
  p_device_key text,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_guest_id uuid;
  v_state public.bunker_state%rowtype;
  v_expected text;
  v_required_count integer := 0;
  v_completed_count integer := 0;
  v_submitted text := regexp_replace(coalesce(p_code, ''), '[^0-9]', '', 'g');
  v_correct boolean := false;
begin
  select event.id into v_event_id
  from public.events event
  where event.slug = public._normalize_spaces(p_event_slug);
  v_guest_id := public._bunker_guest_id(p_event_slug, p_device_key);
  if v_event_id is null or v_guest_id is null then
    raise exception 'guest access required' using errcode = '42501';
  end if;

  select state.* into v_state
  from public.bunker_state state
  where state.event_id = v_event_id
  for update;
  if v_state.event_id is null
    or v_state.status <> 'active'
    or v_state.global_game_state not in ('FINAL_30', 'BUNKER_OPEN') then
    raise exception 'bunker final access is not active' using errcode = '55000';
  end if;
  if v_state.unlocked_at is not null or v_state.global_game_state = 'BUNKER_OPEN' then
    return jsonb_build_object('status', 'unlocked', 'unlocked', true);
  end if;

  if exists (
    select 1
    from public.bunker_final_attempts attempt
    where attempt.event_id = v_event_id
      and attempt.run_nonce = v_state.run_nonce
      and attempt.created_at > clock_timestamp() - interval '2 seconds'
  ) or (
    select count(*)
    from public.bunker_final_attempts attempt
    where attempt.event_id = v_event_id
      and attempt.run_nonce = v_state.run_nonce
      and attempt.guest_id = v_guest_id
      and not attempt.correct
      and attempt.created_at > clock_timestamp() - interval '1 minute'
  ) >= 5 then
    raise exception 'wait before the next Bunker code attempt' using errcode = '55000';
  end if;

  select count(*)::integer into v_required_count
  from public.carriages carriage
  where carriage.event_id = v_event_id and carriage.enabled;

  select count(*)::integer,
    string_agg(progress.reward_fragment, '' order by carriage.sort_order, carriage.number, carriage.id)
  into v_completed_count, v_expected
  from public.bunker_team_progress progress
  join public.carriages carriage on carriage.id = progress.carriage_id
  where progress.event_id = v_event_id
    and progress.run_nonce = v_state.run_nonce
    and progress.stage = 'mission_b'
    and progress.completed_at is not null
    and carriage.enabled;

  if v_completed_count < v_required_count or v_expected is null then
    return jsonb_build_object('status', 'not_ready', 'unlocked', false);
  end if;

  v_correct := v_submitted = v_expected;
  insert into public.bunker_final_attempts(
    event_id, run_nonce, guest_id, submitted_code_hash, correct
  ) values (
    v_event_id,
    v_state.run_nonce,
    v_guest_id,
    encode(extensions.digest(v_submitted, 'sha256'), 'hex'),
    v_correct
  );
  if not v_correct then
    return jsonb_build_object('status', 'incorrect', 'unlocked', false);
  end if;

  update public.bunker_state
  set unlocked_at = coalesce(unlocked_at, clock_timestamp()), updated_at = now()
  where event_id = v_event_id;
  return jsonb_build_object('status', 'unlocked', 'unlocked', true);
end;
$$;

revoke all on function public._bunker_global_mission_progress_summary(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public._bunker_global_mission_action(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.submit_guest_bunker_global_mission(text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.owner_force_complete_bunker_global_mission(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_guest_bunker_runtime(text, text)
  from public, anon, authenticated;
revoke all on function public.get_bunker_screen_state(text)
  from public, anon, authenticated;
revoke all on function public.owner_get_bunker_control(uuid)
  from public, anon, authenticated;
revoke all on function public.owner_advance_bunker_game_state(uuid, text)
  from public, anon, authenticated;
revoke all on function public.submit_guest_bunker_final_code(text, text, text)
  from public, anon, authenticated;

grant execute on function public.submit_guest_bunker_global_mission(text, text, text, jsonb)
  to anon, authenticated;
grant execute on function public.get_guest_bunker_runtime(text, text)
  to anon, authenticated;
grant execute on function public.get_bunker_screen_state(text)
  to anon, authenticated;
grant execute on function public.submit_guest_bunker_final_code(text, text, text)
  to anon, authenticated;
grant execute on function public.owner_force_complete_bunker_global_mission(uuid, uuid, text)
  to authenticated;
grant execute on function public.owner_get_bunker_control(uuid)
  to authenticated;
grant execute on function public.owner_advance_bunker_game_state(uuid, text)
  to authenticated;
