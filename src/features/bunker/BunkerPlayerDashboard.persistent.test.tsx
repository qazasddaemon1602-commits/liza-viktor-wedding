import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { BunkerV2ActiveGuestRuntime } from './v2/contracts';
import type { BunkerV2DashboardReadModel } from './v2/dashboard.service';
import { BunkerPlayerDashboard } from './BunkerPlayerDashboard';

const runtime: BunkerV2ActiveGuestRuntime = {
  contractVersion: 2,
  status: 'active',
  serverNow: '2026-08-30T19:10:00Z',
  state: 'MISSION_05',
  planVersion: 1,
  runNonce: 'run-1',
  viewer: {
    kind: 'guest',
    guest: { id: 'guest-1', realName: 'Анна Петрова' },
    wagon: { number: 2, label: 'ВАГОН №2' },
  },
  character: {
    profileKey: 'architect',
    profileVersion: 1,
    profession: 'АРХИТЕКТОР',
    health: 'хорошее',
    visibleSkill: 'чтение чертежей',
    specialAbility: 'plan_analysis',
    abilityDescription: 'Помогает восстановить часть планировки Бункера.',
    abilityUsesRemaining: 1,
    status: 'active',
    m01Eligibility: 'frozen_member',
    hiddenTraitRevealed: false,
  },
  currentMission: {
    instanceId: 'm05',
    instanceVersion: 1,
    code: 'MISSION_05',
    status: 'active',
    scope: 'wagon',
  },
};

const dashboard: Extract<BunkerV2DashboardReadModel, { status: 'active' }> = {
  contractVersion: 2,
  status: 'active',
  serverNow: '2026-08-30T19:10:00Z',
  wagon: { id: 'wagon-2', number: 2, label: 'ВАГОН №2' },
  passengers: [
    {
      guestId: 'guest-1',
      realName: 'Анна Петрова',
      profession: 'АРХИТЕКТОР',
      visibleSkill: 'чтение чертежей',
      characterStatus: 'active',
      hiddenTraitRevealed: false,
    },
    {
      guestId: 'guest-2',
      realName: 'Иван Сидоров',
      profession: 'МЕХАНИК',
      visibleSkill: 'ремонт механизмов',
      characterStatus: 'saved',
      hiddenTraitRevealed: true,
      hiddenTrait: 'Раньше обслуживал железнодорожное оборудование.',
    },
  ],
  inventory: [
    { itemKey: 'water', available: 1, used: 1, transferred: 1, lost: 0 },
    { itemKey: 'radio', available: 0, used: 0, transferred: 0, lost: 1 },
  ],
  archive: [{
    artifactKey: 'BK-17',
    contentType: 'document',
    decryptionStatus: 'decoded',
    scope: 'wagon',
  }],
  wagonState: {
    powerStatus: 'unstable',
    communicationStatus: 'degraded',
    navigationStatus: 'working',
    technicalDoorStatus: 'unlocked',
    trackDamage: 20,
    waterStatus: 'limited',
    routeChoice: 'A',
    routeBonus: 7,
    powerInstability: 1,
    sector04Found: true,
    coordinationBonus: true,
  },
};

describe('persistent Bunker V2 player dashboard', () => {
  it('keeps passengers, inventory, archive and wagon state visible during M05 without old mission models', async () => {
    const user = userEvent.setup();
    render(<BunkerPlayerDashboard runtime={runtime} dashboard={dashboard} />);

    await user.click(screen.getByRole('button', { name: 'ПАССАЖИРЫ' }));
    expect(screen.getByRole('heading', { name: 'Анна Петрова' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Иван Сидоров' })).toBeInTheDocument();
    expect(screen.getByText('МЕХАНИК')).toBeInTheDocument();
    expect(screen.getByText(/Раньше обслуживал железнодорожное оборудование/i)).toBeInTheDocument();
    expect(screen.queryByText(/скрыт.*Анна/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'ИНВЕНТАРЬ' }));
    const inventory = within(screen.getByLabelText('Инвентарь вагона'));
    expect(inventory.getByRole('heading', { name: 'Запас воды' })).toBeInTheDocument();
    expect(inventory.getByText('Доступно: 1')).toBeInTheDocument();
    expect(inventory.getByText('Использовано: 1')).toBeInTheDocument();
    expect(inventory.getByText('Передано: 1')).toBeInTheDocument();
    expect(inventory.getByRole('heading', { name: 'Рация' })).toBeInTheDocument();
    expect(inventory.getByText('Потеряно: 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'АРХИВ' }));
    expect(within(screen.getByLabelText('Архив вагона')).getByRole('heading', { name: 'Папка BK-17' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'СОСТОЯНИЕ' }));
    const state = within(screen.getByLabelText('Состояние вагона'));
    expect(state.getByText(/Питание · Нестабильно/i)).toBeInTheDocument();
    expect(state.getByText(/Связь · С перебоями/i)).toBeInTheDocument();
    expect(state.getByText(/Навигация · Работает/i)).toBeInTheDocument();
    expect(state.getByText(/Техническая дверь · Открыто/i)).toBeInTheDocument();
    expect(state.getByText(/Повреждение пути · 20%/i)).toBeInTheDocument();
    expect(state.getByText(/Вода · Ограничено/i)).toBeInTheDocument();
    expect(state.getByText(/Маршрут · A/i)).toBeInTheDocument();
    expect(state.getByText(/Бонус маршрута · \+7 мин/i)).toBeInTheDocument();
    expect(state.getByText(/Нестабильность питания · 1/i)).toBeInTheDocument();
    expect(state.getByText(/Сектор 04 · найден/i)).toBeInTheDocument();
    expect(state.getByText(/Координация · бонус активен/i)).toBeInTheDocument();
  });

  it('renders a negative B-route time adjustment without a fake plus sign', async () => {
    const user = userEvent.setup();
    render(<BunkerPlayerDashboard runtime={runtime} dashboard={{ ...dashboard, wagonState: { ...dashboard.wagonState, routeChoice: 'B', routeBonus: -5 } }} />);
    await user.click(screen.getByRole('button', { name: 'СОСТОЯНИЕ' }));
    expect(screen.getByText(/Бонус маршрута · -5 мин/i)).toBeInTheDocument();
    expect(screen.queryByText(/\+-5/)).not.toBeInTheDocument();
  });

  it('keeps the latest BK-17 transmission above the mission shell while the guest changes tabs', async () => {
    const user = userEvent.setup();
    render(
      <BunkerPlayerDashboard
        runtime={runtime}
        dashboard={dashboard}
        operatorFeedDependencies={{
          load: vi.fn().mockResolvedValue({
            status: 'active', active: true, globalGameState: 'MISSION_05', revealed: false,
            serverNow: '2026-08-30T19:10:00.000Z',
            message: {
              id: 'signal-04', stage: 'MISSION_04', source: 'fallback',
              body: 'Один вагон не дойдёт. Держите связь.',
              publishedAt: '2026-08-30T19:09:50.000Z',
            },
          }),
        }}
      />,
    );

    const transmission = await screen.findByRole('note', { name: 'Последняя передача оператора BK-17' });
    expect(transmission).toHaveTextContent('РЕЗЕРВНЫЙ СИГНАЛ');
    const dashboardHeader = document.querySelector('.bunker-player-dashboard__header');
    expect(dashboardHeader).not.toBeNull();
    expect(transmission.compareDocumentPosition(dashboardHeader!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'ИНВЕНТАРЬ' }));
    await waitFor(() => expect(screen.getByLabelText('Инвентарь вагона')).toBeInTheDocument());
    expect(screen.getByRole('note', { name: 'Последняя передача оператора BK-17' })).toHaveTextContent(
      'Один вагон не дойдёт. Держите связь.',
    );
  });

  it('drops the persistent phone transmission immediately when runtime.runNonce changes', async () => {
    const load = vi.fn()
      .mockResolvedValueOnce({
        status: 'active' as const, active: true as const, globalGameState: 'MISSION_05', revealed: false,
        serverNow: '2026-08-30T19:10:00.000Z',
        message: {
          id: 'old-phone-signal', stage: 'MISSION_04' as const, source: 'selected' as const,
          body: 'Один вагон не дойдёт. Держите связь.',
          publishedAt: '2026-08-30T19:09:50.000Z',
        },
      })
      .mockRejectedValue(new Error('new run offline'));
    const dependencies = { load };
    const view = render(
      <BunkerPlayerDashboard runtime={runtime} dashboard={dashboard} operatorFeedDependencies={dependencies} />,
    );
    expect(await screen.findByRole('note', { name: 'Последняя передача оператора BK-17' })).toBeInTheDocument();

    view.rerender(
      <BunkerPlayerDashboard
        runtime={{ ...runtime, runNonce: 'run-2' }}
        dashboard={dashboard}
        operatorFeedDependencies={dependencies}
      />,
    );
    expect(screen.queryByRole('note', { name: 'Последняя передача оператора BK-17' })).not.toBeInTheDocument();
  });
});
