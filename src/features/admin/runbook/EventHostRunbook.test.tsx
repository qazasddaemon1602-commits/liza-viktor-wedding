import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminShell, type AdminShellDependencies } from '../AdminShell';
import type { AdminDashboard } from '../admin.service';
import { EventHostRunbook } from './EventHostRunbook';
import { EVENT_HOST_CUES } from './eventHostContent';

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

  it('exposes the complete collapsible timeline and delegates Bunker detail to its existing 13-step runbook', async () => {
    const user = userEvent.setup();
    render(<EventHostRunbook dashboard={dashboard} />);

    await user.click(screen.getByText('ПОЛНЫЙ ТАЙМЛАЙН · 11 ЭТАПОВ'));
    const timeline = screen.getByRole('list', { name: 'Полный таймлайн мероприятия' });
    expect(timeline.children).toHaveLength(11);
    expect(within(timeline).getByText(/Используйте существующий «ТАЙМЛАЙН БУНКЕРА» из 13 пунктов/i)).toBeInTheDocument();
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
