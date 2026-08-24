import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CarriageMapScreen } from './CarriageMapScreen';
import { parseRegistrationCarriageMap } from './carriageMap.service';

const baseMap = () => ({
  status: 'registration' as const,
  expectedGuestCount: 40,
  registeredGuestCount: 1,
  serverNow: '2026-08-30T10:00:00.000Z',
  unassignedCount: 0,
  carriages: [
    {
      id: 'carriage-1',
      number: 1,
      label: 'ВАГОН №1',
      accentHex: '#31483A',
      visualMark: '01',
      guests: [
        { id: 'guest-1', fullName: 'Александр Петров', initials: 'АП', seatIndex: 1 },
      ],
    },
    {
      id: 'carriage-2',
      number: 2,
      label: 'ВАГОН №2',
      accentHex: '#31483A',
      visualMark: '02',
      guests: [],
    },
  ],
});

describe('carriage full passenger names', () => {
  it('parses and renders the full first name and surname', () => {
    const parsed = parseRegistrationCarriageMap(baseMap());
    expect(parsed?.carriages[0].guests[0]).toMatchObject({
      fullName: 'Александр Петров',
      initials: 'АП',
    });

    if (!parsed) throw new Error('Expected a valid carriage map');
    render(<CarriageMapScreen map={parsed} />);

    const wagon = screen.getByRole('group', { name: 'ВАГОН №1' });
    expect(within(wagon).getByText('Александр Петров')).toHaveAttribute(
      'aria-label',
      'Гость Александр Петров, место 1, вагон 1',
    );
  });

  it('keeps initials as a backwards-compatible fallback during rolling deploys', () => {
    const legacy = baseMap();
    delete (legacy.carriages[0].guests[0] as { fullName?: string }).fullName;
    const parsed = parseRegistrationCarriageMap(legacy);
    if (!parsed) throw new Error('Expected legacy carriage map to remain valid');

    render(<CarriageMapScreen map={parsed} />);
    const wagon = screen.getByRole('group', { name: 'ВАГОН №1' });
    expect(within(wagon).getByText('АП')).toBeInTheDocument();
  });
});
