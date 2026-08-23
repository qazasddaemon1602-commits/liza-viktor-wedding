create or replace function public._bunker_ability_action(
  p_ability_key text,
  p_mission_state text
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_expected_mission text;
  v_effect_kind text;
  v_title text := 'СПЕЦИАЛЬНАЯ СПОСОБНОСТЬ';
  v_effect_preview text;
  v_result_copy text;
begin
  v_expected_mission := case
    when p_ability_key in (
      'system_access', 'terminal_hack', 'document_analysis',
      'archive_search', 'visual_memory', 'organize_data'
    ) then 'MISSION_02'
    when p_ability_key in (
      'medical_help', 'stabilize_person', 'power_restore',
      'power_bypass', 'mechanical_fix', 'resource_save',
      'hidden_supply', 'water_treatment', 'chemical_analysis',
      'bio_scan', 'emergency_action', 'hazard_entry'
    ) then 'MISSION_03'
    when p_ability_key in (
      'extra_message', 'clarification', 'trade_bonus'
    ) then 'MISSION_04'
    when p_ability_key in (
      'route_analysis', 'terrain_analysis', 'map_reconstruction',
      'structure_analysis', 'plan_analysis', 'physical_task',
      'dangerous_route', 'route_feel'
    ) then 'MISSION_05'
    when p_ability_key in (
      'weak_signal', 'bunker_knowledge', 'access_protocol',
      'bunker_systems', 'coordinate_analysis', 'gate_timing'
    ) then 'MISSION_06'
    else null
  end;

  if p_mission_state = 'MISSION_01' then
    return jsonb_build_object(
      'applicable', false,
      'code', 'ability_not_applicable',
      'missionState', p_mission_state,
      'title', v_title,
      'effectKind', null,
      'effectPreview',
        'В первом задании способность недоступна: решение о пассажирах принимает весь вагон.'
    );
  end if;

  if v_expected_mission is null then
    return jsonb_build_object(
      'applicable', false,
      'code', 'ability_not_applicable',
      'missionState', p_mission_state,
      'title', v_title,
      'effectKind', null,
      'effectPreview',
        'Эта способность пока не привязана к заданию. Сообщите ведущему; заряд не будет потрачен.'
    );
  end if;

  if p_mission_state is distinct from v_expected_mission then
    return jsonb_build_object(
      'applicable', false,
      'code', 'ability_not_applicable',
      'missionState', p_mission_state,
      'title', v_title,
      'effectKind', null,
      'effectPreview', format(
        'Сейчас способность не применяется. Она станет доступна в задании %s.',
        substring(v_expected_mission from '[0-9]+')::integer
      )
    );
  end if;

  v_effect_kind := case
    when p_ability_key in ('power_restore', 'power_bypass')
      then 'power_stable'
    when p_ability_key = 'mechanical_fix'
      then 'technical_door_unlocked'
    when p_ability_key = 'water_treatment'
      then 'water_stable'
    when p_ability_key in ('extra_message', 'clarification', 'trade_bonus', 'weak_signal')
      then 'communication_boost'
    when p_ability_key in ('map_reconstruction', 'structure_analysis', 'plan_analysis')
      then 'sector_hint'
    when p_ability_key in (
      'route_analysis', 'terrain_analysis', 'physical_task',
      'dangerous_route', 'route_feel'
    ) then 'route_hint'
    else 'mission_clue'
  end;

  v_effect_preview := case v_effect_kind
    when 'power_stable' then
      'Питание вагона станет стабильным, а накопленная нестабильность будет снята.'
    when 'technical_door_unlocked' then
      'Техническая дверь вагона будет разблокирована без расходования инструментов.'
    when 'water_stable' then
      'Состояние воды вагона станет стабильным без расходования запаса.'
    when 'communication_boost' then
      'Связь вагона станет рабочей, а команда получит бонус координации.'
    when 'route_hint' then
      'Вагон получит дополнительную маршрутную подсказку и +1 к бонусу маршрута.'
    when 'sector_hint' then
      'Откроется подсказка о секторе 04, а вагон получит +1 к бонусу маршрута.'
    else
      'После подтверждения откроется персональная подсказка для текущего задания.'
  end;

  v_result_copy := case
    when p_ability_key in ('system_access', 'terminal_hack') then
      'Подсказка: индекс BK-17 появился после скачка питания и связан с перенаправлением маршрута к закрытому объекту.'
    when p_ability_key in (
      'document_analysis', 'archive_search', 'visual_memory', 'organize_data'
    ) then
      'Подсказка: выстройте фрагменты так — скачок питания, смена маршрута, индекс BK-17, канал 04.'
    when p_ability_key in ('medical_help', 'stabilize_person') then
      'Медицинская подсказка: сначала обеспечьте воду и связь; инструменты нужны для безопасного доступа к пострадавшему.'
    when p_ability_key in ('resource_save', 'hidden_supply') then
      'Ресурсная подсказка: сохраните хотя бы один запас воды и один источник питания для дальнейшего маршрута.'
    when p_ability_key in ('chemical_analysis', 'bio_scan') then
      'Аналитическая подсказка: неизвестную среду считайте небезопасной; воду стабилизируйте до открытия технического отсека.'
    when p_ability_key in ('emergency_action', 'hazard_entry') then
      'Аварийная подсказка: безопасный порядок — питание, связь, вода, затем техническая дверь.'
    when p_ability_key in ('bunker_knowledge', 'access_protocol', 'bunker_systems') then
      'Финальная подсказка: протокол объекта использует четыре цифры; сверяйте порядок с фрагментами всех вагонов.'
    when p_ability_key = 'coordinate_analysis' then
      'Координатная подсказка: читайте четыре цифры слева направо в порядке номеров вагонов.'
    when p_ability_key = 'gate_timing' then
      'Подсказка шлюза: код нужно вводить после подтверждения протокола всеми вагонами.'
    else v_effect_preview
  end;

  return jsonb_build_object(
    'applicable', true,
    'code', 'ability_available',
    'missionState', p_mission_state,
    'title', v_title,
    'effectKind', v_effect_kind,
    'effectPreview', v_effect_preview,
    'resultCopy', v_result_copy
  );
end;
$$;

create unique index bunker_character_ability_action_unique
  on public.bunker_game_events(
    run_nonce,
    guest_id,
    (payload->>'clientActionId')
  )
  where event_type = 'character_ability_used';

create or replace function public.use_guest_bunker_ability(
  p_event_slug text,
  p_device_key text,
  p_client_action_id uuid
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
  v_profile public.bunker_guest_profiles%rowtype;
  v_action jsonb;
  v_prior_result jsonb;
  v_resulting_wagon_state jsonb;
  v_remaining integer;
  v_result jsonb;
begin
  if p_client_action_id is null then
    raise exception 'client action id required' using errcode = '22023';
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
    select 1
    from public.carriages carriage
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
    or v_state.run_nonce is null then
    raise exception 'active Bunker run required' using errcode = '55000';
  end if;

  select profile.* into v_profile
  from public.bunker_guest_profiles profile
  where profile.event_id = v_event_id
    and profile.run_nonce = v_state.run_nonce
    and profile.guest_id = v_guest.id
  for update;
  if v_profile.id is null
    or v_profile.special_ability is null then
    raise exception 'Bunker character required' using errcode = '55000';
  end if;

  select game_event.payload->'result' into v_prior_result
  from public.bunker_game_events game_event
  where game_event.event_id = v_event_id
    and game_event.run_nonce = v_state.run_nonce
    and game_event.guest_id = v_guest.id
    and game_event.event_type = 'character_ability_used'
    and game_event.payload->>'clientActionId' = p_client_action_id::text
  order by game_event.id
  limit 1;
  if v_prior_result is not null then
    return v_prior_result || jsonb_build_object(
      'changed', false,
      'idempotent', true
    );
  end if;

  v_action := public._bunker_ability_action(
    v_profile.special_ability,
    v_state.global_game_state
  );
  if not coalesce((v_action->>'applicable')::boolean, false) then
    raise exception 'ability_not_applicable' using errcode = '55000';
  end if;
  if v_profile.ability_uses_remaining < 1 then
    raise exception 'ability already used' using errcode = '55000';
  end if;

  if v_action->>'effectKind' = 'power_stable' then
    update public.bunker_wagon_state wagon
    set power_status = 'stable',
        power_instability = 0,
        updated_at = now()
    where wagon.event_id = v_event_id
      and wagon.run_nonce = v_state.run_nonce
      and wagon.carriage_id = v_guest.carriage_id;
  elsif v_action->>'effectKind' = 'technical_door_unlocked' then
    update public.bunker_wagon_state wagon
    set technical_door_status = 'unlocked',
        updated_at = now()
    where wagon.event_id = v_event_id
      and wagon.run_nonce = v_state.run_nonce
      and wagon.carriage_id = v_guest.carriage_id;
  elsif v_action->>'effectKind' = 'water_stable' then
    update public.bunker_wagon_state wagon
    set water_status = 'stable',
        updated_at = now()
    where wagon.event_id = v_event_id
      and wagon.run_nonce = v_state.run_nonce
      and wagon.carriage_id = v_guest.carriage_id;
  elsif v_action->>'effectKind' = 'communication_boost' then
    update public.bunker_wagon_state wagon
    set communication_status = 'working',
        coordination_bonus = true,
        updated_at = now()
    where wagon.event_id = v_event_id
      and wagon.run_nonce = v_state.run_nonce
      and wagon.carriage_id = v_guest.carriage_id;
  elsif v_action->>'effectKind' = 'route_hint' then
    update public.bunker_wagon_state wagon
    set route_bonus = route_bonus + 1,
        updated_at = now()
    where wagon.event_id = v_event_id
      and wagon.run_nonce = v_state.run_nonce
      and wagon.carriage_id = v_guest.carriage_id;
  elsif v_action->>'effectKind' = 'sector_hint' then
    update public.bunker_wagon_state wagon
    set sector04_found = true,
        route_bonus = route_bonus + 1,
        updated_at = now()
    where wagon.event_id = v_event_id
      and wagon.run_nonce = v_state.run_nonce
      and wagon.carriage_id = v_guest.carriage_id;
  end if;

  select jsonb_build_object(
    'powerStatus', wagon.power_status,
    'communicationStatus', wagon.communication_status,
    'technicalDoorStatus', wagon.technical_door_status,
    'waterStatus', wagon.water_status,
    'routeBonus', wagon.route_bonus,
    'sector04Found', wagon.sector04_found,
    'coordinationBonus', wagon.coordination_bonus
  ) into v_resulting_wagon_state
  from public.bunker_wagon_state wagon
  where wagon.event_id = v_event_id
    and wagon.run_nonce = v_state.run_nonce
    and wagon.carriage_id = v_guest.carriage_id;
  if v_resulting_wagon_state is null then
    raise exception 'Bunker wagon state required' using errcode = '55000';
  end if;

  update public.bunker_guest_profiles profile
  set ability_uses_remaining = profile.ability_uses_remaining - 1,
      ability_used_at = clock_timestamp()
  where profile.id = v_profile.id
  returning profile.ability_uses_remaining into v_remaining;

  v_result := jsonb_build_object(
    'status', 'used',
    'changed', true,
    'idempotent', false,
    'clientActionId', p_client_action_id,
    'missionState', v_state.global_game_state,
    'abilityKey', v_profile.special_ability,
    'effectKind', v_action->>'effectKind',
    'effectPreview', v_action->>'effectPreview',
    'resultCopy', v_action->>'resultCopy',
    'abilityUsesRemaining', v_remaining
  );

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
    v_state.run_nonce,
    v_guest.carriage_id,
    v_guest.id,
    'character_ability_used',
    'guest',
    jsonb_build_object(
      'clientActionId', p_client_action_id,
      'missionState', v_state.global_game_state,
      'abilityKey', v_profile.special_ability,
      'abilityDescription', v_profile.ability_description,
      'effectKind', v_action->>'effectKind',
      'resultingWagonState', v_resulting_wagon_state,
      'result', v_result
    )
  );

  return v_result;
end;
$$;

alter function public.get_guest_bunker_runtime(text, text)
  rename to _get_guest_bunker_runtime_before_character_abilities;
revoke all on function public._get_guest_bunker_runtime_before_character_abilities(text, text)
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
begin
  v_result := public._get_guest_bunker_runtime_before_character_abilities(
    p_event_slug,
    p_device_key
  );
  if v_result->>'status' <> 'active' then
    return v_result;
  end if;

  return jsonb_set(
    v_result,
    '{character,abilityAction}',
    public._bunker_ability_action(
      v_result#>>'{character,specialAbility}',
      v_result#>>'{game,state}'
    ),
    true
  );
end;
$$;

revoke all on function public._bunker_ability_action(text, text)
  from public, anon, authenticated;
revoke all on function public.use_guest_bunker_ability(text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.get_guest_bunker_runtime(text, text)
  from public, anon, authenticated;

grant execute on function public.use_guest_bunker_ability(text, text, uuid)
  to anon, authenticated;
grant execute on function public.get_guest_bunker_runtime(text, text)
  to anon, authenticated;
