import type { BunkerMissionPlan } from '../../bunker/bunkerSession.service';
import {
  getBunkerMissionContent,
  normalizeBunkerMissionKey,
  type BunkerMissionContent,
  type BunkerMissionKey,
} from '../../bunker/v2/content/missionContent';

type BunkerHostRunbookProps = {
  mission: string | null | undefined;
  plan?: BunkerMissionPlan;
};

type IntermissionKey =
  | 'PROLOGUE'
  | 'BREAK'
  | 'STORY_BUNKER'
  | 'BREAK_BEFORE_FINAL'
  | 'BUNKER_OPEN'
  | 'FINISHED';
type RunbookKey = BunkerMissionKey | IntermissionKey;
type HostScript = BunkerMissionContent['host'];
type RunbookContent = {
  title: string;
  eyebrow: string;
  host: HostScript;
};

const INTERMISSIONS: Record<IntermissionKey, RunbookContent> = {
  PROLOGUE: {
    title: 'Пролог',
    eyebrow: 'ПРОЛОГ · ПОСАДКА В ПОСЛЕДНИЙ ВАГОН',
    host: {
      brief: 'Объясните правила и завязку: Виктор ведёт поезд к BK-17, неизвестный источник ждёт там, а гости проходят путь командами вагонов.',
      say: [
        'Добро пожаловать на поезд «Последний вагон». Виктор ведёт поезд к BK-17, где состав ждёт неизвестный источник.',
        'Следите за большим экраном и телефонами. Обсуждает весь вагон, итоговое решение отправляет один участник с телефона команды.',
        'Сюжет может ставить персонажей под угрозу, но реальные гости остаются в игре до самого финала.',
      ],
      improvise: [
        'Попросите каждый вагон выбрать связного на текущий этап и придумать короткий позывной.',
        'Перед запуском проверьте вслух: ТВ видно, звук слышно, телефоны открыты.',
      ],
      hints: [
        'Если гости ещё входят, повторите только механику общего решения с одного телефона вагона.',
        'Не начинайте сюжет, пока хотя бы один телефон каждого вагона не показывает состав.',
      ],
      doNotRevealUntil: [
        'Не называйте личность неизвестного источника, Сектор 04, Бункер и архивную последовательность.',
        'Не объясняйте будущие предметы и последствия маршрута.',
      ],
      afterCompletion: 'Когда команды готовы, приглушите общий свет и запускайте первое экстренное сообщение.',
    },
  },
  BREAK: {
    title: 'Архивная пауза',
    eyebrow: 'ПЕРЕРЫВ · ПЕРВОЕ АРХИВНОЕ ПОДТВЕРЖДЕНИЕ',
    host: {
      brief: 'Дайте гостям выдохнуть: проверка состава дала первое архивное подтверждение маршрута к BK-17.',
      say: [
        'Пассажирский протокол принят. Мы получили первое архивное подтверждение маршрута к BK-17.',
        'Виктор продолжает вести поезд к этой точке. Неизвестный источник ждёт там, но не раскрывает себя.',
        'Сохраните метку в архиве. Следующее задание поможет восстановить её происхождение.',
      ],
      improvise: [
        'Покажите короткий архивный штамп BK-17 на ТВ и выдержите паузу.',
        'Можно спросить у вагонов по одной версии, что скрывается за обозначением.',
      ],
      hints: [
        'Если гости спорят о первом выборе, напомните: это последствия для сюжета, а не исключение гостей.',
        'Перед продолжением проверьте, что все вагоны видят вкладку «Архив».',
      ],
      doNotRevealUntil: [
        'Не называйте Сектор 04 и не говорите, что BK-17 — Бункер.',
        'Не подтверждайте догадки о личности неизвестного источника.',
      ],
      afterCompletion: 'Когда ведущий и телефоны готовы, запускайте «Чёрный ящик».',
    },
  },
  STORY_BUNKER: {
    title: 'История Бункера',
    eyebrow: 'РАСКРЫТИЕ · ОБЪЕКТ BK-17',
    host: {
      brief: 'После общего протокола свяжите все найденные факты и впервые прямо назовите Бункер.',
      say: [
        'Теперь данные совпали. BK-17 — не поезд и не станция. Это защищённый Бункер в Секторе 04.',
        'Маршрут изменили намеренно, чтобы последний состав успел к закрытию объекта.',
        'Последовательность 4719 была архивной меткой этого маршрута. Финальный код будет собран отдельно из текущих фрагментов.',
      ],
      improvise: [
        'Читайте раскрытие медленно, делая паузы перед словами «Бункер» и «Сектор 04».',
        'На ТВ можно последовательно проявить схему тоннеля, сектор и гермоворота.',
      ],
      hints: [
        'Если гости не уловили связь, кратко повторите цепочку: маршрут — BK-17 — Сектор 04 — Бункер.',
        'Отдельно проговорите, что 4719 не является готовым ответом финала.',
      ],
      doNotRevealUntil: [
        'Не называйте динамический финальный код, пароль, координаты и время ворот.',
        'Не запускайте таймер до отдельного подтверждения готовности ведущего.',
      ],
      afterCompletion: 'Откройте короткую паузу перед финалом и предложите командам проверить архив, состояние и инвентарь.',
    },
  },
  BREAK_BEFORE_FINAL: {
    title: 'Перед финалом',
    eyebrow: 'ПАУЗА · ПРОВЕРКА ГОТОВНОСТИ',
    host: {
      brief: 'Последняя техническая остановка: проверьте ТВ, звук, связных и состояние команд до запуска общего таймера.',
      say: [
        'Бункер найден, но ворота ещё закрыты. Сейчас у вас последняя минута на подготовку.',
        'Откройте архив, проверьте оставшиеся предметы и убедитесь, что связные вагонов на связи.',
        'После следующего сигнала у всего состава будет один общий таймер — тридцать минут.',
      ],
      improvise: [
        'Проведите короткую перекличку связных по номерам вагонов.',
        'Предложите командам выбрать одного связного для обмена финальными фрагментами.',
      ],
      hints: [
        'Не запускайте финал, если хотя бы один вагон не видит текущий экран.',
        'Проверьте, что серверный план финальных фрагментов загружен в сценарий ниже.',
      ],
      doNotRevealUntil: [
        'Не называйте значения финального кода, пароля, координат и времени ворот.',
        'Не включайте обратный отсчёт раньше серверного перехода FINAL_30.',
      ],
      afterCompletion: 'Получите явное «готов» от каждого вагона и только затем запускайте финальный протокол.',
    },
  },
  BUNKER_OPEN: {
    title: 'Бункер открыт',
    eyebrow: 'ФИНАЛ · ГЕРМОВОРОТА ОТКРЫТЫ',
    host: {
      brief: 'Зафиксируйте общую победу, погасите тревогу и дайте гостям прожить финальную сцену без технической суеты.',
      say: [
        'Протокол принят. Гермоворота открыты.',
        'Последний состав прибыл в полном составе. Бункер открыт для всех вагонов.',
        'Вы справились потому, что решения, предметы и сведения разных команд сошлись вместе.',
      ],
      improvise: [
        'Включите тёплый свет и предложите связным поднять телефоны как знак общего прибытия.',
        'Назовите по одному сильному решению каждого вагона.',
      ],
      hints: [
        'Если экран ещё показывает таймер, сначала дождитесь подтверждённого BUNKER_OPEN.',
        'Не разбирайте ошибки сейчас: оставьте их для короткого эпилога.',
      ],
      doNotRevealUntil: [
        'Не объявляйте победу до серверного состояния BUNKER_OPEN.',
        'Не показывайте технические ответы и персональные скрытые карточки.',
      ],
      afterCompletion: 'После аплодисментов завершите игру отдельной кнопкой и переходите к эпилогу.',
    },
  },
  FINISHED: {
    title: 'Эпилог',
    eyebrow: 'ПРОТОКОЛ ЗАВЕРШЁН',
    host: {
      brief: 'Закройте историю коротким итогом, верните гостей к программе мероприятия и оставьте результаты доступными без новых игровых действий.',
      say: [
        'История «Последнего вагона» завершена. Спасибо всем командам и их связным.',
        'Ни один вагон не дошёл бы отдельно: Бункер открыл именно общий протокол.',
        'Игра окончена. Можно открыть результаты и вернуться к программе вечера.',
      ],
      improvise: [
        'Предложите гостям вспомнить самое неожиданное решение.',
        'Сделайте общее фото вагонов на фоне финального экрана.',
      ],
      hints: [
        'Если нужен разбор, говорите о командных решениях, а не о проигравших гостях.',
        'Перед уходом с пульта убедитесь, что состояние FINISHED сохранилось.',
      ],
      doNotRevealUntil: [
        'Не публикуйте персональные ответы и скрытые карточки гостей без их согласия.',
        'Не запускайте новый игровой цикл без отдельного сброса и проверки состава.',
      ],
      afterCompletion: 'Оставьте финальный экран или результаты включёнными до следующего пункта программы.',
    },
  },
};

const TIMELINE: Array<{ key: RunbookKey; title: string }> = [
  { key: 'PROLOGUE', title: 'Пролог' },
  { key: 'M01', title: 'Лишний пассажир' },
  { key: 'BREAK', title: 'Архивная пауза' },
  { key: 'M02', title: 'Чёрный ящик' },
  { key: 'M03', title: 'Аварийный запас' },
  { key: 'M04', title: 'Межвагонная связь' },
  { key: 'M05', title: 'Один шанс' },
  { key: 'M06', title: 'Общий протокол' },
  { key: 'STORY_BUNKER', title: 'История Бункера' },
  { key: 'BREAK_BEFORE_FINAL', title: 'Перед финалом' },
  { key: 'FINAL', title: 'Бункер 30:00' },
  { key: 'BUNKER_OPEN', title: 'Бункер открыт' },
  { key: 'FINISHED', title: 'Эпилог' },
];

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function runtimeKey(value: string | null | undefined): RunbookKey {
  const mission = normalizeBunkerMissionKey(value);
  if (mission) return mission;

  const state = value?.trim().toUpperCase();
  if (state === 'BREAK' || state === 'STORY_BUNKER' || state === 'BREAK_BEFORE_FINAL'
    || state === 'BUNKER_OPEN' || state === 'FINISHED') {
    return state;
  }
  return 'PROLOGUE';
}

function runbookContent(key: RunbookKey): RunbookContent {
  if (key in INTERMISSIONS) return INTERMISSIONS[key as IntermissionKey];
  const mission = getBunkerMissionContent(key);
  if (!mission) return INTERMISSIONS.PROLOGUE;
  return { title: mission.title, eyebrow: mission.intro.eyebrow, host: mission.host };
}

function exclusionWord(count: number): string {
  return count === 1 ? 'персонажа' : 'персонажей';
}

const FINAL_PARAMETER_LABELS: Record<string, string> = {
  coordinates: 'Координаты',
  sector: 'Сектор',
  code: 'Код доступа',
  gateway_time: 'Время ворот',
  password: 'Пароль',
};

function missionPlanNotes(key: RunbookKey, plan: BunkerMissionPlan | undefined): string[] {
  if (key === 'M01') {
    if (!Array.isArray(plan)) return ['Серверный план ещё не загружен. Не называйте число до обновления статуса.'];
    const notes = plan.flatMap((entry, index) => {
      if (!record(entry) || typeof entry.exclusionCount !== 'number') return [];
      const count = Math.floor(entry.exclusionCount);
      if (count < 1 || count > 3) return [`Вагон ${index + 1} — квота не готова, обновите серверный статус.`];
      return [`Вагон ${index + 1} — исключить ${count} ${exclusionWord(count)}.`];
    });
    return notes.length > 0 ? notes : ['В плане нет корректных квот. Обновите статус перед объяснением задания.'];
  }

  if (key === 'M04') {
    const groups = record(plan) && Array.isArray(plan.groups) ? plan.groups : null;
    if (!groups) return ['Состав групп ещё не загружен. Не назначайте пары вручную.'];
    return groups.flatMap((group, index) => {
      if (!Array.isArray(group)) return [];
      const kind = group.length === 2 ? 'пара' : group.length === 3 ? 'тройка' : `${group.length} вагонов`;
      return [`Группа ${index + 1} · ${kind} · состав указан на телефонах.`];
    });
  }

  if (key === 'M06') {
    if (!Array.isArray(plan)) return ['План фрагментов ещё не загружен. Не распределяйте подсказки вручную.'];
    return [`Сервер распределил ${plan.length} фрагментов общего протокола — по текущему составу вагонов.`];
  }

  if (key === 'FINAL') {
    if (!Array.isArray(plan)) return ['Финальные фрагменты ещё не загружены. Не запускайте таймер и не используйте архивную метку как код.'];
    const fragments = plan.flatMap((entry, index) => {
      if (!record(entry) || typeof entry.parameter !== 'string') return [];
      const label = FINAL_PARAMETER_LABELS[entry.parameter] ?? 'Параметр';
      const part = typeof entry.part === 'number' ? entry.part : 1;
      const total = typeof entry.totalParts === 'number' ? entry.totalParts : 1;
      const suffix = total > 1 ? ` · часть ${part} из ${total}` : '';
      return [`Фрагмент ${index + 1} · ${label}${suffix}.`];
    });
    return [`Серверный план: ${fragments.length} фрагментов.`, ...fragments];
  }

  return [];
}

export function BunkerHostRunbook({ mission, plan }: BunkerHostRunbookProps) {
  const activeKey = runtimeKey(mission);
  const content = runbookContent(activeKey);
  const planNotes = missionPlanNotes(activeKey, plan);

  return (
    <section className="admin-bunker-runbook" aria-label="Сценарий ведущего Бункера">
      <header>
        <p className="eyebrow">СЦЕНАРИЙ ВЕДУЩЕГО · LIVE</p>
        <h3>ТАЙМЛАЙН БУНКЕРА</h3>
        <p>Идите сверху вниз. Текст для чтения отделён от импровизации и технических подсказок.</p>
      </header>

      <ol className="admin-bunker-runbook__timeline" aria-label="Таймлайн Бункера">
        {TIMELINE.map((item, index) => (
          <li key={item.key} aria-current={item.key === activeKey ? 'step' : undefined}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{item.title}</strong>
          </li>
        ))}
      </ol>

      <div className="admin-bunker-runbook__script">
        <div className="admin-bunker-runbook__summary">
          <span>{content.eyebrow}</span>
          <h4>{content.title}</h4>
          <p>{content.host.brief}</p>
        </div>

        {planNotes.length > 0 && (
          <article className="admin-bunker-runbook__plan" aria-label="План текущего задания">
            <h4>СЕРВЕРНЫЙ ПЛАН ЭТОГО ЗАПУСКА</h4>
            <ul>{planNotes.map((line) => <li key={line}>{line}</li>)}</ul>
          </article>
        )}

        <article>
          <h4>СЕЙЧАС ПРОЧИТАТЬ</h4>
          {content.host.say.map((line) => <p key={line}>{line}</p>)}
        </article>

        <article>
          <h4>МОЖНО ИМПРОВИЗИРОВАТЬ</h4>
          <ul>{content.host.improvise.map((line) => <li key={line}>{line}</li>)}</ul>
        </article>

        <article>
          <h4>ЕСЛИ КОМАНДЫ ЗАСТРЯЛИ</h4>
          <ul>{content.host.hints.map((line) => <li key={line}>{line}</li>)}</ul>
        </article>

        <article className="admin-bunker-runbook__guard">
          <h4>НЕ РАСКРЫВАТЬ РАНЬШЕ</h4>
          <ul>{content.host.doNotRevealUntil.map((line) => <li key={line}>{line}</li>)}</ul>
        </article>

        <article className="admin-bunker-runbook__after">
          <h4>ПОСЛЕ ЗАВЕРШЕНИЯ</h4>
          <p>{content.host.afterCompletion}</p>
        </article>
      </div>
    </section>
  );
}
