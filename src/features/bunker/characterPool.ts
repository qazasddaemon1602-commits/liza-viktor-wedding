export type BunkerCharacterProfile = {
  key: string;
  profession: string;
  health: string;
  visibleSkill: string;
  hiddenTrait: string;
  specialAbility: string;
  abilityDescription: string;
  tags: readonly string[];
};

function profile(
  key: string,
  profession: string,
  health: string,
  visibleSkill: string,
  hiddenTrait: string,
  specialAbility: string,
  abilityDescription: string,
  tags: readonly string[],
): BunkerCharacterProfile {
  return {
    key,
    profession,
    health,
    visibleSkill,
    hiddenTrait,
    specialAbility,
    abilityDescription,
    tags,
  };
}

export const BUNKER_CHARACTER_PROFILES: readonly BunkerCharacterProfile[] = [
  profile('surgeon', 'ХИРУРГ', 'хорошее', 'первая помощь',
    'После серьёзной аварии руки начинают дрожать при сильном стрессе.',
    'medical_help', 'Может один раз решить медицинское событие без аптечки.', ['medicine']),
  profile('paramedic', 'ФЕЛЬДШЕР', 'отличное', 'экстренная медицина',
    'Несколько лет работал в спасательной бригаде.',
    'stabilize_person', 'Может стабилизировать пострадавшего и получить от него информацию.', ['medicine', 'rescue']),
  profile('power_engineer', 'ИНЖЕНЕР-ЭНЕРГЕТИК', 'хорошее', 'электросистемы',
    'Знаком с резервными системами питания поездов этого типа.',
    'power_restore', 'Может один раз стабилизировать питание без генератора.', ['engineering', 'power']),
  profile('electrician', 'ЭЛЕКТРИК', 'хорошее', 'диагностика электрики',
    'Может собрать временный источник питания из повреждённого оборудования.',
    'power_bypass', 'Убирает одно последствие отключения энергии.', ['engineering', 'power']),
  profile('mechanic', 'МЕХАНИК', 'отличное', 'ремонт механизмов',
    'Раньше обслуживал железнодорожное оборудование.',
    'mechanical_fix', 'Может открыть технический отсек без расходования инструментов.', ['mechanic', 'train']),
  profile('train_driver', 'МАШИНИСТ', 'хорошее', 'железнодорожные системы',
    'Знает старые резервные маршруты.',
    'route_analysis', 'В задании с маршрутом получает дополнительную техническую информацию.', ['train', 'navigation']),
  profile('geologist', 'ГЕОЛОГ', 'удовлетворительное', 'ориентирование',
    'Работал в районе, через который проходит текущий маршрут.',
    'terrain_analysis', 'Получает дополнительную информацию о тоннелях и грунтах.', ['navigation', 'terrain']),
  profile('cartographer', 'КАРТОГРАФ', 'хорошее', 'чтение карт',
    'Умеет восстанавливать маршруты по неполным схемам.',
    'map_reconstruction', 'Автоматически открывает один отсутствующий элемент карты.', ['navigation', 'analysis']),
  profile('programmer', 'ПРОГРАММИСТ', 'хорошее', 'программные системы',
    'Раньше занимался промышленной автоматизацией.',
    'system_access', 'Даёт дополнительную попытку взаимодействия с терминалом.', ['cyber', 'systems']),
  profile('cybersecurity_specialist', 'СПЕЦИАЛИСТ ПО КИБЕРБЕЗОПАСНОСТИ', 'хорошее', 'анализ сетей',
    'Умеет определять происхождение неизвестных идентификаторов.',
    'terminal_hack', 'Может получить дополнительную информацию о «BK-17».', ['cyber', 'analysis']),
  profile('signal_operator', 'СВЯЗИСТ', 'хорошее', 'радиосвязь',
    'Работал с аварийными каналами связи.',
    'extra_message', 'Добавляет одно сообщение в межвагонном задании.', ['communication']),
  profile('radio_amateur', 'РАДИОЛЮБИТЕЛЬ', 'хорошее', 'работа с радиочастотами',
    'Может принимать слабые сигналы, которые штатная система не видит.',
    'weak_signal', 'Открывает дополнительную передачу в финале.', ['communication', 'radio']),
  profile('psychologist', 'ПСИХОЛОГ', 'хорошее', 'переговоры',
    'При сильном эмоциональном стрессе может на короткое время потерять концентрацию.',
    'clarification', 'Даёт один бесплатный запрос уточнения в межвагонной связи.', ['communication', 'social']),
  profile('diplomat', 'ДИПЛОМАТ', 'хорошее', 'переговоры',
    'Работал в международной гуманитарной организации.',
    'trade_bonus', 'Позволяет один раз провести обмен без стандартного ограничения связи.', ['social', 'trade', 'communication']),
  profile('logistician', 'ЛОГИСТ', 'хорошее', 'управление ресурсами',
    'Умеет рассчитывать минимальные запасы для длительной автономной работы.',
    'resource_save', 'При одном использовании ресурса позволяет сохранить его часть.', ['resources', 'analysis']),
  profile('storekeeper', 'КЛАДОВЩИК', 'удовлетворительное', 'учёт запасов',
    'Перед отправлением заметил контейнер, которого нет в официальной ведомости.',
    'hidden_supply', 'Открывает один дополнительный небольшой ресурс.', ['resources']),
  profile('cook', 'ПОВАР', 'хорошее', 'хранение продуктов',
    'По первому образованию — химик-технолог.',
    'water_treatment', 'Позволяет один раз решить проблему воды без расходования всего запаса.', ['resources', 'chemistry']),
  profile('chemist', 'ХИМИК', 'удовлетворительное', 'анализ веществ',
    'Работал с системами очистки воды.',
    'chemical_analysis', 'Может определить безопасность неизвестной жидкости или среды.', ['chemistry', 'survival', 'analysis']),
  profile('biologist', 'БИОЛОГ', 'хорошее', 'биологический анализ',
    'Специализировался на микроорганизмах в замкнутых системах.',
    'bio_scan', 'Даёт дополнительную информацию при событиях с заражённой средой.', ['biology', 'survival', 'analysis']),
  profile('rescuer', 'СПАСАТЕЛЬ', 'отличное', 'действия в ЧС',
    'Проходил подготовку по работе в подземных сооружениях.',
    'emergency_action', 'Может отменить одно небольшое негативное последствие аварии.', ['rescue', 'physical']),
  profile('firefighter', 'ПОЖАРНЫЙ', 'отличное', 'эвакуация',
    'Работал с дыхательными системами и аварийными шлюзами.',
    'hazard_entry', 'Позволяет пройти одно опасное событие без расходования противогаза.', ['rescue', 'hazard']),
  profile('builder', 'СТРОИТЕЛЬ', 'отличное', 'конструкции',
    'Участвовал в строительстве подземных технических сооружений.',
    'structure_analysis', 'Может определить безопасный проход на повреждённой схеме.', ['construction', 'engineering']),
  profile('unemployed', 'БЕЗРАБОТНЫЙ', 'отличное', 'физическая подготовка',
    'Раньше работал монтажником на объекте с кодовым названием «Бункер».',
    'bunker_knowledge', 'Узнаёт обозначения Бункера и даёт специальную финальную подсказку.', ['bunker', 'physical']),
  profile('architect', 'АРХИТЕКТОР', 'хорошее', 'чтение чертежей',
    'Однажды работал над проектом объекта с необычной системой подземных коридоров.',
    'plan_analysis', 'Помогает восстановить часть планировки Бункера.', ['bunker', 'maps', 'analysis']),
  profile('security_guard', 'ОХРАННИК', 'отличное', 'безопасность',
    'Раньше работал на режимном объекте.',
    'access_protocol', 'Может определить тип служебного пропуска.', ['security', 'bunker']),
  profile('lawyer', 'ЮРИСТ', 'хорошее', 'анализ документов',
    'Очень внимателен к формулировкам и служебным кодам.',
    'document_analysis', 'Автоматически отмечает противоречие в одном документе.', ['analysis']),
  profile('journalist', 'ЖУРНАЛИСТ', 'хорошее', 'поиск информации',
    'До эвакуации расследовал строительство закрытых государственных объектов.',
    'archive_search', 'Открывает дополнительный архивный фрагмент.', ['analysis', 'bunker']),
  profile('photographer', 'ФОТОГРАФ', 'хорошее', 'визуальная память',
    'Очень хорошо запоминает мелкие детали изображений.',
    'visual_memory', 'Даёт бонус в заданиях на запоминание схем и символов.', ['memory']),
  profile('teacher', 'ПРЕПОДАВАТЕЛЬ', 'хорошее', 'систематизация информации',
    'Привык быстро превращать хаотичные данные в понятную структуру.',
    'organize_data', 'Визуально группирует одну сложную совокупность подсказок.', ['analysis']),
  profile('student', 'СТУДЕНТ', 'отличное', 'отсутствует',
    'Учится на специалиста по информационной безопасности.',
    'terminal_hack', 'Даёт дополнительную попытку доступа к терминалу.', ['cyber']),
  profile('athlete', 'СПОРТСМЕН', 'отличное', 'физическая выносливость',
    'Имеет опыт спортивного ориентирования.',
    'physical_task', 'Может решить одно физическое препятствие без использования инструмента.', ['physical', 'navigation']),
  profile('climber', 'АЛЬПИНИСТ', 'отличное', 'работа в опасной среде',
    'Умеет перемещаться по разрушенным конструкциям.',
    'dangerous_route', 'Снижает последствия одного опасного маршрута.', ['physical', 'survival']),
  profile('driver', 'ВОДИТЕЛЬ', 'хорошее', 'оценка маршрутов',
    'Много лет работал на тяжёлой технике.',
    'route_feel', 'Даёт дополнительную информацию в «Одном шансе».', ['transport', 'navigation']),
  profile('military_engineer', 'ВОЕННЫЙ ИНЖЕНЕР', 'хорошее', 'инженерные системы',
    'Имеет опыт работы с защищёнными подземными сооружениями.',
    'bunker_systems', 'Может определить назначение одного технического элемента Бункера.', ['bunker', 'engineering']),
  profile('astronomer', 'АСТРОНОМ', 'удовлетворительное', 'работа с координатами',
    'Отлично ориентируется в системах координат и времени.',
    'coordinate_analysis', 'В финале помогает восстановить часть координат.', ['coordinates', 'analysis']),
  profile('watchmaker', 'ЧАСОВЩИК', 'удовлетворительное', 'точные механизмы',
    'Раньше ремонтировал промышленные таймеры и электромеханические замки.',
    'gate_timing', 'Даёт дополнительную информацию о времени открытия шлюза.', ['time', 'mechanic']),
] as const;

export type CharacterPoolValidation = { valid: boolean; errors: string[] };

export function validateCharacterPool(
  profiles: readonly BunkerCharacterProfile[],
): CharacterPoolValidation {
  const errors: string[] = [];
  const keys = new Set<string>();
  const professions = new Set<string>();

  for (const current of profiles) {
    if (keys.has(current.key)) errors.push(`Duplicate character key: ${current.key}`);
    if (professions.has(current.profession)) errors.push(`Duplicate profession: ${current.profession}`);
    keys.add(current.key);
    professions.add(current.profession);
    if (!current.key || !current.profession || !current.health || !current.visibleSkill
      || !current.hiddenTrait || !current.specialAbility || !current.abilityDescription
      || current.tags.length === 0) {
      errors.push(`Incomplete character profile: ${current.key || '<empty>'}`);
    }
  }

  if (profiles.length !== 36) errors.push(`Expected 36 profiles, received ${profiles.length}`);
  return { valid: errors.length === 0, errors };
}
