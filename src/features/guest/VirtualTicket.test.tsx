import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VirtualTicket } from './VirtualTicket';

const guest = {
  id: 'guest-31',
  firstName: 'Иван',
  lastName: 'Петров',
  affiliationType: 'viktor',
  affiliationDetail: 'коллега Виктора',
  ticketNumber: 'LV-031',
  carriage: {
    id: 'carriage-3',
    number: 3,
    label: 'ВАГОН №3',
    accentHex: '#7E3F3C',
    visualMark: '03',
  },
};

describe('VirtualTicket', () => {
  it('shows private guest identity, date, ticket number and carriage number', () => {
    render(<VirtualTicket guest={guest} />);

    expect(screen.getByText('Иван Петров')).toBeInTheDocument();
    expect(screen.getByText('30.08.2026')).toBeInTheDocument();
    expect(screen.getByText('LV-031')).toBeInTheDocument();
    expect(screen.getByText('ВАГОН №3')).toBeInTheDocument();
  });

  it('exposes carriage color only as a secondary accent', () => {
    render(<VirtualTicket guest={guest} />);

    const ticket = screen.getByTestId('virtual-ticket');
    expect(ticket).toHaveStyle({ '--carriage-accent': '#7E3F3C' });
    expect(screen.getByText('ВАГОН №3')).toBeVisible();
  });
});
