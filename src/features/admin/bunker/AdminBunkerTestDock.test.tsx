import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminBunkerTestDock } from './AdminBunkerTestDock';

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    loadState: vi.fn().mockResolvedValue({
      gameMode: 'test',
      globalState: 'MISSION_03',
      runActive: true,
      guestCount: 20,
      realGuestCount: 12,
      wagonCount: 3,
    }),
    seed: vi.fn(),
    prepare: vi.fn(),
    accelerate: vi.fn().mockResolvedValue({ status: 'accelerated' }),
    simulate: vi.fn(),
    setInventory: vi.fn(),
    setWagonState: vi.fn(),
    resetProgress: vi.fn(),
    resetRegistrations: vi.fn(),
    fullReset: vi.fn(),
    broadcastRefresh: vi.fn(),
    ...overrides,
  };
}

describe('AdminBunkerTestDock', () => {
  it('shows real and synthetic rehearsal counts separately', async () => {
    const deps = dependencies();
    render(<AdminBunkerTestDock eventId="event-1" dependencies={deps} />);

    expect(await screen.findByText(/всего в репетиции: 20/i)).toHaveTextContent(/реальных: 12/i);
    expect(screen.getByText(/всего в репетиции: 20/i)).toHaveTextContent(/тестовых: 8/i);
  });

  it('reloads persisted rehearsal state after a safe action', async () => {
    const user = userEvent.setup();
    const deps = dependencies();
    render(<AdminBunkerTestDock eventId="event-1" dependencies={deps} />);

    await screen.findByRole('heading', { name: 'РЕПЕТИЦИЯ ИГРЫ' });
    await user.click(screen.getByRole('button', { name: 'УСКОРИТЬ НА 1 МИНУТУ' }));

    await waitFor(() => expect(deps.accelerate).toHaveBeenCalledWith('event-1'));
    await waitFor(() => expect(deps.loadState.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it('surfaces a failed rehearsal command and does not auto-retry it', async () => {
    const user = userEvent.setup();
    const accelerate = vi.fn().mockRejectedValue(new Error('test timer unavailable'));
    const deps = dependencies({ accelerate });
    render(<AdminBunkerTestDock eventId="event-1" dependencies={deps} />);

    await screen.findByRole('heading', { name: 'РЕПЕТИЦИЯ ИГРЫ' });
    await user.click(screen.getByRole('button', { name: 'УСКОРИТЬ НА 1 МИНУТУ' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/команда репетиции не выполнена/i);
    expect(alert).toHaveTextContent(/test timer unavailable/i);
    expect(accelerate).toHaveBeenCalledTimes(1);
    expect(deps.broadcastRefresh).not.toHaveBeenCalled();
  });
});