import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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
  it('restores the existing guest from the same device and opens their ticket', async () => {
    const restore = vi.fn().mockResolvedValue({ status: 'restored', guest });
    render(<JoinPage dependencies={dependencies({ restore })} />);

    expect(await screen.findByText('Иван Петров')).toBeInTheDocument();
    expect(screen.getByText('LV-031')).toBeInTheDocument();
    expect(restore).toHaveBeenCalledWith('lvw_device_1');
  });

  it('shows registration when the device has no existing guest binding', async () => {
    render(<JoinPage dependencies={dependencies()} />);

    expect(await screen.findByRole('button', { name: /получить билет/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Имя')).toBeInTheDocument();
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
    expect(screen.getByText('LV-031')).toBeInTheDocument();
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
