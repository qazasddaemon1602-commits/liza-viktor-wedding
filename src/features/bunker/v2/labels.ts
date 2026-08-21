/**
 * Единый слой человекочитаемых русских названий для игры «Бункер».
 *
 * Внутренние идентификаторы (MISSION_01, active, medkit, BK-17 …) остаются в
 * данных и диагностике, но НИКОГДА не показываются гостю, ведущему или на ТВ
 * в сыром виде. Любая пользовательская поверхность Bunker V2 обязана брать
 * подписи отсюда.
 */

const STAGE_LABELS: Record<string, string> = {
  LOBBY: 'Сбор пассажиров',
  CHARACTERS_READY: 'Персонажи розданы',
  MISSION_01: 'Задание 1 — Лишний пассажир',
  BREAK: 'Пауза между заданиями',
  MISSION_02: 'Задание 2 — Чёрный ящик',
  MISSION_03: 'Задание 3 — Аварийный запас',
  MISSION_04: 'Задание 4 — Межвагонная связь',
  MISSION_05: 'Задание 5 — Опасный участок',
  MISSION_06: 'Задание 6 — Общий сбор',
  UNKNOWN_PASSENGER: 'Неизвестный пассажир',
  BREAK_BEFORE_FINAL: 'Пауза перед финалом',
  FINAL_30: 'Финал — последние тридцать минут',
  BUNKER_OPEN: 'Бункер открыт',
  FINISHED: 'История завершена',
  STORY_BUNKER: 'История бункера',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Идёт сейчас',
  planned: 'Ожидает',
  pending: 'Ожидает',
  waiting: 'Ожидает',
  idle: 'Ожидает',
  not_found: 'Ожидает',
  guest_not_found: 'Ожидает',
  in_progress: 'Идёт сейчас',
  completed: 'Завершено',
  complete: 'Завершено',
  done: 'Завершено',
  expired: 'Время вышло',
  cancelled: 'Отменено',
  submitted: 'Отправлено',
  confirmed: 'Подтверждено',
  superseded: 'Заменено новым решением',
  accepted: 'Принято',
  rejected: 'Отклонено',
  ready: 'Готов',
  member: 'Участник',
  captain: 'Капитан вагона',
  operator: 'Связист',
  voter: 'Голосующий',
  saved: 'Персонаж спасён',
  excluded: 'Персонаж исключён',
  available: 'Доступно',
  used: 'Использовано',
  transferred: 'Передано',
  lost: 'Потеряно',
  locked: 'Не расшифровано',
  partial: 'Расшифровано частично',
  decoded: 'Расшифровано',
  stable: 'Стабильно',
  unstable: 'Нестабильно',
  offline: 'Нет',
  working: 'Работает',
  degraded: 'С перебоями',
  unlocked: 'Открыто',
  damaged: 'Повреждено',
  limited: 'Ограничено',
  contaminated: 'Загрязнено',
  empty: 'Пусто',
  legacy: 'Старая версия истории',
};

const ITEM_LABELS: Record<string, string> = {
  medkit: 'Аптечка',
  radio: 'Рация',
  generator: 'Генератор',
  tools: 'Набор инструментов',
  water: 'Запас воды',
  gas_mask: 'Противогаз',
  fuel: 'Канистра топлива',
  rope: 'Трос',
  battery: 'Аккумулятор',
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  text: 'Записка',
  image: 'Фотография',
  map: 'Карта',
  audio: 'Аудиозапись',
  document: 'Документ',
  code: 'Шифр',
  card: 'Карточка',
};

const ARCHIVE_LABELS: Record<string, { title: string; hint: string }> = {
  'BK-17': {
    title: 'Папка BK-17',
    hint: 'Так была подписана папка из чёрного ящика. Это обозначение из истории, а не код системы.',
  },
  'SECTOR-04': {
    title: 'Сектор 04',
    hint: 'Обозначение участка тоннеля на служебной карте железной дороги.',
  },
  '4719': {
    title: 'Номер 4719',
    hint: 'Номер, выбитый на корпусе бортового регистратора состава.',
  },
};

const ABILITY_LABELS: Record<string, string> = {
  system_access: 'Служебный доступ инженера',
  terminal_hack: 'Работа со служебным терминалом',
  medical_help: 'Медицинская помощь',
  stabilize_person: 'Стабилизация пострадавшего',
};

function normalizeKey(value: string): string {
  return value.trim();
}

/** «Задание 1 — Лишний пассажир» для MISSION_01 / mission_01 / mission-01. */
export function bunkerStageLabel(value: string | null | undefined): string {
  if (!value) return 'Этап не назначен';
  const key = normalizeKey(value).replace(/[-\s]/g, '_').toUpperCase();
  return STAGE_LABELS[key] ?? humanizeBunkerKey(value);
}

/** «Идёт сейчас» / «Завершено» / «Ожидает». */
export function bunkerStatusLabel(value: string | null | undefined): string {
  if (!value) return 'Ожидает';
  const key = normalizeKey(value).replace(/[-\s]/g, '_').toLowerCase();
  return STATUS_LABELS[key] ?? humanizeBunkerKey(value);
}

/** «Аптечка» вместо medkit. */
export function bunkerItemLabel(value: string | null | undefined): string {
  if (!value) return 'Предмет';
  const key = normalizeKey(value).replace(/[-\s]/g, '_').toLowerCase();
  return ITEM_LABELS[key] ?? humanizeBunkerKey(value);
}

/** «Документ» вместо document. */
export function bunkerContentTypeLabel(value: string | null | undefined): string {
  if (!value) return 'Материал';
  const key = normalizeKey(value).toLowerCase();
  return CONTENT_TYPE_LABELS[key] ?? humanizeBunkerKey(value);
}

/** Сюжетное обозначение архива плюс пояснение обычными словами. */
export function bunkerArchiveLabel(value: string | null | undefined): {
  title: string;
  hint: string;
} {
  if (!value) return { title: 'Материал архива', hint: 'Найденный вагоном материал.' };
  const key = normalizeKey(value).toUpperCase().replace(/^BK_?17$/, 'BK-17');
  return ARCHIVE_LABELS[key] ?? {
    title: humanizeBunkerKey(value),
    hint: 'Найденный вагоном материал истории.',
  };
}

/** Название способности персонажа обычными словами. */
export function bunkerAbilityLabel(value: string | null | undefined): string {
  if (!value) return 'Особая способность';
  const key = normalizeKey(value).replace(/[-\s]/g, '_').toLowerCase();
  return ABILITY_LABELS[key] ?? humanizeBunkerKey(value);
}

/**
 * Последний рубеж: превращает неизвестный технический идентификатор в
 * читаемую строку, чтобы гость никогда не увидел `mission_01` или `grantSource`.
 */
export function humanizeBunkerKey(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return 'Нет данных';
  const words = raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-.]+/g, ' ')
    .trim()
    .toLowerCase();
  if (!words) return 'Нет данных';
  return words.charAt(0).toLocaleUpperCase('ru-RU') + words.slice(1);
}
