import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JoinPage, type JoinPageDependencies } from './JoinPage';

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

function dependencies(overrides: Partial<JoinPageDependencies> = {}): JoinPageDependencies {
  return {
    getDeviceKey: () => 'lvw_device_1',
    restore: vi.fn().mockResolvedValue({ status: 'not_found' }),
    register: vi.fn(),
    recover: vi.fn().mockResolvedValue({ status: 'invalid_or_expired' }),
    ...overrides,
  };
}

describe('JoinPage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('restores the existing guest from the same device and opens their ticket', async () => {
    const restore = vi.fn().mockResolvedValue({ status: 'restored', guest });
    render(<JoinPage dependencies={dependencies({ restore })} />);

    expect(await screen.findByText('Иван Петров')).toBeInTheDocument();
    expect(screen.getByTestId('virtual-ticket')).toHaveTextContent('LV-031');
    expect(restore).toHaveBeenCalledWith('lvw_device_1');
  });

  it('offers the registered guest a neutral direct arena entry without another signup form', async () => {
    const restore = vi.fn().mockResolvedValue({ status: 'restored', guest });
    render(<JoinPage dependencies={dependencies({ restore })} />);

    await screen.findByTestId('virtual-ticket');
    const arenaLink = screen.getByRole('link', { name: 'ПОСЛЕДНИЙ КРУГ · УЧАСТВОВАТЬ' });
    expect(arenaLink).toHaveAttribute('href', '/mortal-kombat');
    expect(screen.queryByText(/MORTAL KOMBAT|FATALITY/i)).not.toBeInTheDocument();
  });

  it('shows registration when the device has no existing guest binding', async () => {
    render(<JoinPage dependencies={dependencies()} />);

    expect(await screen.findByRole('button', { name: /получить билет/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Имя')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'ПОСЛЕДНИЙ КРУГ · УЧАСТВОВАТЬ' })).not.toBeInTheDocument();
  });

  it('returns an already-open guest page to registration after the owner reset deletes its binding', async () => {
    vi.useFakeTimers();
    const restore = vi.fn()
      .mockResolvedValueOnce({ status: 'restored', guest })
      .mockResolvedValueOnce({ status: 'not_found' });

    render(
      <JoinPage
        dependencies={dependencies({ restore })}
        guestRecheckIntervalMs={15_000}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId('virtual-ticket')).toHaveTextContent('LV-031');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    expect(screen.getByRole('button', { name: /получить билет/i })).toBeInTheDocument();
    expect(screen.queryByTestId('virtual-ticket')).not.toBeInTheDocument();
  });

  it('keeps the ticket visible when a background guest recheck has a transient network error', async () => {
    const restore = vi.fn()
      .mockResolvedValueOnce({ status: 'restored', guest })
      .mockRejectedValueOnce(new Error('offline'));

    render(<JoinPage dependencies={dependencies({ restore })} />);

    expect(await screen.findByTestId('virtual-ticket')).toHaveTextContent('LV-031');

    await act(async () => {
      await Promise.resolve();
    });

    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(restore).toHaveBeenCalledTimes(2));

    expect(screen.getByTestId('virtual-ticket')).toHaveTextContent('LV-031');
    expect(screen.queryByRole('button', { name: /получить билет/i })).not.toBeInTheDocument();
  });

  it('refreshes the same guest ticket and carriage subscription after owner reassignment', async () => {
    const reassignedGuest = {
      ...guest,
      carriage: {
        id: 'carriage-4', number: 4, label: 'ВАГОН №4', accentHex: '#78806A', visualMark: '04',
      },
    };
    const restore = vi.fn()
      .mockResolvedValueOnce({ status: 'restored', guest })
      .mockResolvedValueOnce({ status: 'restored', guest: reassignedGuest });
    const loadCarriageCalls = vi.fn().mockResolvedValue({ status: 'ok', calls: [] });
    const subscribeToCarriageCalls = vi.fn(() => vi.fn());

    render(<JoinPage dependencies={dependencies({ restore, loadCarriageCalls, subscribeToCarriageCalls })} />);

    expect(await screen.findByTestId('virtual-ticket')).toHaveTextContent('ВАГОН №3');
    window.dispatchEvent(new Event('focus'));

    await waitFor(() => expect(screen.getByTestId('virtual-ticket')).toHaveTextContent('ВАГОН №4'));
    await waitFor(() => {
      expect(subscribeToCarriageCalls).toHaveBeenLastCalledWith('carriage-4', expect.any(Function));
    });
  });

  it('recovers the old ticket from an owner-issued code on a new phone', async () => {
    const user = userEvent.setup();
    const recover = vi.fn().mockResolvedValue({ status: 'recovered', guest });
    render(<JoinPage dependencies={dependencies({ recover })} revealDelayMs={0} />);

    await screen.findByRole('button', { name: /получить билет/i });
    await user.click(screen.getByRole('button', { name: 'У МЕНЯ УЖЕ БЫЛ БИЛЕТ' }));
    await user.type(screen.getByLabelText('Код восстановления'), 'AB12-CD34');
    await user.click(screen.getByRole('button', { name: 'ВОССТАНОВИТЬ БИЛЕТ' }));

    expect(recover).toHaveBeenCalledWith('lvw_device_1', 'AB12-CD34');
    expect(await screen.findByText('Иван Петров')).toBeInTheDocument();
    expect(screen.getByTestId('virtual-ticket')).toHaveTextContent('LV-031');
  });

  it('keeps registration available when a recovery code is invalid or expired', async () => {
    const user = userEvent.setup();
    render(<JoinPage dependencies={dependencies()} />);

    await screen.findByRole('button', { name: /получить билет/i });
    await user.click(screen.getByRole('button', { name: 'У МЕНЯ УЖЕ БЫЛ БИЛЕТ' }));
    await user.type(screen.getByLabelText('Код восстановления'), 'BAD-CODE');
    await user.click(screen.getByRole('button', { name: 'ВОССТАНОВИТЬ БИЛЕТ' }));

    expect(await screen.findByText(/код недействителен или уже истёк/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ВЕРНУТЬСЯ К РЕГИСТРАЦИИ' }));
    expect(screen.getByRole('button', { name: /получить билет/i })).toBeInTheDocument();
  });

  it('shows only the current guest carriage call and refreshes after its carriage signal', async () => {
    let refreshCallback: (() => void) | undefined;
    const restore = vi.fn().mockResolvedValue({ status: 'restored', guest });
    const loadCarriageCalls = vi.fn()
      .mockResolvedValueOnce({
        status: 'ok',
        carriage: guest.carriage,
        calls: [{
          id: 'call-1',
          message: 'ВАШ СОСТАВ ОТПРАВЛЯЕТСЯ НА БАР',
          showOnScreen: false,
          createdAt: '2026-08-30T13:00:00+05:00',
        }],
      })
      .mockResolvedValueOnce({ status: 'ok', carriage: guest.carriage, calls: [] });
    const subscribeToCarriageCalls = vi.fn((_carriageId: string, callback: () => void) => {
      refreshCallback = callback;
      return vi.fn();
    });

    render(
      <JoinPage
        dependencies={dependencies({ restore, loadCarriageCalls, subscribeToCarriageCalls })}
      />,
    );

    expect(await screen.findByText('ВАШ СОСТАВ ОТПРАВЛЯЕТСЯ НА БАР')).toBeInTheDocument();
    expect(loadCarriageCalls).toHaveBeenCalledWith('lvw_device_1');
    expect(subscribeToCarriageCalls).toHaveBeenCalledWith('carriage-3', expect.any(Function));

    await act(async () => {
      refreshCallback?.();
      await Promise.resolve();
    });

    expect(screen.queryByText('ВАШ СОСТАВ ОТПРАВЛЯЕТСЯ НА БАР')).not.toBeInTheDocument();
  });
});
