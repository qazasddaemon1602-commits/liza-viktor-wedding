import { render, screen, within } from '@testing-library/react';
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

  it('keeps non-captains in a passive discussion state without disabled action controls', () => {
    render(<MissionThreePlayer model={{
      ...base,
      memberRole: 'member',
      pendingCommitments: [{ problemKey: 'injury', status: 'pending', label: 'Медицинская помощь Анны' }],
    }} onConfirm={vi.fn()} onUseAbility={vi.fn()} />);

    expect(screen.getByRole('status', { name: 'Ожидание решения капитана' })).toHaveTextContent(/капитан вагона/i);
    expect(screen.queryByRole('button', { name: 'ПОДТВЕРДИТЬ РАСПРЕДЕЛЕНИЕ' })).not.toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    const extras = screen.getByText('ДОПОЛНИТЕЛЬНО').closest('details');
    expect(extras).not.toBeNull();
    expect(extras).not.toHaveAttribute('open');
    expect(within(extras as HTMLElement).getByRole('button', { name: /применить мою способность/i })).not.toBeVisible();
    expect(within(extras as HTMLElement).getByText(/предложено способностей: 1/i)).not.toBeVisible();
  });

  it('keeps the captain selection and restores confirmation after a rejected command', async () => {
    const user = userEvent.setup();
    const confirm = vi.fn().mockRejectedValue(new Error('offline'));
    render(<MissionThreePlayer model={base} onConfirm={confirm} />);

    const injury = screen.getByRole('checkbox', { name: /ранен пассажир/i });
    await user.click(injury);
    await user.click(screen.getByRole('button', { name: 'ПОДТВЕРДИТЬ РАСПРЕДЕЛЕНИЕ' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/не удалось подтвердить.*попробуйте ещё раз/i);
    expect(injury).toBeChecked();
    expect(screen.getByRole('button', { name: 'ПОДТВЕРДИТЬ РАСПРЕДЕЛЕНИЕ' })).toBeEnabled();
  });

  it('restores the secondary ability action after a rejected command', async () => {
    const user = userEvent.setup();
    const useAbility = vi.fn().mockRejectedValue(new Error('offline'));
    render(<MissionThreePlayer model={base} onUseAbility={useAbility} />);

    await user.click(screen.getByText('ДОПОЛНИТЕЛЬНО'));
    const action = screen.getByRole('button', { name: /применить мою способность/i });
    await user.click(action);

    expect(await screen.findByRole('alert')).toHaveTextContent(/способность не применена.*попробуйте ещё раз/i);
    expect(action).toBeEnabled();
  });
});
