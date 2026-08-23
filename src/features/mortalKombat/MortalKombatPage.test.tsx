import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

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
  afterEach(() => {
    vi.useRealTimers();
  });

  it('recovers from an initial loading failure without remounting', async () => {
    vi.useFakeTimers();
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(openState);

    render(<MortalKombatPage dependencies={dependencies({ load })} />);

    await settle();
    expect(screen.getByRole('heading', { name: 'АРЕНА ПОКА НЕДОСТУПНА' })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(load).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'УЧАСТВОВАТЬ В БИТВЕ' })).toBeInTheDocument();
  });

  it('lets a guest retry a full-page loading failure immediately', async () => {
    const user = userEvent.setup();
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(openState);

    render(<MortalKombatPage dependencies={dependencies({ load })} />);

    expect(await screen.findByRole('heading', { name: 'АРЕНА ПОКА НЕДОСТУПНА' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ПОВТОРИТЬ' }));

    expect(load).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole('button', { name: 'УЧАСТВОВАТЬ В БИТВЕ' })).toBeInTheDocument();
  });

  it('polls an idle arena until registration opens when realtime is missed', async () => {
    vi.useFakeTimers();
    const load = vi.fn()
      .mockResolvedValueOnce({ status: 'idle' } satisfies MkTournamentProjection)
      .mockResolvedValueOnce(openState);

    render(<MortalKombatPage dependencies={dependencies({ load })} />);

    await settle();
    expect(screen.getByRole('heading', { name: 'РЕГИСТРАЦИЯ ЕЩЁ НЕ ОТКРЫТА' })).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(load).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'УЧАСТВОВАТЬ В БИТВЕ' })).toBeInTheDocument();
  });

  it('polls an active arena every ten seconds to converge missed updates', async () => {
    vi.useFakeTimers();
    const load = vi.fn()
      .mockResolvedValueOnce(openState)
      .mockResolvedValueOnce(joinedState);

    render(<MortalKombatPage dependencies={dependencies({ load })} />);

    await settle();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_999);
    });
    expect(load).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(load).toHaveBeenCalledTimes(2);
    expect(screen.getByText('ВЫ В ТУРНИРЕ · 10 / 16')).toBeInTheDocument();
  });

  it('deduplicates refreshes while a tournament load is in flight', async () => {
    const pendingLoad = deferred<MkTournamentProjection>();
    const load = vi.fn().mockReturnValue(pendingLoad.promise);
    let refresh: (() => void) | undefined;

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

    await act(async () => {
      refresh?.();
      refresh?.();
      await Promise.resolve();
    });

    expect(load).toHaveBeenCalledTimes(1);

    await act(async () => {
      pendingLoad.resolve(openState);
      await Promise.resolve();
    });
  });

  it('cancels the scheduled reload and realtime subscription on unmount', async () => {
    vi.useFakeTimers();
    const unsubscribe = vi.fn();

    const { unmount } = render(
      <MortalKombatPage
        dependencies={dependencies({
          load: vi.fn().mockResolvedValue({ status: 'idle' }),
          subscribeToRefresh: () => unsubscribe,
        })}
      />,
    );

    await settle();
    expect(screen.getByRole('heading', { name: 'РЕГИСТРАЦИЯ ЕЩЁ НЕ ОТКРЫТА' })).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the last valid tournament state visible after a later load error', async () => {
    let refresh: (() => void) | undefined;
    const load = vi.fn()
      .mockResolvedValueOnce(openState)
      .mockRejectedValueOnce(new Error('network unavailable'));

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

    expect(await screen.findByText('9 / 16')).toBeInTheDocument();
    await act(async () => {
      refresh?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole('heading', { name: 'АРЕНА ПОСЛЕДНИЙ КРУГ' })).toBeInTheDocument();
    expect(screen.getByText('9 / 16')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить турнир. Проверьте связь.');
  });

  it('keeps idle content actionable after a later tournament load error', async () => {
    let refresh: (() => void) | undefined;
    const load = vi.fn()
      .mockResolvedValueOnce({ status: 'idle' } satisfies MkTournamentProjection)
      .mockRejectedValueOnce(new Error('network unavailable'));

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

    await settle();
    await act(async () => {
      refresh?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole('heading', { name: 'РЕГИСТРАЦИЯ ЕЩЁ НЕ ОТКРЫТА' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить турнир. Проверьте связь.');
    expect(screen.getByRole('button', { name: 'ПОВТОРИТЬ' })).toBeInTheDocument();
  });

  it('returns to a two-second recovery cadence after an active load error', async () => {
    vi.useFakeTimers();
    let refresh: (() => void) | undefined;
    const load = vi.fn()
      .mockResolvedValueOnce(openState)
      .mockRejectedValueOnce(new Error('network unavailable'))
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

    await settle();
    await act(async () => {
      refresh?.();
      await Promise.resolve();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1_999);
    });
    expect(load).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(load).toHaveBeenCalledTimes(3);
    expect(screen.getByText('ВЫ В ТУРНИРЕ · 10 / 16')).toBeInTheDocument();
  });

  it('uses the 16-player tournament limit instead of a stale event-wide guest count', async () => {
    const limitedState: ActiveProjection = {
      ...openState,
      activeCount: 7,
      maxPlayers: 16,
    };

    render(<MortalKombatPage dependencies={dependencies({ load: vi.fn().mockResolvedValue(limitedState) })} />);

    expect(await screen.findAllByText(/7 \/ 16/)).not.toHaveLength(0);
    expect(screen.getByText('ПОСЛЕДНИЙ КРУГ · 16 МЕСТ')).toBeInTheDocument();
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

  it('queues join reconciliation behind an in-flight tournament reload', async () => {
    const user = userEvent.setup();
    const inFlightReload = deferred<MkTournamentProjection>();
    const joinedReload = deferred<MkTournamentProjection>();
    const load = vi.fn()
      .mockResolvedValueOnce(openState)
      .mockReturnValueOnce(inFlightReload.promise)
      .mockReturnValueOnce(joinedReload.promise);
    const join = vi.fn().mockResolvedValue({
      status: 'joined',
      registrationStatus: 'active',
      activeCount: 10,
      maxPlayers: 16,
      waitlistPosition: null,
    });
    let refresh: (() => void) | undefined;

    render(
      <MortalKombatPage
        dependencies={dependencies({
          load,
          join,
          subscribeToRefresh: (callback) => {
            refresh = callback;
            return vi.fn();
          },
        })}
      />,
    );

    expect(await screen.findByRole('button', { name: 'УЧАСТВОВАТЬ В БИТВЕ' })).toBeInTheDocument();
    refresh?.();
    await user.click(screen.getByRole('button', { name: 'УЧАСТВОВАТЬ В БИТВЕ' }));
    await settle();

    expect(load).toHaveBeenCalledTimes(2);

    await act(async () => {
      inFlightReload.resolve(openState);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(load).toHaveBeenCalledTimes(3);

    await act(async () => {
      joinedReload.resolve(joinedState);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('ВЫ В ТУРНИРЕ · 10 / 16')).toBeInTheDocument();
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
    expect(screen.getByText('ОСНОВНАЯ СЕТКА ЗАПОЛНЕНА · 16 ИЗ 16. ВЫ В ЛИСТЕ ОЖИДАНИЯ · №3.')).toBeInTheDocument();
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

