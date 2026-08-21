import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MkTournamentProjection } from '../mortalKombat/mk.types';
import { ScreenPage, type ScreenPageDependencies } from './ScreenPage';
import type { ScreenPresentationEvent } from './screenEvents.realtime';

const liveFight: MkTournamentProjection = {
  status: 'active',
  tournamentId: 't1',
  state: 'active',
  activeCount: 16,
  maxPlayers: 40,
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
  presentOnMainScreen: true,
};

describe('ScreenPage Mortal Kombat integration', () => {
  it('replaces idle/quiz presentation with the authoritative current fight and suppresses arrival overlays', async () => {
    let emitScreenEvent: ((event: ScreenPresentationEvent) => void) | undefined;
    const dependencies: ScreenPageDependencies = {
      subscribe: (callback) => {
        emitScreenEvent = callback;
        return vi.fn();
      },
      loadMortalKombat: vi.fn().mockResolvedValue(liveFight),
      subscribeToMkRefresh: () => vi.fn(),
    };

    render(<ScreenPage joinUrl="https://wedding.test/join" dependencies={dependencies} />);

    expect(await screen.findByText('ТЕКУЩИЙ БОЙ')).toBeInTheDocument();
    expect(screen.getByText('ТЕКУЩИЙ БОЙ').closest('.screen-page')).toHaveClass('screen-page--mk');
    expect(screen.getByRole('heading', { name: 'Сергей' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Максим' })).toBeInTheDocument();

    act(() => {
      emitScreenEvent?.({
        id: 'event-guest-1',
        kind: 'guest_registered',
        createdAt: '2026-08-30T16:00:00.000Z',
        payload: {
          displayName: 'Поздний Гость',
          carriage: {
            id: 'carriage-4',
            number: 4,
            label: 'ВАГОН №4',
            accentHex: '#31483A',
            visualMark: '04',
          },
        },
      });
    });

    expect(screen.queryByText('Поздний Гость')).not.toBeInTheDocument();
    expect(screen.getByText('ТЕКУЩИЙ БОЙ')).toBeInTheDocument();
  });

  it('stops an active arrival recording when Mortal Kombat protection takes over the projector', async () => {
    let emitScreenEvent: ((event: ScreenPresentationEvent) => void) | undefined;
    let refreshMk: (() => void) | undefined;
    const stopArrivalAudio = vi.fn();
    const loadMortalKombat = vi
      .fn()
      .mockResolvedValueOnce({ status: 'idle' } satisfies MkTournamentProjection)
      .mockResolvedValueOnce(liveFight);
    const dependencies: ScreenPageDependencies = {
      subscribe: (callback) => {
        emitScreenEvent = callback;
        return vi.fn();
      },
      loadMortalKombat,
      subscribeToMkRefresh: (callback) => {
        refreshMk = callback;
        return vi.fn();
      },
      playArrivalSignal: vi.fn(),
      stopArrivalAudio,
    };

    render(<ScreenPage joinUrl="https://wedding.test/join" dependencies={dependencies} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => emitScreenEvent?.({
      id: 'event-before-mk',
      kind: 'guest_registered',
      createdAt: '2026-08-30T16:00:00.000Z',
      payload: {
        displayName: 'Гость Перед Боем',
        carriage: {
          id: 'carriage-2',
          number: 2,
          label: 'ВАГОН №2',
          accentHex: '#31483A',
          visualMark: '02',
        },
      },
    }));
    expect(screen.getByRole('heading', { name: 'Гость Перед Боем' })).toBeInTheDocument();

    act(() => refreshMk?.());
    expect(await screen.findByText('ТЕКУЩИЙ БОЙ')).toBeInTheDocument();

    expect(screen.queryByRole('heading', { name: 'Гость Перед Боем' })).not.toBeInTheDocument();
    expect(stopArrivalAudio).toHaveBeenCalledTimes(1);
  });
});

