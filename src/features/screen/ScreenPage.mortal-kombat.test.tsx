import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MkTournamentProjection } from '../mortalKombat/mk.types';
import { ScreenPage, type ScreenPageDependencies } from './ScreenPage';

const liveFight: MkTournamentProjection = {
  status: 'active',
  tournamentId: 't1',
  state: 'active',
  activeCount: 16,
  maxPlayers: 16,
  ownRegistrationStatus: null,
  waitlistPosition: null,
  players: [
    { registrationId: 'r1', guestId: 'g1', displayName: 'Сергей', seed: 1 },
    { registrationId: 'r2', guestId: 'g2', displayName: 'Максим', seed: 2 },
  ],
  matches: [{
    id: 'm1', matchKey: 'r16-1', round: 'r16', position: 1,
    player1GuestId: 'g1', player2GuestId: 'g2', winnerGuestId: null,
    status: 'ready', current: true,
  }],
  championGuestId: null,
};

describe('ScreenPage Mortal Kombat integration', () => {
  it('replaces idle/quiz presentation with the authoritative current fight and suppresses arrival overlays', async () => {
    let emitScreenEvent: ((event: {
      id: string; kind: 'guest_registered'; guestId: string; firstName: string; lastName: string;
      ticketNumber: string; carriageLabel: string; carriageAccentHex: string; createdAt: string;
    }) => void) | undefined;
    const dependencies: ScreenPageDependencies = {
      subscribe: (callback) => {
        emitScreenEvent = callback as typeof emitScreenEvent;
        return vi.fn();
      },
      loadMortalKombat: vi.fn().mockResolvedValue(liveFight),
      subscribeToMkRefresh: () => vi.fn(),
    };

    render(<ScreenPage joinUrl="https://wedding.test/join" dependencies={dependencies} />);

    expect(await screen.findByText('ТЕКУЩИЙ БОЙ')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Сергей' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Максим' })).toBeInTheDocument();

    act(() => {
      emitScreenEvent?.({
        id: 'event-guest-1', kind: 'guest_registered', guestId: 'guest-1', firstName: 'Поздний', lastName: 'Гость',
        ticketNumber: 'LV-039', carriageLabel: 'ВАГОН №4', carriageAccentHex: '#31483A',
        createdAt: '2026-08-30T16:00:00.000Z',
      });
    });

    expect(screen.queryByText('Поздний')).not.toBeInTheDocument();
    expect(screen.getByText('ТЕКУЩИЙ БОЙ')).toBeInTheDocument();
  });
});