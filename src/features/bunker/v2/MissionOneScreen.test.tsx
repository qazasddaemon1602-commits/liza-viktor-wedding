import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminBunkerControl, type AdminBunkerControlDependencies } from '../../admin/bunker/AdminBunkerControl';
import { MissionOneOwnerPanel, type MissionOneOwnerReadModel } from '../../admin/bunker/MissionOneOwnerPanel';
import { BunkerQuestScene } from '../BunkerQuestScene';
import type { BunkerScreenState } from '../bunker.service';
import { MissionOneScreen, type MissionOneScreenReadModel } from './MissionOneScreen';

function screenModel(count: number): MissionOneScreenReadModel {
  return {
    title: 'Лишний пассажир',
    publicSummary: 'Вагоны изучают открытые части досье и принимают командное решение.',
    remainingSeconds: 184,
    wagons: Array.from({ length: count }, (_, index) => ({
      wagonId: `wagon-${index + 1}`,
      label: `ВАГОН №${index + 1}`,
      status: index < 2 ? 'completed' : 'active',
      // Deliberately-shaped private fields must never appear on TV.
      memberName: 'Александра-Мария Константинопольская',
      hiddenTrait: 'Секретная характеристика',
    })),
  };
}

describe('MissionOneScreen', () => {
  it.each([2, 3, 4, 5])('shows public deadline and progress for exactly %i active wagons', (count) => {
    const model = screenModel(count);
    const { container } = render(<MissionOneScreen model={model} />);

    expect(screen.getByRole('heading', { name: 'ЛИШНИЙ ПАССАЖИР' })).toBeInTheDocument();
    expect(screen.getByText('03:04')).toBeInTheDocument();
    expect(screen.getByText(model.publicSummary)).toBeInTheDocument();
    const grid = screen.getByRole('list', { name: 'Прогресс вагонов' });
    expect(grid).toHaveAttribute('data-count', String(count));
    expect(within(grid).getAllByRole('listitem')).toHaveLength(count);
    expect(container).toHaveTextContent(`${Math.min(2, count)} / ${count} ГОТОВО`);
    expect(container).not.toHaveTextContent('Александра-Мария Константинопольская');
    expect(container).not.toHaveTextContent('Секретная характеристика');
  });

  it('reuses the established raster Bunker artwork as text-free decoration', () => {
    render(<MissionOneScreen model={screenModel(3)} />);

    const backdrop = screen.getByTestId('bunker-mission-one-backdrop');
    expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    expect(backdrop.querySelector('img')).toHaveAttribute('src', '/images/bunker/bunker-exterior.png');
    expect(backdrop.querySelector('img')).toHaveAttribute('alt', '');
  });
});

const activeScreen: Extract<BunkerScreenState, { status: 'active' }> = {
  status: 'active',
  startedAt: '2026-08-21T18:00:00.000Z',
  durationSeconds: 240,
  remainingSeconds: 184,
  soundEnabled: false,
  phase: 'dossier_1',
  unlocked: false,
  teams: Array.from({ length: 3 }, (_, index) => ({
    carriageNumber: index + 1,
    label: `ВАГОН №${index + 1}`,
    missionAComplete: index === 0,
    missionBComplete: false,
  })),
  characterCounts: { active: 20, saved: 0, excluded: 0 },
  globalGameState: 'MISSION_01',
  currentMission: {
    id: 'mission-01', state: 'MISSION_01',
    plan: { publicTvSummary: 'Команды принимают решение по досье.' },
  },
  serverNow: '2026-08-21T18:00:56.000Z',
};

describe('Mission one TV integration', () => {
  it('replaces the legacy dossier briefing with the dedicated public mission scene', () => {
    render(
      <BunkerQuestScene
        state={activeScreen}
        remainingSeconds={184}
        bunkerContractVersion={2}
        missionOne={{
          title: 'Лишний пассажир',
          publicSummary: 'Команды принимают решение по досье.',
          remainingSeconds: 184,
          wagons: activeScreen.teams.map((team) => ({
            wagonId: String(team.carriageNumber),
            label: team.label,
            status: team.missionAComplete ? 'completed' : 'active',
          })),
        }}
      />,
    );

    expect(screen.getByRole('region', { name: 'Миссия 01 · экран' })).toBeInTheDocument();
    expect(screen.getByText('Команды принимают решение по досье.')).toBeInTheDocument();
    expect(screen.queryByText('ЛИЧНЫЕ ТЕРМИНАЛЫ АКТИВНЫ')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});

const ownerModel: MissionOneOwnerReadModel = {
  status: 'active',
  remainingSeconds: 121,
  wagons: [
    {
      wagonId: 'wagon-1', label: 'ВАГОН №1', quota: 2, status: 'completed',
      selectedGuestIds: ['guest-1', 'guest-2'],
      members: [
        { guestId: 'guest-1', realName: 'Александра-Мария Константинопольская', profession: 'Инженер' },
        { guestId: 'guest-2', realName: 'Николай Добровольский', profession: 'Картограф' },
        { guestId: 'guest-3', realName: 'Екатерина Воскресенская', profession: 'Фельдшер' },
      ],
    },
    {
      wagonId: 'wagon-2', label: 'ВАГОН №2', quota: 1, status: 'active',
      selectedGuestIds: [],
      members: [{ guestId: 'guest-4', realName: 'Илья Северный', profession: 'Механик' }],
    },
  ],
};

describe('MissionOneOwnerPanel', () => {
  it('shows wagon progress without offering free character status toggles', () => {
    render(<MissionOneOwnerPanel model={ownerModel} onOverride={vi.fn()} />);

    expect(screen.getByText('1 / 2 ГОТОВО')).toBeInTheDocument();
    expect(screen.getByText('КВОТА · 2')).toBeInTheDocument();
    expect(screen.getByText('КВОТА · 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'АКТИВЕН' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'СПАСЁН' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ИСКЛЮЧЁН' })).not.toBeInTheDocument();
  });

  it('requires an exact replacement selection and a reason before owner override', async () => {
    const user = userEvent.setup();
    const onOverride = vi.fn().mockResolvedValue(undefined);
    render(<MissionOneOwnerPanel model={ownerModel} onOverride={onOverride} />);

    await user.click(screen.getByRole('button', { name: 'ИЗМЕНИТЬ РЕШЕНИЕ · ВАГОН №1' }));
    const form = screen.getByRole('form', { name: 'Override · ВАГОН №1' });
    const apply = within(form).getByRole('button', { name: 'ПРИМЕНИТЬ OVERRIDE' });
    expect(apply).toBeDisabled();

    await user.click(within(form).getByRole('checkbox', { name: /николай добровольский/i }));
    await user.click(within(form).getByRole('checkbox', { name: /екатерина воскресенская/i }));
    expect(apply).toBeDisabled();
    await user.type(within(form).getByRole('textbox', { name: 'Причина изменения' }), 'Исправляем ошибочный выбор команды');
    expect(apply).toBeEnabled();

    await user.click(apply);
    expect(onOverride).toHaveBeenCalledWith({
      wagonId: 'wagon-1',
      selectedGuestIds: ['guest-1', 'guest-3'],
      reason: 'Исправляем ошибочный выбор команды',
    });
  });
});

describe('Mission one owner integration', () => {
  it('places mission-instance progress in the owner console and removes free status toggles for M01', async () => {
    const dependencies: AdminBunkerControlDependencies = {
      load: vi.fn().mockResolvedValue({
        status: 'active',
        startedAt: '2026-08-21T18:00:00.000Z',
        durationSeconds: 240,
        remainingSeconds: 121,
        soundEnabled: false,
        runNonce: 'run-1',
        globalGameState: 'MISSION_01',
        currentMission: { id: 'mission-01', state: 'MISSION_01', plan: null },
        serverNow: '2026-08-21T18:01:59.000Z',
      }),
      prepare: vi.fn(),
      distribute: vi.fn(),
      loadCharacters: vi.fn().mockResolvedValue({
        status: 'active',
        runNonce: 'run-1',
        characters: [{
          guestId: 'guest-1',
          realName: 'Александра-Мария Константинопольская',
          wagon: { id: 'wagon-1', number: 1, label: 'ВАГОН №1' },
          profession: 'Инженер',
          characterStatus: 'active',
          joinedLate: false,
        }],
        serverNow: '2026-08-21T18:01:59.000Z',
      }),
      start: vi.fn(),
      stop: vi.fn(),
      setSound: vi.fn(),
      broadcastRefresh: vi.fn(),
    };

    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={dependencies}
        missionOne={ownerModel}
        onMissionOneOverride={vi.fn()}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'ЛИШНИЙ ПАССАЖИР' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Прогресс Миссии 01' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /статус ·/i })).not.toBeInTheDocument();
  });
});
