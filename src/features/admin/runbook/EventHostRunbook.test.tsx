import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminShell, type AdminShellDependencies } from '../AdminShell';
import type { AdminDashboard } from '../admin.service';
import { EventHostRunbook } from './EventHostRunbook';
import { EVENT_HOST_CUES } from './eventHostContent';
import adminCss from '../../../styles/admin.css?raw';

const dashboard: AdminDashboard = {
  status: 'owner',
  event: {
    id: 'event-1',
    slug: 'liza-viktor',
    name: 'Лиза × Виктор',
    weddingDate: '2026-08-29',
    eventDate: '2026-08-30',
    expectedGuestCount: 40,
    registrationOpen: true,
    compositionLocked: false,
    nextTicketSequence: 11,
  },
  state: {
    currentModule: 'idle',
    screenMode: 'idle',
    screenPinned: false,
    updatedAt: '2026-08-30T12:00:00+05:00',
  },
  carriages: [
    { id: 'c1', number: 1, label: 'ВАГОН №1', accentHex: '#315044', visualMark: '01', enabled: true },
    { id: 'c2', number: 2, label: 'ВАГОН №2', accentHex: '#7e3f3c', visualMark: '02', enabled: true },
  ],
  guests: [],
  recentActions: [],
};

beforeEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('EventHostRunbook', () => {
  it('covers the whole event with actionable operator fields instead of a second game state', () => {
    expect(EVENT_HOST_CUES.map((cue) => cue.id)).toEqual([
      'arrival',
      'registration',
      'premiere',
      'carriage-assignment',
      'quiz',
      'final-five',
      'mortal-kombat',
      'bunker-intro',
      'bunker-missions',
      'bunker-final',
      'epilogue',
    ]);

    for (const cue of EVENT_HOST_CUES) {
      expect(cue.duration).toMatch(/\d/);
      expect(cue.prerequisites.length).toBeGreaterThan(0);
      expect(cue.read.length).toBeGreaterThan(0);
      expect(cue.improvise.length).toBeGreaterThan(0);
      expect(cue.technical.length).toBeGreaterThan(0);
      expect(cue.next).not.toHaveLength(0);
    }
  });

  it('keeps an exact structured editorial contract for every stage', () => {
    expect(EVENT_HOST_CUES.map((cue) => ({
      id: cue.id,
      title: cue.title,
      duration: cue.duration,
      counts: [cue.prerequisites.length, cue.read.length, cue.improvise.length, cue.technical.length],
      prerequisite: cue.prerequisites[0],
      read: cue.read[0],
      improvise: cue.improvise[0],
      technical: cue.technical[0],
      next: cue.next,
      guarded: Boolean(cue.doNotReveal?.length),
      moduleHref: cue.moduleHref ?? null,
    }))).toEqual([
      {
        id: 'arrival', title: 'ПРИБЫТИЕ ГОСТЕЙ', duration: '5–10 МИН', counts: [2, 3, 2, 2],
        prerequisite: 'ТВ открыт на главном экране, звук проверен, стойка регистрации готова.',
        read: 'Добро пожаловать! Сегодня этот вокзал отправляет только один состав — поезд Лизы и Виктора.',
        improvise: 'Встречайте семьи и компании по именам, помогайте открыть QR-код.',
        technical: 'Откройте /join на резервном телефоне и проверьте, что новая регистрация появляется в админке.',
        next: 'Когда основной поток гостей зарегистрирован, переходите к посадке и проверке билетов.',
        guarded: true, moduleHref: null,
      },
      {
        id: 'registration', title: 'РЕГИСТРАЦИЯ И ПОСАДКА', duration: '20–40 МИН', counts: [2, 2, 2, 2],
        prerequisite: 'Гости видят форму регистрации и получают уникальные билеты.',
        read: 'Проверьте билет: на нём уже указан ваш вагон. Найдите свой стол и познакомьтесь с попутчиками.',
        improvise: 'Проведите короткую перекличку по вагонам, не заставляя гостей отвечать хором.',
        technical: 'Сверяйте счётчик гостей с реальным залом; дубликаты удаляйте только после проверки имени и билета.',
        next: 'Когда молодожёны и зал готовы, объявите премьеру и попросите отложить разговоры.',
        guarded: false, moduleHref: '#admin-registration-module',
      },
      {
        id: 'premiere', title: 'ПРЕМЬЕРА', duration: '7–10 МИН', counts: [2, 2, 2, 2],
        prerequisite: 'Видео загружено, длительность проверена, ТВ в сети и слышит команды.',
        read: 'У каждого большого путешествия есть момент, с которого оно начинается. У Лизы и Виктора таких моментов было много — сегодня мы увидим их вместе.',
        improvise: 'До запуска добавьте одну личную фразу о паре, не пересказывая содержание видео.',
        technical: 'Включите режим ожидания, убедитесь в присутствии ТВ, затем запустите отсчёт.',
        next: 'После аплодисментов верните главный экран и переходите к распределению команд.',
        guarded: true, moduleHref: '#admin-premiere-module',
      },
      {
        id: 'carriage-assignment', title: 'РАСПРЕДЕЛЕНИЕ ПО ВАГОНАМ', duration: '5–7 МИН', counts: [2, 2, 2, 2],
        prerequisite: 'Большинство гостей зарегистрировано; рекомендуемое число вагонов проверено.',
        read: 'Ваш стол — это вагон, а люди рядом — команда на весь вечер. Настоящие пассажиры из игры не выбывают.',
        improvise: 'Попросите вагоны придумать короткий позывной и представить связного.',
        technical: 'Примите распределение только после визуальной проверки столов.',
        next: 'Объявите первый общий маршрут — стандартный квиз о Лизе, Викторе и гостях.',
        guarded: false, moduleHref: '#admin-registration-module',
      },
      {
        id: 'quiz', title: 'КВИЗ', duration: '35–45 МИН', counts: [2, 3, 2, 2],
        prerequisite: 'Вопросы загружены, телефоны участников открыты, изображения видны на ТВ.',
        read: 'Сейчас проверим, насколько хорошо этот состав знает своих главных пассажиров.',
        improvise: 'Между вопросами просите один вагон коротко защитить самый неожиданный вариант.',
        technical: 'Активируйте по одному вопросу; перед раскрытием дождитесь основной массы ответов.',
        next: 'После последнего общего вопроса пригласите Лизу и Виктора в финальную пятёрку.',
        guarded: true, moduleHref: '#admin-quiz-module',
      },
      {
        id: 'final-five', title: 'ФИНАЛЬНАЯ ПЯТЁРКА', duration: '12–15 МИН', counts: [2, 2, 2, 2],
        prerequisite: 'Лиза и Виктор получили персональные ссылки и открыли свои экраны.',
        read: 'А теперь пять вопросов, где у зала нет права подсказывать. Лиза и Виктор отвечают отдельно.',
        improvise: 'После несовпадения сначала спросите «почему?» у того, чей ответ звучит смелее.',
        technical: 'Перед раскрытием убедитесь, что оба ответа получены.',
        next: 'Дайте залу короткую паузу и откройте регистрацию в турнир Mortal Kombat.',
        guarded: true, moduleHref: '#admin-final-five-module',
      },
      {
        id: 'mortal-kombat', title: 'MORTAL KOMBAT', duration: '25–35 МИН', counts: [2, 3, 2, 2],
        prerequisite: 'Регистрация турнира открыта; участники понимают формат и место проведения матчей.',
        read: 'Пора выяснить, кому этот поезд доверит последний круг. Открываем Mortal Kombat.',
        improvise: 'Представляйте пары как короткие афиши, используя имена и вагоны.',
        technical: 'Подробный статус — в модуле турнира ниже. Закройте регистрацию, проверьте жеребьёвку и только потом фиксируйте сетку.',
        next: 'После награждения верните гостей к столам и подготовьте резкий сюжетный переход в Бункер.',
        guarded: false, moduleHref: '#admin-mk-module',
      },
      {
        id: 'bunker-intro', title: 'ПРОЛОГ БУНКЕРА', duration: '4–6 МИН', counts: [2, 4, 2, 2],
        prerequisite: 'Все вагоны на местах, телефоны открыты, звук ТВ включён и проверен.',
        read: 'Внимание всем пассажирам. Обычный маршрут отменён.',
        improvise: 'Приглушите свет, выдержите тишину перед первой строкой и говорите медленнее обычного.',
        technical: 'Запустите Бункер только после проверки ТВ, звука и хотя бы одного активного телефона на вагон.',
        next: 'После сигнала запускайте первый этап и дальше следуйте 13-пунктовому таймлайну Бункера.',
        guarded: true, moduleHref: '#admin-bunker-runbook',
      },
      {
        id: 'bunker-missions', title: 'МИССИИ БУНКЕРА', duration: '45–60 МИН', counts: [2, 3, 2, 2],
        prerequisite: 'Бункер запущен, состав вагонов зафиксирован, текущая миссия совпадает на ТВ и телефонах.',
        read: 'Дальше каждый вагон увидит свою часть задачи. Читайте экран внимательно: что известно, что нужно сделать и кто отправляет решение.',
        improvise: 'Между миссиями коротко пересказывайте последствия решений, не раскрывая будущие ответы.',
        technical: 'Используйте существующий «ТАЙМЛАЙН БУНКЕРА» из 13 пунктов в панели Бункера ниже: там точный текст для каждой M01–M06 и пауз.',
        next: 'После раскрытия назначения BK-17 проведите проверку связи и только затем запускайте общий финальный таймер.',
        guarded: true, moduleHref: '#admin-bunker-runbook',
      },
      {
        id: 'bunker-final', title: 'ФИНАЛ БУНКЕРА', duration: '30–35 МИН', counts: [2, 3, 2, 2],
        prerequisite: 'Все обязательные миссии завершены; связные видят финальные фрагменты.',
        read: 'Объект BK-17 найден. Гермоворота закроются через тридцать минут.',
        improvise: 'На отметках 15, 10 и 5 минут называйте только оставшееся время и число незакрытых частей.',
        technical: 'Запустите FINAL_30 одной командой. Не открывайте Бункер нормально, пока сервер не подтвердил unlock.',
        next: 'После подтверждённого BUNKER_OPEN погасите тревогу, включите тёплый свет и завершите игру.',
        guarded: true, moduleHref: '#admin-bunker-runbook',
      },
      {
        id: 'epilogue', title: 'ЭПИЛОГ И ВОЗВРАЩЕНИЕ К ПРАЗДНИКУ', duration: '5–10 МИН', counts: [2, 3, 2, 2],
        prerequisite: 'Бункер открыт или ведущий явно завершил сюжет после восстановительной процедуры.',
        read: 'Гермоворота открыты. Последний состав прибыл полностью.',
        improvise: 'Поблагодарите связных, назовите победителя турнира и самый запомнившийся момент квиза.',
        technical: 'Завершите Бункер в админке, верните ТВ на основной экран и проверьте, что тревожный звук остановлен.',
        next: 'Передайте слово следующему блоку программы и оставьте админку открытой для контроля связи.',
        guarded: false, moduleHref: null,
      },
    ]);
  });

  it('puts the suggested current cue first and renders exact read, improvise, technical and next blocks', () => {
    render(<EventHostRunbook dashboard={dashboard} />);

    const current = screen.getByRole('article', { name: 'Текущий этап сценария' });
    expect(within(current).getByRole('heading', { name: 'ПРИБЫТИЕ ГОСТЕЙ' })).toBeInTheDocument();
    expect(within(current).getByText('5–10 МИН')).toBeInTheDocument();
    expect(within(current).getByRole('heading', { name: 'ПРОЧИТАТЬ ДОСЛОВНО' })).toBeInTheDocument();
    expect(within(current).getByRole('heading', { name: 'МОЖНО ИМПРОВИЗИРОВАТЬ' })).toBeInTheDocument();
    expect(within(current).getByRole('heading', { name: 'ТЕХНИЧЕСКОЕ ДЕЙСТВИЕ' })).toBeInTheDocument();
    expect(within(current).getByRole('heading', { name: 'ЧТО ДАЛЬШЕ' })).toBeInTheDocument();
    expect(within(current).getByText(/Сегодня этот вокзал отправляет только один состав/i)).toBeInTheDocument();
  });

  it('persists manual completion locally per event and advances to the next incomplete cue', async () => {
    const user = userEvent.setup();
    const firstRender = render(<EventHostRunbook dashboard={dashboard} />);

    const current = screen.getByRole('article', { name: 'Текущий этап сценария' });
    await user.click(within(current).getByRole('button', { name: 'ОТМЕТИТЬ ЭТАП «ПРИБЫТИЕ ГОСТЕЙ» ВЫПОЛНЕННЫМ' }));
    expect(screen.getByRole('article', { name: 'Текущий этап сценария' }))
      .toHaveTextContent('РЕГИСТРАЦИЯ И ПОСАДКА');

    const stored = JSON.parse(window.localStorage.getItem('event.hostRunbook.v1') ?? '{}');
    expect(stored.events['event-1']).toEqual(['arrival']);

    firstRender.unmount();
    render(<EventHostRunbook dashboard={dashboard} />);
    expect(screen.getByRole('article', { name: 'Текущий этап сценария' }))
      .toHaveTextContent('РЕГИСТРАЦИЯ И ПОСАДКА');
  });

  it('uses active module state only as a read-only hint for the suggested cue', () => {
    render(
      <EventHostRunbook
        dashboard={{
          ...dashboard,
          state: { ...dashboard.state!, currentModule: 'mortal_kombat', screenMode: 'mortal_kombat' },
        }}
      />,
    );

    const current = screen.getByRole('article', { name: 'Текущий этап сценария' });
    expect(within(current).getByRole('heading', { name: 'MORTAL KOMBAT' })).toBeInTheDocument();
    expect(within(current).getByText(/^Экран:.*Подробный статус — в модуле турнира ниже/i)).toBeInTheDocument();
  });

  it('advances past a completed active module instead of pinning it as current', () => {
    window.localStorage.setItem('event.hostRunbook.v1', JSON.stringify({
      version: 1,
      events: { 'event-1': ['mortal-kombat'] },
    }));

    render(
      <EventHostRunbook
        dashboard={{
          ...dashboard,
          state: { ...dashboard.state!, currentModule: 'mortal_kombat', screenMode: 'mortal_kombat' },
        }}
      />,
    );

    expect(screen.getByRole('article', { name: 'Текущий этап сценария' }))
      .toHaveTextContent('ПРОЛОГ БУНКЕРА');
  });

  it('rejects array-shaped storage and normalizes duplicate or unknown cue ids', () => {
    window.localStorage.setItem('event.hostRunbook.v1', JSON.stringify({ version: 1, events: [] }));
    const firstRender = render(<EventHostRunbook dashboard={dashboard} />);
    expect(screen.getByText('0 / 11 ЭТАПОВ')).toBeInTheDocument();
    firstRender.unmount();

    window.localStorage.setItem('event.hostRunbook.v1', JSON.stringify({
      version: 1,
      events: { 'event-1': ['arrival', 'arrival', 'unknown', 'registration'] },
    }));
    render(<EventHostRunbook dashboard={dashboard} />);
    expect(screen.getByText('2 / 11 ЭТАПОВ')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Текущий этап сценария' })).toHaveTextContent('ПРЕМЬЕРА');
  });

  it('keeps the local session usable when storage writes are unavailable', async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage unavailable', 'QuotaExceededError');
    });
    render(<EventHostRunbook dashboard={dashboard} />);

    const current = screen.getByRole('article', { name: 'Текущий этап сценария' });
    await user.click(within(current).getByRole('button', { name: 'ОТМЕТИТЬ ЭТАП «ПРИБЫТИЕ ГОСТЕЙ» ВЫПОЛНЕННЫМ' }));

    expect(screen.getByRole('article', { name: 'Текущий этап сценария' }))
      .toHaveTextContent('РЕГИСТРАЦИЯ И ПОСАДКА');
  });

  it('keeps essential host copy and controls readable', () => {
    const style = document.createElement('style');
    style.textContent = adminCss;
    document.head.append(style);
    render(<EventHostRunbook dashboard={dashboard} />);
    const current = screen.getByRole('article', { name: 'Текущий этап сценария' });

    expect(Number.parseFloat(getComputedStyle(within(current).getByText(/Регистрация: 0/)).fontSize)).toBeGreaterThanOrEqual(16);
    expect(Number.parseFloat(getComputedStyle(within(current).getByRole('heading', { name: 'ПЕРЕД НАЧАЛОМ' })).fontSize)).toBeGreaterThanOrEqual(13.6);
    expect(Number.parseFloat(getComputedStyle(within(current).getByRole('button')).fontSize)).toBeGreaterThanOrEqual(13.6);
    style.remove();
  });

  it('exposes the complete collapsible timeline and delegates Bunker detail to its existing 13-step runbook', async () => {
    const user = userEvent.setup();
    render(<EventHostRunbook dashboard={dashboard} />);

    await user.click(screen.getByText('ПОЛНЫЙ ТАЙМЛАЙН · 11 ЭТАПОВ'));
    const timeline = screen.getByRole('list', { name: 'Полный таймлайн мероприятия' });
    expect(timeline.children).toHaveLength(11);
    expect(within(timeline).getByText(/Используйте существующий «ТАЙМЛАЙН БУНКЕРА» из 13 пунктов/i)).toBeInTheDocument();
    expect(within(timeline).getAllByRole('link', { name: 'ПЕРЕЙТИ К ДЕТАЛЬНОМУ СЦЕНАРИЮ БУНКЕРА' }))
      .toHaveLength(3);
    expect(within(timeline).getAllByRole('link', { name: 'ПЕРЕЙТИ К ДЕТАЛЬНОМУ СЦЕНАРИЮ БУНКЕРА' })[0])
      .toHaveAttribute('href', '#admin-bunker-runbook');
  });

  it('is mounted in AdminShell before module-specific controls', async () => {
    const deps: AdminShellDependencies = {
      load: vi.fn().mockResolvedValue(dashboard),
      deleteGuest: vi.fn().mockResolvedValue(undefined),
      reassignGuest: vi.fn().mockResolvedValue(undefined),
      lockComposition: vi.fn().mockResolvedValue({ registrationOpen: true }),
    };
    render(<AdminShell dependencies={deps} refreshIntervalMs={0} />);

    const runbook = await screen.findByRole('region', { name: 'Общий сценарий мероприятия' });
    const rehearsal = screen.getByRole('heading', { name: 'РЕПЕТИЦИЯ' }).closest('section');
    expect(rehearsal).not.toBeNull();
    expect(runbook.compareDocumentPosition(rehearsal!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
