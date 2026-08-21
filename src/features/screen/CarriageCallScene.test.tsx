import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CarriageCallScene } from './CarriageCallScene';
import type { CarriageCallScreenEvent } from './screenEvents.realtime';

const event: CarriageCallScreenEvent = {
  id: 'screen-call-1',
  kind: 'carriage_call',
  createdAt: '2026-08-30T13:10:00+05:00',
  payload: {
    callId: 'call-1',
    message: 'ВАГОНЫ 2 И 4 — ГОТОВИМСЯ К СЛЕДУЮЩЕМУ КОНКУРСУ',
    carriages: [
      { id: 'c2', number: 2, label: 'ВАГОН №2', accentHex: '#9A6348', visualMark: '02' },
      { id: 'c4', number: 4, label: 'ВАГОН №4', accentHex: '#78806A', visualMark: '04' },
    ],
  },
};

describe('CarriageCallScene', () => {
  it('shows the owner-approved message and exactly the target carriages', () => {
    render(<CarriageCallScene event={event} />);

    expect(screen.getByText('ОБЪЯВЛЕНИЕ ПО СОСТАВУ')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: event.payload.message })).toBeInTheDocument();
    expect(screen.getByText('ВАГОН №2')).toBeInTheDocument();
    expect(screen.getByText('ВАГОН №4')).toBeInTheDocument();
    expect(screen.getByTestId('carriage-call-c2')).toHaveStyle({ '--call-accent': '#9A6348' });
    expect(screen.getByTestId('carriage-call-c4')).toHaveStyle({ '--call-accent': '#78806A' });
    expect(screen.queryByText('НОВЫЙ ПАССАЖИР')).not.toBeInTheDocument();
    expect(screen.getByTestId('carriage-call-train')).toHaveAttribute(
      'src',
      '/images/wedding/arrival-train-sprite-v2.png',
    );
    expect(screen.getByTestId('carriage-call-manifest')).toHaveAttribute('data-motion', 'rail-call');
  });
});
