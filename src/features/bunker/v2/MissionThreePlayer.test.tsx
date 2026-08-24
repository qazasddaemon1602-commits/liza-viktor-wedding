import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MissionThreePlayer, type MissionThreePlayerReadModel } from './MissionThreePlayer';

const base: MissionThreePlayerReadModel = {
  instanceId: 'm3', instanceVersion: 1, status: 'active', remainingSeconds: 360,
  title: 'Аварийный запас', intro: 'Выберите, какие три проблемы вагон успеет закрыть.', memberRole: 'captain',
  problems: [
    { key: 'injury', title: 'Ранен пассажир', risk: 'Состояние ухудшится.', itemKey: 'medkit' },
    { key: 'communication', title: 'Пропадает связь', risk: 'Связь пропадёт.', itemKey: 'radio' },
    { key: 'power', title: 'Падает питание', risk: 'Системы отключатся.', itemKey: 'generator' },
  ],
  inventory: [{ itemKey: 'medkit', quantity: 1, status: 'available' }, { itemKey: 'radio', quantity: 1, status: 'available' }],
  selectedProblems: [], ability: { available: true, key: 'medical_help', problemKey: 'injury', label: 'Медицинская помощь' }, pendingCommitments: [], connection: 'online',
};

describe('MissionThreePlayer', () => {
  it('gives the captain the main choice, disables problems without a usable item, and preserves the confirm payload', async () => {
    const user = userEvent.setup();
    const confirm = vi.fn().mockResolvedValue(undefined);
    render(<MissionThreePlayer model={base} onConfirm={confirm} onUseAbility={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /выберите до трёх проблем/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /падает питание/i })).toBeDisabled();
    expect(screen.getByText(/требуется генератор/i)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /ранен пассажир/i }));
    await user.click(screen.getByRole('button', { name: 'ПОДТВЕРДИТЬ РАСПРЕДЕЛЕНИЕ' }));
    expect(confirm).toHaveBeenCalledWith(['injury']);
  });

  it('keeps non-captains in a passive discussion state while their ability remains secondary', () => {
    render(<MissionThreePlayer model={{ ...base, memberRole: 'member' }} onConfirm={vi.fn()} onUseAbility={vi.fn()} />);

    expect(screen.getByRole('status', { name: 'Ожидание решения капитана' })).toHaveTextContent(/капитан вагона/i);
    expect(screen.queryByRole('button', { name: 'ПОДТВЕРДИТЬ РАСПРЕДЕЛЕНИЕ' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /применить мою способность/i })).toBeInTheDocument();
    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect(checkbox).toBeDisabled();
    }
  });
});
