import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MissionFiveScreen } from './MissionFiveScreen';

describe('MissionFiveScreen', () => {
  it('shows only discussion or accepted-decision states without live vote totals', () => {
    render(<MissionFiveScreen model={{
      title: 'Один шанс',
      remainingSeconds: 72,
      wagons: [
        { wagonId: 'w1', label: 'ВАГОН №1', status: 'active', votesA: 2, votesB: 1, required: 4, routeChoice: null },
        { wagonId: 'w2', label: 'ВАГОН №2', status: 'completed', votesA: 1, votesB: 4, required: 4, routeChoice: 'B' },
      ],
    }} />);

    const activeWagon = screen.getByRole('heading', { name: 'ВАГОН №1' }).closest('article');
    const completedWagon = screen.getByRole('heading', { name: 'ВАГОН №2' }).closest('article');
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(within(activeWagon as HTMLElement).getByText(/обсуждение маршрута/i)).toBeInTheDocument();
    expect(within(activeWagon as HTMLElement).getByText(/решение ещё обсуждается/i)).toBeInTheDocument();
    expect(within(completedWagon as HTMLElement).getByText('МАРШРУТ B')).toBeInTheDocument();
    expect(within(completedWagon as HTMLElement).getByText('РЕШЕНИЕ ПРИНЯТО')).toBeInTheDocument();
    expect(screen.queryByText(/A 2 · B 1|A 1 · B 4|НУЖНО 4 ГОЛОСОВ/)).not.toBeInTheDocument();
  });
});
