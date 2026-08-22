import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MkTournamentProjection } from './mk.types';
import { MortalKombatPage, type MortalKombatPageDependencies } from './MortalKombatPage';

type ActiveProjection = Extract<MkTournamentProjection, { status: 'active' }>;

const openState: ActiveProjection = {
  status: 'active',
  tournamentId: 't1',
  state: 'registration',
  activeCount: 9,
  maxPlayers: 16,
  ownRegistrationStatus: null,
  waitlistPosition: null,
  players: Array.from({ length: 9 }, (_, index) => ({
    registrationId: `r${index + 1}`,
    guestId: `g${index + 1}`,
    displayName: `Игрок ${index + 1}`,
    seed: null,
  })),
  matches: [],
  championGuestId: null,
  presentOnMainScreen: false,
};

const joinedState: ActiveProjection = {
  ...openState,
  activeCount: 10,
  ownRegistrationStatus: 'active',
};

function dependencies(overrides: Partial<MortalKombatPageDependencies> = {}): MortalKombatPageDependencies {
  return {
    load: vi.fn().mockResolvedValue(openState),
    join: vi.fn().mockResolvedValue({
      status: 'joined',
      registrationStatus: 'active',
      activeCount: 10,
      maxPlayers: 16,
      waitlistPosition: null,
    }),
    subscribeToRefresh: () => vi.fn(),
    ...overrides,
  };
}

describe('MortalKombatPage', () => {
  it('uses the server limit everywhere instead of a stale event-wide guest count', async () => {
    const limitedState: ActiveProjection = {
      ...openState,
      activeCount: 7,
      maxPlayers: 12,
    };

    render(<MortalKombatPage dependencies={dependencies({ load: vi.fn().mockResolvedValue(limitedState) })} />);

    expect(await screen.findAllByText(/7 \/ 12/)).not.toHaveLength(0);
    expect(screen.getByText('ПОСЛЕДНИЙ КРУГ · 12 МЕСТ')).toBeInTheDocument();
    expect(screen.queryByText(/\/ 40/)).not.toBeInTheDocument();
  });

  it('lets an already registered wedding guest join without entering their name again', async () => {
    const user = userEvent.setup();
    const load = vi.fn()
      .mockResolvedValueOnce(openState)
      .mockResolvedValueOnce(joinedState);
    const join = vi.fn().mockResolvedValue({
      status: 'joined',
      registrationStatus: 'active',
      activeCount: 10,
      maxPlayers: 16,
      waitlistPosition: null,
    });

    render(<MortalKombatPage dependencies={dependencies({ load, join })} />);

    expect(await screen.findByRole('button', { name: 'УЧАСТВОВАТЬ В БИТВЕ' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('9 / 16')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'УЧАСТВОВАТЬ В БИТВЕ' }));

    expect(join).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('ВЫ В ТУРНИРЕ · 10 / 16')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'УЧАСТВОВАТЬ В БИТВЕ' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ВЕРНУТЬСЯ К БИЛЕТУ' })).toHaveAttribute('href', '/join');
  });

  it('shows the return-to-ticket link for waitlisted guests', async () => {
    const waitlistState: ActiveProjection = {
      ...openState,
      activeCount: 16,
      ownRegistrationStatus: 'waitlist',
      waitlistPosition: 3,
    };
    render(<MortalKombatPage dependencies={dependencies({ load: vi.fn().mockResolvedValue(waitlistState) })} />);

    expect(await screen.findByText('ЛИСТ ОЖИДАНИЯ · №3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ВЕРНУТЬСЯ К БИЛЕТУ' })).toHaveAttribute('href', '/join');
  });

  it('reloads the public bracket when a safe realtime refresh arrives', async () => {
    let refresh: (() => void) | undefined;
    const load = vi.fn()
      .mockResolvedValueOnce(openState)
      .mockResolvedValueOnce(joinedState);

    render(
      <MortalKombatPage
        dependencies={dependencies({
          load,
          subscribeToRefresh: (callback) => {
            refresh = callback;
            return vi.fn();
          },
        })}
      />,
    );

    await screen.findByText('9 / 16');
    await act(async () => {
      refresh?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(load).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('ВЫ В ТУРНИРЕ · 10 / 16')).toBeInTheDocument();
  });

  it('uses an original wedding arena identity without official game copy', async () => {
    render(<MortalKombatPage dependencies={dependencies()} />);

    expect(await screen.findByRole('heading', { name: 'АРЕНА ПОСЛЕДНИЙ КРУГ' })).toBeInTheDocument();
    expect(screen.getByText('СВАДЕБНЫЙ ТУРНИРНЫЙ АРХИВ')).toBeInTheDocument();
    expect(screen.queryByText(/MORTAL KOMBAT/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/FINISH HIM/i)).not.toBeInTheDocument();
  });

  it('art-directs the tournament hero for desktop and mobile without replacing live copy', async () => {
    render(<MortalKombatPage dependencies={dependencies()} />);

    const artwork = await screen.findByTestId('tournament-hero-art');
    const picture = artwork.closest('picture');
    expect(artwork).toHaveAttribute('src', '/images/tournament/arena-wide.png');
    expect(artwork).toHaveAttribute('alt', '');
    expect(artwork).toHaveAttribute('width', '1672');
    expect(artwork).toHaveAttribute('height', '941');
    expect(picture).toHaveAttribute('aria-hidden', 'true');
    expect(picture?.querySelector('source[media="(max-width: 900px)"][type="image/avif"]')).toHaveAttribute(
      'srcset',
      '/images/tournament/arena-mobile-720.avif 720w, /images/tournament/arena-mobile-1086.avif 1086w',
    );
    expect(picture?.querySelector('source[type="image/avif"]:not([media])')).toHaveAttribute(
      'srcset',
      '/images/tournament/arena-wide-960.avif 960w, /images/tournament/arena-wide-1672.avif 1672w',
    );
    expect(screen.getByRole('heading', { name: 'АРЕНА ПОСЛЕДНИЙ КРУГ' })).toBeInTheDocument();
  });
});

