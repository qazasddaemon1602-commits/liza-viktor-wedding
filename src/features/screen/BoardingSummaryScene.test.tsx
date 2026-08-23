import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BoardingSummaryScene } from './BoardingSummaryScene';
import type { RegistrationCarriageMap } from './carriageMap.service';

const map: RegistrationCarriageMap = {
  status: 'registration',
  expectedGuestCount: 40,
  registeredGuestCount: 5,
  unassignedCount: 0,
  serverNow: '2026-08-30T12:00:00.000Z',
  carriages: [
    {
      id: 'c2', number: 2, label: 'ВАГОН №2', accentHex: '#31483A', visualMark: '02',
      guests: [
        { id: 'g1', initials: 'ИП', seatIndex: 1 },
        { id: 'g2', initials: 'АС', seatIndex: 2 },
        { id: 'g3', initials: 'МК', seatIndex: 3 },
      ],
    },
    {
      id: 'c4', number: 4, label: 'ВАГОН №4', accentHex: '#78806A', visualMark: '04',
      guests: [{ id: 'g4', initials: 'ОВ', seatIndex: 1 }, { id: 'g5', initials: 'ЕК', seatIndex: 2 }],
    },
  ],
};

const summary = {
  kind: 'boarding_summary' as const,
  eventIds: ['a1', 'a2', 'a3', 'a4'],
  count: 4,
  carriageIds: ['c2', 'c4'],
};

describe('BoardingSummaryScene', () => {
  it('renders a privacy-safe compact summary using the latest authoritative map totals', () => {
    const { container } = render(<BoardingSummaryScene summary={summary} map={map} />);
    expect(screen.getByText('СОСТАВ ПОПОЛНЕН · +4')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Состав пополнен: 4 пассажира');
    expect(screen.getByRole('status')).toHaveTextContent('ВАГОН №2 — 3 пассажира');
    expect(container.textContent).not.toContain('Иван Петров');
    expect(container.innerHTML).not.toContain('a1');
  });

  it('shows every active carriage and seated initials without the full-map ornament or host portrait', () => {
    render(<BoardingSummaryScene summary={summary} map={map} />);
    expect(screen.getAllByRole('group', { name: /ВАГОН №/ })).toHaveLength(2);
    expect(within(screen.getByRole('group', { name: 'ВАГОН №2' })).getByText('ИП')).toBeInTheDocument();
    expect(screen.queryByText('КАРТА СОСТАВА')).not.toBeInTheDocument();
    expect(screen.queryByTestId('carriage-map-host')).not.toBeInTheDocument();
  });
});
