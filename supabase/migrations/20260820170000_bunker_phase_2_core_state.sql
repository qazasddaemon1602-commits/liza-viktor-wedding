alter table public.bunker_state
  add column global_game_state text not null default 'LOBBY'
    check (global_game_state in (
      'LOBBY', 'CHARACTERS_READY', 'MISSION_01', 'BREAK', 'MISSION_02',
      'MISSION_03', 'MISSION_04', 'MISSION_05', 'MISSION_06', 'STORY_BUNKER',
      'BREAK_BEFORE_FINAL', 'FINAL_30', 'BUNKER_OPEN', 'FINISHED'
    )),
  add column final_started_at timestamptz,
  add column final_duration integer not null default 1800
    check (final_duration between 60 and 7200),
  add column bunker_revealed boolean not null default false,
  add column game_mode text not null default 'production'
    check (game_mode in ('production', 'test'));

create table public.bunker_character_profiles (
  key text primary key check (key ~ '^[a-z][a-z0-9_]+$'),
  profession text not null unique check (length(btrim(profession)) > 0),
  health text not null check (length(btrim(health)) > 0),
  visible_skill text not null check (length(btrim(visible_skill)) > 0),
  hidden_trait text not null check (length(btrim(hidden_trait)) > 0),
  special_ability text not null check (special_ability ~ '^[a-z][a-z0-9_]+$'),
  ability_description text not null check (length(btrim(ability_description)) > 0),
  tags text[] not null check (cardinality(tags) > 0),
  max_uses smallint not null default 1 check (max_uses between 1 and 2),
  enabled boolean not null default true
);

insert into public.bunker_character_profiles(
  key, profession, health, visible_skill, hidden_trait,
  special_ability, ability_description, tags
)
values
  ('surgeon', 'ХИРУРГ', 'хорошее', 'первая помощь',
   'После серьёзной аварии руки начинают дрожать при сильном стрессе.',
   'medical_help', 'Может один раз решить медицинское событие без аптечки.', array['medicine']),
  ('paramedic', 'ФЕЛЬДШЕР', 'отличное', 'экстренная медицина',
   'Несколько лет работал в спасательной бригаде.',
   'stabilize_person', 'Может стабилизировать пострадавшего и получить от него информацию.', array['medicine','rescue']),
  ('power_engineer', 'ИНЖЕНЕР-ЭНЕРГЕТИК', 'хорошее', 'электросистемы',
   'Знаком с резервными системами питания поездов этого типа.',
   'power_restore', 'Может один раз стабилизировать питание без генератора.', array['engineering','power']),
  ('electrician', 'ЭЛЕКТРИК', 'хорошее', 'диагностика электрики',
   'Может собрать временный источник питания из повреждённого оборудования.',
   'power_bypass', 'Убирает одно последствие отключения энергии.', array['engineering','power']),
  ('mechanic', 'МЕХАНИК', 'отличное', 'ремонт механизмов',
   'Раньше обслуживал железнодорожное оборудование.',
   'mechanical_fix', 'Может открыть технический отсек без расходования инструментов.', array['mechanic','train']),
  ('train_driver', 'МАШИНИСТ', 'хорошее', 'железнодорожные системы',
   'Знает старые резервные маршруты.',
   'route_analysis', 'В задании с маршрутом получает дополнительную техническую информацию.', array['train','navigation']),
  ('geologist', 'ГЕОЛОГ', 'удовлетворительное', 'ориентирование',
   'Работал в районе, через который проходит текущий маршрут.',
   'terrain_analysis', 'Получает дополнительную информацию о тоннелях и грунтах.', array['navigation','terrain']),
  ('cartographer', 'КАРТОГРАФ', 'хорошее', 'чтение карт',
   'Умеет восстанавливать маршруты по неполным схемам.',
   'map_reconstruction', 'Автоматически открывает один отсутствующий элемент карты.', array['navigation','analysis']),
  ('programmer', 'ПРОГРАММИСТ', 'хорошее', 'программные системы',
   'Раньше занимался промышленной автоматизацией.',
   'system_access', 'Даёт дополнительную попытку взаимодействия с терминалом.', array['cyber','systems']),
  ('cybersecurity_specialist', 'СПЕЦИАЛИСТ ПО КИБЕРБЕЗОПАСНОСТИ', 'хорошее', 'анализ сетей',
   'Умеет определять происхождение неизвестных идентификаторов.',
   'terminal_hack', 'Может получить дополнительную информацию о «BK-17».', array['cyber','analysis']),
  ('signal_operator', 'СВЯЗИСТ', 'хорошее', 'радиосвязь',
   'Работал с аварийными каналами связи.',
   'extra_message', 'Добавляет одно сообщение в межвагонном задании.', array['communication']),
  ('radio_amateur', 'РАДИОЛЮБИТЕЛЬ', 'хорошее', 'работа с радиочастотами',
   'Может принимать слабые сигналы, которые штатная система не видит.',
   'weak_signal', 'Открывает дополнительную передачу в финале.', array['communication','radio']),
  ('psychologist', 'ПСИХОЛОГ', 'хорошее', 'переговоры',
   'При сильном эмоциональном стрессе может на короткое время потерять концентрацию.',
   'clarification', 'Даёт один бесплатный запрос уточнения в межвагонной связи.', array['communication','social']),
  ('diplomat', 'ДИПЛОМАТ', 'хорошее', 'переговоры',
   'Работал в международной гуманитарной организации.',
   'trade_bonus', 'Позволяет один раз провести обмен без стандартного ограничения связи.', array['social','trade','communication']),
  ('logistician', 'ЛОГИСТ', 'хорошее', 'управление ресурсами',
   'Умеет рассчитывать минимальные запасы для длительной автономной работы.',
   'resource_save', 'При одном использовании ресурса позволяет сохранить его часть.', array['resources','analysis']),
  ('storekeeper', 'КЛАДОВЩИК', 'удовлетворительное', 'учёт запасов',
   'Перед отправлением заметил контейнер, которого нет в официальной ведомости.',
   'hidden_supply', 'Открывает один дополнительный небольшой ресурс.', array['resources']),
  ('cook', 'ПОВАР', 'хорошее', 'хранение продуктов',
   'По первому образованию — химик-технолог.',
   'water_treatment', 'Позволяет один раз решить проблему воды без расходования всего запаса.', array['resources','chemistry']),
  ('chemist', 'ХИМИК', 'удовлетворительное', 'анализ веществ',
   'Работал с системами очистки воды.',
   'chemical_analysis', 'Может определить безопасность неизвестной жидкости или среды.', array['chemistry','survival','analysis']),
  ('biologist', 'БИОЛОГ', 'хорошее', 'биологический анализ',
   'Специализировался на микроорганизмах в замкнутых системах.',
   'bio_scan', 'Даёт дополнительную информацию при событиях с заражённой средой.', array['biology','survival','analysis']),
  ('rescuer', 'СПАСАТЕЛЬ', 'отличное', 'действия в ЧС',
   'Проходил подготовку по работе в подземных сооружениях.',
   'emergency_action', 'Может отменить одно небольшое негативное последствие аварии.', array['rescue','physical']),
  ('firefighter', 'ПОЖАРНЫЙ', 'отличное', 'эвакуация',
   'Работал с дыхательными системами и аварийными шлюзами.',
   'hazard_entry', 'Позволяет пройти одно опасное событие без расходования противогаза.', array['rescue','hazard']),
  ('builder', 'СТРОИТЕЛЬ', 'отличное', 'конструкции',
   'Участвовал в строительстве подземных технических сооружений.',
   'structure_analysis', 'Может определить безопасный проход на повреждённой схеме.', array['construction','engineering']),
  ('unemployed', 'БЕЗРАБОТНЫЙ', 'отличное', 'физическая подготовка',
   'Раньше работал монтажником на объекте с кодовым названием «Бункер».',
   'bunker_knowledge', 'Узнаёт обозначения Бункера и даёт специальную финальную подсказку.', array['bunker','physical']),
  ('architect', 'АРХИТЕКТОР', 'хорошее', 'чтение чертежей',
   'Однажды работал над проектом объекта с необычной системой подземных коридоров.',
   'plan_analysis', 'Помогает восстановить часть планировки Бункера.', array['bunker','maps','analysis']),
  ('security_guard', 'ОХРАННИК', 'отличное', 'безопасность',
   'Раньше работал на режимном объекте.',
   'access_protocol', 'Может определить тип служебного пропуска.', array['security','bunker']),
  ('lawyer', 'ЮРИСТ', 'хорошее', 'анализ документов',
   'Очень внимателен к формулировкам и служебным кодам.',
   'document_analysis', 'Автоматически отмечает противоречие в одном документе.', array['analysis']),
  ('journalist', 'ЖУРНАЛИСТ', 'хорошее', 'поиск информации',
   'До эвакуации расследовал строительство закрытых государственных объектов.',
   'archive_search', 'Открывает дополнительный архивный фрагмент.', array['analysis','bunker']),
  ('photographer', 'ФОТОГРАФ', 'хорошее', 'визуальная память',
   'Очень хорошо запоминает мелкие детали изображений.',
   'visual_memory', 'Даёт бонус в заданиях на запоминание схем и символов.', array['memory']),
  ('teacher', 'ПРЕПОДАВАТЕЛЬ', 'хорошее', 'систематизация информации',
   'Привык быстро превращать хаотичные данные в понятную структуру.',
   'organize_data', 'Визуально группирует одну сложную совокупность подсказок.', array['analysis']),
  ('student', 'СТУДЕНТ', 'отличное', 'отсутствует',
   'Учится на специалиста по информационной безопасности.',
   'terminal_hack', 'Даёт дополнительную попытку доступа к терминалу.', array['cyber']),
  ('athlete', 'СПОРТСМЕН', 'отличное', 'физическая выносливость',
   'Имеет опыт спортивного ориентирования.',
   'physical_task', 'Может решить одно физическое препятствие без использования инструмента.', array['physical','navigation']),
  ('climber', 'АЛЬПИНИСТ', 'отличное', 'работа в опасной среде',
   'Умеет перемещаться по разрушенным конструкциям.',
   'dangerous_route', 'Снижает последствия одного опасного маршрута.', array['physical','survival']),
  ('driver', 'ВОДИТЕЛЬ', 'хорошее', 'оценка маршрутов',
   'Много лет работал на тяжёлой технике.',
   'route_feel', 'Даёт дополнительную информацию в «Одном шансе».', array['transport','navigation']),
  ('military_engineer', 'ВОЕННЫЙ ИНЖЕНЕР', 'хорошее', 'инженерные системы',
   'Имеет опыт работы с защищёнными подземными сооружениями.',
   'bunker_systems', 'Может определить назначение одного технического элемента Бункера.', array['bunker','engineering']),
  ('astronomer', 'АСТРОНОМ', 'удовлетворительное', 'работа с координатами',
   'Отлично ориентируется в системах координат и времени.',
   'coordinate_analysis', 'В финале помогает восстановить часть координат.', array['coordinates','analysis']),
  ('watchmaker', 'ЧАСОВЩИК', 'удовлетворительное', 'точные механизмы',
   'Раньше ремонтировал промышленные таймеры и электромеханические замки.',
   'gate_timing', 'Даёт дополнительную информацию о времени открытия шлюза.', array['time','mechanic']);

alter table public.bunker_guest_profiles
  drop constraint if exists bunker_guest_profiles_ability_tags_valid;

alter table public.bunker_guest_profiles
  add constraint bunker_guest_profiles_ability_tags_valid
    check (cardinality(ability_tags) > 0);

alter table public.bunker_guest_profiles
  add column character_profile_key text references public.bunker_character_profiles(key) on delete restrict,
  add column visible_skill text,
  add column special_ability text,
  add column ability_description text,
  add column character_status text not null default 'active'
    check (character_status in ('active', 'saved', 'excluded')),
  add column hidden_trait_revealed boolean not null default false,
  add column ability_uses_remaining smallint not null default 1
    check (ability_uses_remaining between 0 and 2),
  add column ability_used_at timestamptz,
  add column joined_late boolean not null default false,
  add column assigned_at timestamptz not null default now();

create table public.bunker_wagon_state (
  event_id uuid not null references public.events(id) on delete cascade,
  run_nonce uuid not null,
  carriage_id uuid not null references public.carriages(id) on delete cascade,
  power_status text not null default 'unstable'
    check (power_status in ('stable', 'unstable', 'offline')),
  communication_status text not null default 'working'
    check (communication_status in ('working', 'degraded', 'offline')),
  navigation_status text not null default 'working'
    check (navigation_status in ('working', 'degraded', 'offline')),
  technical_door_status text not null default 'locked'
    check (technical_door_status in ('locked', 'unlocked', 'damaged')),
  track_damage integer not null default 0 check (track_damage between 0 and 100),
  water_status text not null default 'stable'
    check (water_status in ('stable', 'limited', 'contaminated', 'empty')),
  route_choice text check (route_choice is null or route_choice in ('A', 'B')),
  route_bonus integer not null default 0,
  power_instability integer not null default 0 check (power_instability >= 0),
  sector04_found boolean not null default false,
  coordination_bonus boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (run_nonce, carriage_id),
  foreign key (event_id, run_nonce)
    references public.bunker_game_runs(event_id, run_nonce) on delete cascade
);

create table public.bunker_inventory_lots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  run_nonce uuid not null,
  carriage_id uuid not null references public.carriages(id) on delete cascade,
  item_key text not null check (item_key ~ '^[a-z][a-z0-9_]+$'),
  quantity integer not null check (quantity > 0),
  status text not null default 'available'
    check (status in ('available', 'used', 'transferred', 'lost')),
  acquired_at timestamptz not null default now(),
  used_at timestamptz,
  transferred_to uuid references public.carriages(id) on delete restrict,
  source_lot_id uuid references public.bunker_inventory_lots(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  foreign key (event_id, run_nonce)
    references public.bunker_game_runs(event_id, run_nonce) on delete cascade,
  check ((status = 'used') = (used_at is not null)),
  check ((status = 'transferred') = (transferred_to is not null))
);

create index bunker_inventory_available_idx
  on public.bunker_inventory_lots(run_nonce, carriage_id, item_key)
  where status = 'available';

create table public.bunker_archive_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  run_nonce uuid not null,
  carriage_id uuid references public.carriages(id) on delete cascade,
  artifact_key text not null check (artifact_key ~ '^[A-Za-z0-9_-]+$'),
  content_type text not null
    check (content_type in ('text', 'image', 'map', 'audio', 'document', 'code')),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  decryption_status text not null default 'locked'
    check (decryption_status in ('locked', 'partial', 'decoded')),
  acquired_at timestamptz not null default now(),
  decoded_at timestamptz,
  foreign key (event_id, run_nonce)
    references public.bunker_game_runs(event_id, run_nonce) on delete cascade,
  check ((decryption_status = 'decoded') = (decoded_at is not null))
);

create unique index bunker_archive_wagon_artifact_unique
  on public.bunker_archive_entries(run_nonce, carriage_id, artifact_key)
  where carriage_id is not null;
create unique index bunker_archive_global_artifact_unique
  on public.bunker_archive_entries(run_nonce, artifact_key)
  where carriage_id is null;

create table public.bunker_game_events (
  id bigint generated by default as identity primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  run_nonce uuid not null,
  carriage_id uuid references public.carriages(id) on delete set null,
  guest_id uuid references public.guests(id) on delete set null,
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_]+$'),
  actor_type text not null default 'system'
    check (actor_type in ('system', 'owner', 'guest')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  foreign key (event_id, run_nonce)
    references public.bunker_game_runs(event_id, run_nonce) on delete cascade
);

create index bunker_game_events_run_time_idx
  on public.bunker_game_events(run_nonce, created_at, id);
create index bunker_game_events_wagon_time_idx
  on public.bunker_game_events(run_nonce, carriage_id, created_at, id);

alter table public.bunker_character_profiles enable row level security;
alter table public.bunker_wagon_state enable row level security;
alter table public.bunker_inventory_lots enable row level security;
alter table public.bunker_archive_entries enable row level security;
alter table public.bunker_game_events enable row level security;

revoke all on table public.bunker_character_profiles from public, anon, authenticated;
revoke all on table public.bunker_wagon_state from public, anon, authenticated;
revoke all on table public.bunker_inventory_lots from public, anon, authenticated;
revoke all on table public.bunker_archive_entries from public, anon, authenticated;
revoke all on table public.bunker_game_events from public, anon, authenticated;

create or replace function public.owner_prepare_bunker_game(
  p_event_id uuid,
  p_game_mode text default 'production'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state public.bunker_state%rowtype;
  v_run_nonce uuid;
  v_wagon_count integer;
  v_guest_count integer;
  v_preserving_ready_run boolean := false;
  v_return_state text := 'LOBBY';
begin
  perform public._require_bunker_owner(p_event_id);
  if p_game_mode not in ('production', 'test') then
    raise exception 'invalid Bunker game mode' using errcode = '22023';
  end if;

  perform 1 from public.events e
  where e.id = p_event_id and e.owner_user_id = auth.uid()
  for update;

  select count(*)::integer into v_wagon_count
  from public.carriages c where c.event_id = p_event_id and c.enabled;
  if v_wagon_count not between 2 and 5 then
    raise exception 'Bunker requires between two and five active wagons' using errcode = '55000';
  end if;

  select count(*)::integer into v_guest_count
  from public.guests g where g.event_id = p_event_id;

  select b.* into v_state
  from public.bunker_state b where b.event_id = p_event_id
  for update;

  if v_state.status = 'active' and v_state.global_game_state in ('FINAL_30', 'BUNKER_OPEN') then
    raise exception 'cannot prepare another game during active final' using errcode = '55000';
  end if;

  if v_state.run_nonce is not null
    and v_state.global_game_state in ('LOBBY', 'CHARACTERS_READY') then
    v_run_nonce := v_state.run_nonce;
    v_preserving_ready_run := v_state.global_game_state = 'CHARACTERS_READY';
    v_return_state := v_state.global_game_state;
  else
    v_run_nonce := gen_random_uuid();
  end if;

  insert into public.bunker_state(
    event_id, status, phase, run_nonce, global_game_state, game_mode,
    started_at, phase_started_at, final_started_at, unlocked_at,
    bunker_revealed, updated_at
  )
  values (
    p_event_id, 'idle', 'emergency', v_run_nonce, 'LOBBY', p_game_mode,
    null, null, null, null, false, now()
  )
  on conflict (event_id) do update
  set status = 'idle',
      phase = 'emergency',
      run_nonce = v_run_nonce,
      global_game_state = case
        when bunker_state.run_nonce = v_run_nonce then bunker_state.global_game_state
        else 'LOBBY'
      end,
      game_mode = p_game_mode,
      started_at = null,
      phase_started_at = null,
      final_started_at = null,
      unlocked_at = null,
      bunker_revealed = false,
      updated_at = now();

  if not v_preserving_ready_run then
    perform public._create_bunker_game_plan(p_event_id, v_run_nonce);
  end if;

  insert into public.bunker_wagon_state(event_id, run_nonce, carriage_id)
  select p_event_id, v_run_nonce, c.id
  from public.carriages c
  where c.event_id = p_event_id and c.enabled
  on conflict (run_nonce, carriage_id) do nothing;

  insert into public.bunker_inventory_lots(
    event_id, run_nonce, carriage_id, item_key, quantity
  )
  select p_event_id, v_run_nonce, c.id, seed.item_key, seed.quantity
  from public.carriages c
  cross join (values
    ('medkit', 1), ('radio', 1), ('generator', 1),
    ('tools', 1), ('water', 2), ('gas_mask', 1)
  ) as seed(item_key, quantity)
  where c.event_id = p_event_id
    and c.enabled
    and not exists (
      select 1 from public.bunker_inventory_lots existing
      where existing.run_nonce = v_run_nonce
        and existing.carriage_id = c.id
        and existing.item_key = seed.item_key
    );

  if not exists (
    select 1 from public.bunker_game_events ge
    where ge.run_nonce = v_run_nonce and ge.event_type = 'game_session_prepared'
  ) then
    insert into public.bunker_game_events(
      event_id, run_nonce, event_type, actor_type, payload
    ) values (
      p_event_id, v_run_nonce, 'game_session_prepared', 'owner',
      jsonb_build_object(
        'gameMode', p_game_mode,
        'wagonCount', v_wagon_count,
        'guestCount', v_guest_count
      )
    );
  end if;

  return jsonb_build_object(
    'status', 'prepared',
    'eventId', p_event_id,
    'runNonce', v_run_nonce,
    'globalGameState', v_return_state,
    'gameMode', p_game_mode,
    'wagonCount', v_wagon_count,
    'guestCount', v_guest_count
  );
end;
$$;

create or replace function public.owner_distribute_bunker_characters(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state public.bunker_state%rowtype;
  v_guest_count integer;
  v_wagon_count integer;
  v_assigned_count integer;
  v_technical_target integer := 1;
  v_medical_target integer := 1;
  v_communication_target integer := 1;
  v_analytical_target integer := 0;
  v_profile_keys text[];
  v_profile_key text;
  v_guest record;
begin
  perform public._require_bunker_owner(p_event_id);

  select b.* into v_state
  from public.bunker_state b where b.event_id = p_event_id
  for update;
  if v_state.run_nonce is null or v_state.global_game_state not in ('LOBBY', 'CHARACTERS_READY') then
    raise exception 'Bunker game must be prepared before character distribution' using errcode = '55000';
  end if;

  select count(*)::integer into v_guest_count
  from public.guests g where g.event_id = p_event_id;
  select count(*)::integer into v_wagon_count
  from public.carriages c where c.event_id = p_event_id and c.enabled;

  if v_guest_count between 15 and 20 then
    v_technical_target := 2;
    v_medical_target := case when v_guest_count >= 18 then 2 else 1 end;
    v_communication_target := 2;
    v_analytical_target := 2;
  end if;

  with
  technical as (
    select p.key, 10 as category_order,
      row_number() over (order by md5(v_state.run_nonce::text || ':technical:' || p.key)) as item_order
    from public.bunker_character_profiles p
    where p.enabled and p.key in ('power_engineer','electrician','mechanic','military_engineer')
    order by md5(v_state.run_nonce::text || ':technical:' || p.key)
    limit v_technical_target
  ),
  medical as (
    select p.key, 20 as category_order,
      row_number() over (order by md5(v_state.run_nonce::text || ':medical:' || p.key)) as item_order
    from public.bunker_character_profiles p
    where p.enabled and 'medicine' = any(p.tags)
    order by md5(v_state.run_nonce::text || ':medical:' || p.key)
    limit v_medical_target
  ),
  information as (
    select p.key, 30 as category_order,
      row_number() over (order by md5(v_state.run_nonce::text || ':information:' || p.key)) as item_order
    from public.bunker_character_profiles p
    where p.enabled and p.key in ('cybersecurity_specialist','programmer','student')
    order by md5(v_state.run_nonce::text || ':information:' || p.key)
    limit 1
  ),
  communication as (
    select p.key, 40 as category_order,
      row_number() over (order by md5(v_state.run_nonce::text || ':communication:' || p.key)) as item_order
    from public.bunker_character_profiles p
    where p.enabled and p.key in ('signal_operator','radio_amateur','diplomat','psychologist')
    order by md5(v_state.run_nonce::text || ':communication:' || p.key)
    limit v_communication_target
  ),
  bunker_knowledge as (
    select p.key, 50 as category_order, 1::bigint as item_order
    from public.bunker_character_profiles p
    where p.enabled and p.special_ability = 'bunker_knowledge'
    limit 1
  ),
  navigation as (
    select p.key, 60 as category_order,
      row_number() over (order by md5(v_state.run_nonce::text || ':navigation:' || p.key)) as item_order
    from public.bunker_character_profiles p
    where p.enabled and p.key in ('geologist','cartographer','train_driver','driver')
    order by md5(v_state.run_nonce::text || ':navigation:' || p.key)
    limit 1
  ),
  analytical as (
    select p.key, 70 as category_order,
      row_number() over (order by md5(v_state.run_nonce::text || ':analytical:' || p.key)) as item_order
    from public.bunker_character_profiles p
    where p.enabled
      and p.key in ('lawyer','teacher','photographer','astronomer','logistician','chemist','biologist')
    order by md5(v_state.run_nonce::text || ':analytical:' || p.key)
    limit v_analytical_target
  ),
  required as (
    select * from technical union all select * from medical
    union all select * from information union all select * from communication
    union all select * from bunker_knowledge union all select * from navigation
    union all select * from analytical
  ),
  remaining as (
    select p.key, 100 as category_order,
      row_number() over (order by md5(v_state.run_nonce::text || ':random:' || p.key)) as item_order
    from public.bunker_character_profiles p
    where p.enabled and not exists (select 1 from required r where r.key = p.key)
  ),
  ordered as (
    select * from required union all select * from remaining
  )
  select array_agg(key order by category_order, item_order)
  into v_profile_keys
  from ordered;

  if cardinality(v_profile_keys) < 6 then
    raise exception 'character pool cannot cover mandatory abilities' using errcode = '55000';
  end if;

  for v_guest in
    select
      g.id,
      row_number() over (
        order by md5(v_state.run_nonce::text || ':guest:' || g.id::text)
      ) as ordinal
    from public.guests g
    where g.event_id = p_event_id
  loop
    v_profile_key := v_profile_keys[
      1 + mod(v_guest.ordinal - 1, cardinality(v_profile_keys))::integer
    ];

    insert into public.bunker_guest_profiles(
      event_id, run_nonce, guest_id,
      profession, profile, health, hobby, baggage, hidden_fact, ability_tags,
      character_profile_key, visible_skill, special_ability, ability_description,
      character_status, hidden_trait_revealed, ability_uses_remaining,
      joined_late, assigned_at
    )
    select
      p_event_id, v_state.run_nonce, v_guest.id,
      p.profession, 'ПАССАЖИР СОСТАВА', p.health, p.visible_skill,
      'НЕТ ДАННЫХ', p.hidden_trait, p.tags,
      p.key, p.visible_skill, p.special_ability, p.ability_description,
      'active', false, p.max_uses, false, now()
    from public.bunker_character_profiles p
    where p.key = v_profile_key
    on conflict (run_nonce, guest_id) do nothing;
  end loop;

  select count(*)::integer into v_assigned_count
  from public.bunker_guest_profiles p
  where p.event_id = p_event_id and p.run_nonce = v_state.run_nonce;

  update public.bunker_state
  set global_game_state = 'CHARACTERS_READY', updated_at = now()
  where event_id = p_event_id;

  if not exists (
    select 1 from public.bunker_game_events ge
    where ge.run_nonce = v_state.run_nonce and ge.event_type = 'characters_distributed'
  ) then
    insert into public.bunker_game_events(
      event_id, run_nonce, event_type, actor_type, payload
    ) values (
      p_event_id, v_state.run_nonce, 'characters_distributed', 'owner',
      jsonb_build_object('assignedCount', v_assigned_count, 'wagonCount', v_wagon_count)
    );
  end if;

  return jsonb_build_object(
    'status', 'characters_ready',
    'runNonce', v_state.run_nonce,
    'globalGameState', 'CHARACTERS_READY',
    'assignedCount', v_assigned_count,
    'wagonCount', v_wagon_count
  );
end;
$$;

create or replace function public._assign_late_bunker_guest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state public.bunker_state%rowtype;
  v_profile public.bunker_character_profiles%rowtype;
begin
  select b.* into v_state
  from public.bunker_state b
  where b.event_id = new.event_id
  for update;

  if v_state.run_nonce is null
    or v_state.global_game_state in ('LOBBY', 'FINISHED') then
    return new;
  end if;

  select candidate.* into v_profile
  from public.bunker_character_profiles candidate
  left join lateral (
    select count(*)::integer as usage_count
    from public.bunker_guest_profiles assigned
    where assigned.run_nonce = v_state.run_nonce
      and assigned.character_profile_key = candidate.key
  ) usage on true
  where candidate.enabled
  order by usage.usage_count,
    md5(v_state.run_nonce::text || ':late:' || new.id::text || ':' || candidate.key)
  limit 1;

  if v_profile.key is null then
    raise exception 'enabled Bunker character profile required' using errcode = '55000';
  end if;

  insert into public.bunker_guest_profiles(
    event_id, run_nonce, guest_id,
    profession, profile, health, hobby, baggage, hidden_fact, ability_tags,
    character_profile_key, visible_skill, special_ability, ability_description,
    character_status, hidden_trait_revealed, ability_uses_remaining,
    joined_late, assigned_at
  ) values (
    new.event_id, v_state.run_nonce, new.id,
    v_profile.profession, 'ПАССАЖИР СОСТАВА', v_profile.health,
    v_profile.visible_skill, 'НЕТ ДАННЫХ', v_profile.hidden_trait, v_profile.tags,
    v_profile.key, v_profile.visible_skill, v_profile.special_ability,
    v_profile.ability_description, 'active', false, v_profile.max_uses,
    true, now()
  ) on conflict (run_nonce, guest_id) do nothing;

  insert into public.bunker_game_events(
    event_id, run_nonce, carriage_id, guest_id,
    event_type, actor_type, payload
  ) values (
    new.event_id, v_state.run_nonce, new.carriage_id, new.id,
    'late_guest_joined', 'system',
    jsonb_build_object(
      'characterProfileKey', v_profile.key,
      'globalGameState', v_state.global_game_state
    )
  );

  return new;
end;
$$;

create trigger assign_late_bunker_guest
after insert on public.guests
for each row execute function public._assign_late_bunker_guest();

create or replace function public.get_guest_bunker_runtime(
  p_event_slug text,
  p_device_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_guest public.guests%rowtype;
  v_wagon public.carriages%rowtype;
  v_state public.bunker_state%rowtype;
  v_character public.bunker_guest_profiles%rowtype;
  v_wagon_state public.bunker_wagon_state%rowtype;
  v_passengers jsonb := '[]'::jsonb;
  v_inventory jsonb := '[]'::jsonb;
  v_archive jsonb := '[]'::jsonb;
  v_now timestamptz := clock_timestamp();
begin
  select e.id into v_event_id
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug);
  if v_event_id is null then
    return jsonb_build_object('status', 'not_found', 'serverNow', v_now);
  end if;

  select g.* into v_guest
  from public.guests g
  where g.id = public._bunker_guest_id(p_event_slug, p_device_key)
    and g.event_id = v_event_id;
  if v_guest.id is null then
    return jsonb_build_object('status', 'guest_not_found', 'serverNow', v_now);
  end if;

  select b.* into v_state from public.bunker_state b where b.event_id = v_event_id;
  if v_state.run_nonce is null or v_state.global_game_state = 'LOBBY' then
    return jsonb_build_object('status', 'idle', 'serverNow', v_now);
  end if;

  select c.* into v_wagon
  from public.carriages c where c.id = v_guest.carriage_id and c.event_id = v_event_id;
  select p.* into v_character
  from public.bunker_guest_profiles p
  where p.run_nonce = v_state.run_nonce and p.guest_id = v_guest.id;
  select ws.* into v_wagon_state
  from public.bunker_wagon_state ws
  where ws.run_nonce = v_state.run_nonce and ws.carriage_id = v_guest.carriage_id;

  if v_character.guest_id is null or v_wagon_state.carriage_id is null then
    raise exception 'Bunker runtime is incomplete for registered guest' using errcode = '55000';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'guestId', team.guest_id,
    'realName', team.first_name || ' ' || upper(left(team.last_name, 1)) || '.',
    'profession', team.profession,
    'visibleSkill', team.visible_skill,
    'hiddenTrait', case when team.hidden_trait_revealed then team.hidden_fact else null end,
    'hiddenTraitRevealed', team.hidden_trait_revealed,
    'characterStatus', team.character_status
  ) order by team.registered_at, team.guest_id), '[]'::jsonb)
  into v_passengers
  from (
    select g.id as guest_id, g.first_name, g.last_name, g.registered_at,
      p.profession, p.visible_skill, p.hidden_fact,
      p.hidden_trait_revealed, p.character_status
    from public.guests g
    join public.bunker_guest_profiles p
      on p.guest_id = g.id and p.run_nonce = v_state.run_nonce
    where g.event_id = v_event_id and g.carriage_id = v_guest.carriage_id
  ) team;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', item.id, 'itemKey', item.item_key, 'quantity', item.quantity,
    'status', item.status, 'acquiredAt', item.acquired_at,
    'usedAt', item.used_at, 'transferredTo', item.transferred_to
  ) order by item.acquired_at, item.id), '[]'::jsonb)
  into v_inventory
  from public.bunker_inventory_lots item
  where item.run_nonce = v_state.run_nonce and item.carriage_id = v_guest.carriage_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', artifact.id, 'artifactKey', artifact.artifact_key,
    'contentType', artifact.content_type, 'content', artifact.content,
    'decryptionStatus', artifact.decryption_status,
    'acquiredAt', artifact.acquired_at, 'decodedAt', artifact.decoded_at,
    'scope', case when artifact.carriage_id is null then 'global' else 'wagon' end
  ) order by artifact.acquired_at, artifact.id), '[]'::jsonb)
  into v_archive
  from public.bunker_archive_entries artifact
  where artifact.run_nonce = v_state.run_nonce
    and (artifact.carriage_id is null or artifact.carriage_id = v_guest.carriage_id);

  return jsonb_build_object(
    'status', 'active', 'serverNow', v_now,
    'game', jsonb_build_object(
      'runNonce', v_state.run_nonce, 'state', v_state.global_game_state,
      'mode', v_state.game_mode, 'finalStartedAt', v_state.final_started_at,
      'finalDuration', v_state.final_duration, 'bunkerRevealed', v_state.bunker_revealed
    ),
    'guest', jsonb_build_object(
      'id', v_guest.id,
      'realName', v_guest.first_name || ' ' || upper(left(v_guest.last_name, 1)) || '.',
      'joinedLate', v_character.joined_late
    ),
    'wagon', jsonb_build_object(
      'id', v_wagon.id, 'number', v_wagon.number, 'label', v_wagon.label
    ),
    'character', jsonb_build_object(
      'profession', v_character.profession, 'health', v_character.health,
      'visibleSkill', v_character.visible_skill,
      'hiddenTrait', case when v_character.hidden_trait_revealed then v_character.hidden_fact else null end,
      'hiddenTraitRevealed', v_character.hidden_trait_revealed,
      'specialAbility', v_character.special_ability,
      'abilityDescription', v_character.ability_description,
      'abilityUsesRemaining', v_character.ability_uses_remaining,
      'status', v_character.character_status
    ),
    'passengers', v_passengers, 'inventory', v_inventory, 'archive', v_archive,
    'wagonState', jsonb_build_object(
      'powerStatus', v_wagon_state.power_status,
      'communicationStatus', v_wagon_state.communication_status,
      'navigationStatus', v_wagon_state.navigation_status,
      'technicalDoorStatus', v_wagon_state.technical_door_status,
      'trackDamage', v_wagon_state.track_damage,
      'waterStatus', v_wagon_state.water_status,
      'routeChoice', v_wagon_state.route_choice,
      'routeBonus', v_wagon_state.route_bonus,
      'powerInstability', v_wagon_state.power_instability,
      'sector04Found', v_wagon_state.sector04_found,
      'coordinationBonus', v_wagon_state.coordination_bonus
    ),
    'currentMission', null
  );
end;
$$;

revoke all on function public.owner_prepare_bunker_game(uuid, text) from public, anon;
revoke all on function public.owner_distribute_bunker_characters(uuid) from public, anon;
revoke all on function public._assign_late_bunker_guest() from public, anon, authenticated;
revoke all on function public.get_guest_bunker_runtime(text, text) from public, authenticated;
grant execute on function public.owner_prepare_bunker_game(uuid, text) to authenticated;
grant execute on function public.owner_distribute_bunker_characters(uuid) to authenticated;
grant execute on function public.get_guest_bunker_runtime(text, text) to anon, authenticated;
