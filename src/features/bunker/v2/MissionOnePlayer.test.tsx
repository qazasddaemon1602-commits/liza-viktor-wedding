import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ActiveGuestBunkerRuntime } from '../bunkerRuntime.service';
import { BunkerPlayerDashboard } from '../BunkerPlayerDashboard';
import {
  MissionOnePlayer,
  type MissionOnePlayerReadModel,
} from './MissionOnePlayer';

const members = [
  {
    guestId: 'guest-1',
    realName: 'Александра-Мария Константинопольская-Северная',
    profession: 'Инженер-энергетик',
    health: 'Полностью здорова',
    visibleSkill: 'Восстанавливает питание сложных систем',
  },
  {
    guestId: 'guest-2',
    realName: 'Николай Добровольский',
    profession: 'Картограф',
    health: 'Близорукость',
    visibleSkill: 'Восстанавливает карту по фрагментам',
  },
  {
    guestId: 'guest-3',
    realName: 'Екатерина Воскресенская',
    profession: 'Фельдшер',
    health: 'Астма',
    visibleSkill: 'Стабилизирует пострадавших',
  },
] as const;

function model(
  overrides: Partial<MissionOnePlayerReadModel> = {},
): MissionOnePlayerReadModel {
  return {
    instanceId: 'mission-01-wagon-1',
    instanceVersion: 1,
    status: 'active',
    wagon: { number: 1, label: 'ВАГОН №1' },
    quota: 2,
    remainingSeconds: 239,
    connection: 'online',
    members: [...members],
    selectedGuestIds: [],
    ...overrides,
  };
}

describe('MissionOnePlayer', () => {
  it('shows the selected guests and exact quota before its only confirmation sends the existing payload', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<MissionOnePlayer model={model()} onConfirm={onConfirm} />);

    const mission = screen.getByRole('region', { name: 'Миссия 01 · Лишний пассажир' });
    const group = within(mission).getByRole('group', { name: /выберите ровно 2/i });
    const confirm = within(mission).getByRole('button', { name: 'Подтвердить решение' });

    expect(within(mission).getAllByRole('button', { name: 'Подтвердить решение' })).toHaveLength(1);
    expect(screen.getByText(/резервный вагон временно держит двери закрытыми/i)).toBeInTheDocument();
    expect(confirm).toBeDisabled();
    expect(screen.getByText('ВЫБРАНО · 0 / 2')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /александра-мария/i }));
    expect(confirm).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /николай добровольский/i }));
    expect(confirm).toBeEnabled();
    expect(screen.getByText('ВЫБРАНО · 2 / 2')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Выбор вагона' })).toHaveTextContent(
      `${members[0].realName} · ${members[1].realName}`,
    );
    expect(screen.getByRole('checkbox', { name: /екатерина воскресенская/i })).toBeDisabled();
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith(['guest-1', 'guest-2']);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('replaces reconnecting controls with the authoritative completed outcome', () => {
    const { rerender } = render(
      <MissionOnePlayer
        model={model({ connection: 'reconnecting' })}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(/восстанавливаем связь/i);
    expect(screen.getByRole('button', { name: 'Подтвердить решение' })).toBeDisabled();

    rerender(
      <MissionOnePlayer
        model={model({
          status: 'completed',
          connection: 'online',
          remainingSeconds: 0,
          selectedGuestIds: ['guest-1', 'guest-3'],
        })}
        onConfirm={vi.fn()}
      />,
    );

    const outcome = screen.getByRole('status');
    expect(outcome).toHaveTextContent('РЕШЕНИЕ ПРИНЯТО');
    expect(outcome).toHaveTextContent(members[0].realName);
    expect(outcome).toHaveTextContent(members[2].realName);
    expect(screen.queryByRole('button', { name: 'Подтвердить решение' })).not.toBeInTheDocument();
  });
});

const dashboardRuntime: ActiveGuestBunkerRuntime = {
  status: 'active',
  serverNow: '2026-08-21T18:00:00.000Z',
  game: {
    runNonce: 'run-1', state: 'MISSION_01', mode: 'production', finalStartedAt: null,
    finalDuration: 1800, bunkerRevealed: false,
  },
  guest: { id: 'guest-1', realName: members[0].realName, joinedLate: false },
  wagon: { id: 'wagon-1', number: 1, label: 'ВАГОН №1' },
  character: {
    profession: members[0].profession,
    health: members[0].health,
    visibleSkill: members[0].visibleSkill,
    hiddenTrait: 'Боится темноты',
    hiddenTraitRevealed: true,
    specialAbility: 'power_restore',
    abilityDescription: 'Восстанавливает питание.',
    abilityUsesRemaining: 1,
    status: 'excluded',
  },
  passengers: [], inventory: [], archive: [], wagonState: {},
  currentMission: { id: 'mission-01-wagon-1', state: 'MISSION_01', plan: null },
};

describe('Mission one dashboard integration', () => {
  it('keeps an excluded guest signed in with mission and guest navigation available', async () => {
    const user = userEvent.setup();
    render(
      <BunkerPlayerDashboard
        runtime={dashboardRuntime}
        missionOne={model()}
        onConfirmMissionOne={vi.fn()}
      />,
    );

    expect(screen.getByText(/персонаж исключён из истории/i)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Миссия 01 · Лишний пассажир' })).toBeInTheDocument();
    expect(screen.queryByText('MISSION_01')).not.toBeInTheDocument();
    const navigation = screen.getByRole('navigation', { name: 'Разделы игры' });
    await user.click(within(navigation).getByRole('button', { name: 'АРХИВ' }));
    expect(screen.getByRole('heading', { name: 'АРХИВ ВАГОНА' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: members[0].realName.toLocaleUpperCase('ru-RU') })).toBeInTheDocument();
  });
});
