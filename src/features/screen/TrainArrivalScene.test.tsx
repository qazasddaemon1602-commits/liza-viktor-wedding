import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TrainArrivalScene } from './TrainArrivalScene';

const event = {
  id: 'screen-event-1',
  kind: 'guest_registered' as const,
  createdAt: '2026-08-30T12:06:00+05:00',
  payload: {
    displayName: 'Анна Смирнова',
    carriage: {
      id: 'c4',
      number: 4,
      label: 'ВАГОН №4',
      accentHex: '#78806A',
      visualMark: '04',
    },
  },
};

describe('TrainArrivalScene', () => {
  it('announces who arrived and exactly which carriage they joined', () => {
    const onSignal = vi.fn();

    render(<TrainArrivalScene event={event} onSignal={onSignal} />);

    expect(screen.getByText('НОВЫЙ ПАССАЖИР')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Анна Смирнова' })).toBeInTheDocument();
    expect(screen.getAllByText('ВАГОН №4')).toHaveLength(2);
    expect(screen.getByTestId('train-arrival-scene')).toHaveStyle({ '--arrival-accent': '#78806A' });
    expect(onSignal).toHaveBeenCalledTimes(1);
  });
});
