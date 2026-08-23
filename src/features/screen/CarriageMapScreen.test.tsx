import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CarriageMapScreen } from './CarriageMapScreen';
import type { RegistrationCarriageMap } from './carriageMap.service';

const makeMap = (carriageCount: number): RegistrationCarriageMap => ({
  status: 'registration',
  expectedGuestCount: 40,
  registeredGuestCount: 3,
  serverNow: '2026-08-30T10:00:00.000Z',
  unassignedCount: 1,
  carriages: Array.from({ length: carriageCount }, (_, index) => ({
    id: `carriage-${index + 1}`,
    number: index + 1,
    label: `ВАГОН №${index + 1}`,
    accentHex: '#31483A',
    visualMark: String(index + 1).padStart(2, '0'),
    guests: index === 0
      ? [
          { id: 'guest-1', initials: 'АП', seatIndex: 1 },
          { id: 'guest-2', initials: 'ВК', seatIndex: 2 },
        ]
      : [],
  })),
});

describe('CarriageMapScreen', () => {
  it.each([2, 3, 4, 5])('renders %i wagons with an explicit responsive layout hook', (count) => {
    const { container } = render(<CarriageMapScreen map={makeMap(count)} />);

    const grid = container.querySelector('.carriage-map__grid');
    expect(grid).toHaveAttribute('data-carriage-count', String(count));
    expect(screen.getAllByRole('group', { name: /ВАГОН №/ })).toHaveLength(count);
  });

  it('renders stable top-down seats, a center aisle and private-safe accessible labels', () => {
    render(<CarriageMapScreen map={makeMap(2)} />);

    const wagon = screen.getByRole('group', { name: 'ВАГОН №1' });
    expect(within(wagon).getByTestId('carriage-aisle')).toBeInTheDocument();
    expect(within(wagon).getByText('АП')).toHaveAttribute(
      'aria-label',
      'Гость АП, место 1, вагон 1',
    );
    expect(within(wagon).getByRole('img', {
      name: 'Гость АП, место 1, вагон 1',
    })).toBeInTheDocument();
    expect(within(wagon).getByText('ВК')).toHaveAttribute('data-seat-index', '2');
    expect(within(wagon).getByText('АП')).toHaveStyle({ '--seat-column': '1', '--seat-row': '1' });
    expect(within(wagon).getByText('ВК')).toHaveStyle({ '--seat-column': '1', '--seat-row': '3' });
  });

  it('draws eight visual-only empty seats in an empty wagon', () => {
    render(<CarriageMapScreen map={makeMap(2)} />);

    const emptyWagon = screen.getByRole('group', { name: 'ВАГОН №2' });
    expect(within(emptyWagon).getByText('СВОБОДНО')).toBeInTheDocument();
    expect(within(emptyWagon).queryByLabelText(/Гость/)).not.toBeInTheDocument();
    expect(within(emptyWagon).getAllByTestId('empty-seat')).toHaveLength(8);
    expect(within(emptyWagon).getAllByTestId('empty-seat')[0]).toHaveAttribute('aria-hidden', 'true');
  });

  it('adds a deterministic pair of visual-only empty seats after partial occupancy', () => {
    render(<CarriageMapScreen map={makeMap(2)} />);

    const wagon = screen.getByRole('group', { name: 'ВАГОН №1' });
    expect(within(wagon).getAllByRole('img', { name: /Гость/ })).toHaveLength(2);
    expect(within(wagon).getAllByTestId('empty-seat')).toHaveLength(6);
  });

  it('shows registration progress and unassigned guests', () => {
    render(<CarriageMapScreen map={makeMap(2)} />);

    expect(screen.getByText('ЗАРЕГИСТРИРОВАНО 3 ИЗ 40')).toBeInTheDocument();
    expect(screen.getByText('ОЖИДАЮТ НАЗНАЧЕНИЯ: 1')).toBeInTheDocument();
  });

  it('keeps every guest visible and switches to packed density for overflow', () => {
    const map = makeMap(2);
    map.registeredGuestCount = 40;
    map.unassignedCount = 0;
    map.carriages[0].guests = Array.from({ length: 40 }, (_, index) => ({
      id: `guest-${index + 1}`,
      initials: `А${String.fromCharCode(1040 + (index % 26))}`,
      seatIndex: index + 1,
    }));

    render(<CarriageMapScreen map={map} />);

    const wagon = screen.getByRole('group', { name: 'ВАГОН №1' });
    expect(wagon).toHaveAttribute('data-seat-density', 'packed');
    expect(within(wagon).getAllByLabelText(/Гость/)).toHaveLength(40);
    expect(within(wagon).queryAllByTestId('empty-seat')).toHaveLength(0);
    expect(within(wagon).getByLabelText('Гость АЕ, место 6, вагон 1')).toHaveAttribute(
      'data-seat-index',
      '6',
    );
  });

  it('supports the compact variant and an empty/not-found map', () => {
    const missing: RegistrationCarriageMap = {
      status: 'not_found',
      expectedGuestCount: 0,
      registeredGuestCount: 0,
      serverNow: '2026-08-30T10:00:00.000Z',
      unassignedCount: 0,
      carriages: [],
    };
    const { rerender } = render(<CarriageMapScreen map={makeMap(2)} variant="compact" />);
    expect(screen.getByLabelText('Карта вагонов')).toHaveAttribute('data-variant', 'compact');

    rerender(<CarriageMapScreen map={missing} />);
    expect(screen.getByText('СОСТАВ ПОКА НЕ СФОРМИРОВАН')).toBeInTheDocument();
  });
});
