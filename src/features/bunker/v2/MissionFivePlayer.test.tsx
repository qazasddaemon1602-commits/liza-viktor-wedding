import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MissionFivePlayer, type MissionFivePlayerReadModel } from './MissionFivePlayer';

const base: MissionFivePlayerReadModel = {
  instanceId: 'm5', status: 'active', remainingSeconds: 90, title: 'Один шанс', intro: 'У вас 90 секунд. Выберите маршрут вагона.',
  routes: [
    { key: 'A', title: 'Технический тоннель', description: 'Короче, но нестабильнее.', risk: 'Повышенный риск повреждений.' },
    { key: 'B', title: 'Обходной путь', description: 'Дольше, но безопаснее.', risk: 'Можно потерять время.' },
  ],
  selectedVote: null, voteCounts: { A: 1, B: 1, total: 2, required: 4 },
  ability: { available: true, key: 'route_analysis', label: 'Анализ маршрута', hint: 'Можно запросить техническую подсказку.' },
  connection: 'online',
};

describe('MissionFivePlayer', () => {
  it('shows exactly two large primary route choices while keeping totals and abilities secondary', () => {
    render(<MissionFivePlayer model={base} onVote={vi.fn()} onUseAbility={vi.fn()} />);

    const primary = screen.getByRole('region', { name: 'Выберите маршрут' });
    expect(within(primary).getAllByRole('button')).toHaveLength(2);
    expect(within(primary).getByRole('button', { name: /A · ТЕХНИЧЕСКИЙ ТОННЕЛЬ/i })).toBeInTheDocument();
    expect(within(primary).getByRole('button', { name: /B · ОБХОДНОЙ ПУТЬ/i })).toBeInTheDocument();
    const details = screen.getByText('ДЕТАЛИ ГОЛОСОВАНИЯ').closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
    expect(screen.getByRole('button', { name: /ИСПОЛЬЗОВАТЬ · АНАЛИЗ МАРШРУТА/i, hidden: true })).not.toBeVisible();
  });

  it('submits one route choice through the existing vote action', async () => {
    const user = userEvent.setup();
    const vote = vi.fn().mockResolvedValue(undefined);
    render(<MissionFivePlayer model={base} onVote={vote} />);
    await user.click(screen.getByRole('button', { name: /A · ТЕХНИЧЕСКИЙ ТОННЕЛЬ/i }));
    expect(vote).toHaveBeenCalledTimes(1);
    expect(vote).toHaveBeenCalledWith('A');
  });

  it('accepts one local vote immediately and keeps both routes locked while projection is deferred', async () => {
    const user = userEvent.setup();
    let resolveVote: (() => void) | undefined;
    const vote = vi.fn(() => new Promise<void>((resolve) => { resolveVote = resolve; }));
    const view = render(<MissionFivePlayer model={base} onVote={vote} />);

    await user.click(screen.getByRole('button', { name: /A · ТЕХНИЧЕСКИЙ ТОННЕЛЬ/i }));

    expect(screen.getByRole('status', { name: 'Состояние вашего выбора' })).toHaveTextContent(/маршрут A принят/i);
    for (const route of within(screen.getByRole('region', { name: 'Выберите маршрут' })).getAllByRole('button')) {
      expect(route).toBeDisabled();
    }

    await act(async () => { resolveVote?.(); });
    view.rerender(<MissionFivePlayer model={{ ...base, remainingSeconds: 89 }} onVote={vote} />);
    for (const route of within(screen.getByRole('region', { name: 'Выберите маршрут' })).getAllByRole('button')) {
      expect(route).toBeDisabled();
    }
    expect(vote).toHaveBeenCalledTimes(1);
  });

  it('restores both routes and shows retry guidance when the vote is rejected', async () => {
    const user = userEvent.setup();
    const vote = vi.fn().mockRejectedValue(new Error('offline'));
    render(<MissionFivePlayer model={base} onVote={vote} />);

    await user.click(screen.getByRole('button', { name: /B · ОБХОДНОЙ ПУТЬ/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/голос не отправлен.*попробуйте ещё раз/i);
    for (const route of within(screen.getByRole('region', { name: 'Выберите маршрут' })).getAllByRole('button')) {
      expect(route).toBeEnabled();
    }
    expect(screen.queryByRole('status', { name: 'Состояние вашего выбора' })).not.toBeInTheDocument();
  });

  it('keeps a projected accepted vote locked when the original command rejects afterward', async () => {
    const user = userEvent.setup();
    let rejectVote: ((reason?: unknown) => void) | undefined;
    const vote = vi.fn(() => new Promise<void>((_resolve, reject) => { rejectVote = reject; }));
    const view = render(<MissionFivePlayer model={base} onVote={vote} />);

    await user.click(screen.getByRole('button', { name: /A · ТЕХНИЧЕСКИЙ ТОННЕЛЬ/i }));
    view.rerender(<MissionFivePlayer model={{ ...base, selectedVote: 'A' }} onVote={vote} />);

    await act(async () => { rejectVote?.(new Error('response lost after projection')); });

    expect(screen.getByRole('status', { name: 'Состояние вашего выбора' })).toHaveTextContent(/маршрут A принят/i);
    for (const route of within(screen.getByRole('region', { name: 'Выберите маршрут' })).getAllByRole('button')) {
      expect(route).toBeDisabled();
    }
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(vote).toHaveBeenCalledTimes(1);
  });

  it('restores the secondary ability action after a rejected command', async () => {
    const user = userEvent.setup();
    const useAbility = vi.fn().mockRejectedValue(new Error('offline'));
    render(<MissionFivePlayer model={base} onVote={vi.fn()} onUseAbility={useAbility} />);

    await user.click(screen.getByText('ДЕТАЛИ ГОЛОСОВАНИЯ'));
    const action = screen.getByRole('button', { name: /ИСПОЛЬЗОВАТЬ · АНАЛИЗ МАРШРУТА/i });
    await user.click(action);

    expect(await screen.findByRole('alert')).toHaveTextContent(/подсказку не удалось получить.*попробуйте ещё раз/i);
    expect(action).toBeEnabled();
  });

  it('shows the accepted choice and waiting state without exposing live totals in the primary path', () => {
    render(<MissionFivePlayer model={{ ...base, selectedVote: 'B' }} />);

    const status = screen.getByRole('status', { name: 'Состояние вашего выбора' });
    expect(status).toHaveTextContent(/маршрут B принят/i);
    expect(status).toHaveTextContent(/ждём большинство замороженного состава/i);
    expect(screen.getByRole('button', { name: /B · ОБХОДНОЙ ПУТЬ/i })).toBeDisabled();
    expect(screen.getByRole('region', { name: 'Выберите маршрут' })).not.toHaveTextContent(/A 1 · B 1|4 голос/i);
  });

  it('shows resolved consequences only after server completion', () => {
    render(<MissionFivePlayer model={{ ...base, status: 'completed', outcome: { routeChoice: 'A', routeBonusMinutes: 7, trackDamage: 0, powerInstability: 0, sector04Found: true, tier: 'best' } }} />);
    expect(screen.getByText(/МАРШРУТ A ПРИНЯТ/i)).toBeInTheDocument();
    expect(screen.getByText(/\+7 мин/i)).toBeInTheDocument();
    expect(screen.getByText(/СЕКТОР 04/i)).toBeInTheDocument();
  });

  it('renders the safe B detour as negative minutes without a fake plus sign', () => {
    render(<MissionFivePlayer model={{ ...base, status: 'completed', outcome: { routeChoice: 'B', routeBonusMinutes: -5, trackDamage: 0, powerInstability: 0, sector04Found: false, tier: 'safe', fallback: true } }} />);
    expect(screen.getByText(/-5 мин/i)).toBeInTheDocument();
    expect(screen.queryByText(/\+-5/)).not.toBeInTheDocument();
  });
});
