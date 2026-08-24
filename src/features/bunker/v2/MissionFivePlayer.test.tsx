import { render, screen, within } from '@testing-library/react';
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
