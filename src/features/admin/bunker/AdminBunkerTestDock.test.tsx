import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminBunkerTestDock } from './AdminBunkerTestDock';

describe('AdminBunkerTestDock', () => {
  it('reloads persisted rehearsal state after a safe action', async () => {
    const user = userEvent.setup();
    const loadState = vi.fn().mockResolvedValue({ gameMode:'test', globalState:'MISSION_03', runActive:true, guestCount:20, wagonCount:3 });
    const accelerate = vi.fn().mockResolvedValue({ status:'accelerated' });
    render(<AdminBunkerTestDock eventId="event-1" dependencies={{
      loadState, seed:vi.fn(), prepare:vi.fn(), accelerate, simulate:vi.fn(), setInventory:vi.fn(), setWagonState:vi.fn(), resetProgress:vi.fn(), resetRegistrations:vi.fn(), fullReset:vi.fn(), broadcastRefresh:vi.fn(),
    }} />);
    await screen.findByRole('heading', { name:'РЕПЕТИЦИЯ ИГРЫ' });
    await user.click(screen.getByRole('button', { name:'УСКОРИТЬ НА 1 МИНУТУ' }));
    await waitFor(() => expect(accelerate).toHaveBeenCalledWith('event-1'));
    await waitFor(() => expect(loadState.mock.calls.length).toBeGreaterThanOrEqual(2));
  });
});
