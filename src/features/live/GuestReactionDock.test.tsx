import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GuestReactionDock } from './GuestReactionDock';

describe('GuestReactionDock', () => {
  it('shows the five approved reactions and sends the selected one', async () => {
    const send = vi.fn().mockResolvedValue({
      status: 'accepted',
      reactionId: 'reaction-1',
      createdAt: '2026-08-24T00:00:00.000Z',
      cooldownMs: 5000,
    });

    render(<GuestReactionDock onReact={send} />);

    for (const emoji of ['❤️', '😂', '🔥', '👏', '😱']) {
      expect(screen.getByRole('button', { name: `Реакция ${emoji}` })).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole('button', { name: 'Реакция 🔥' }));
    await waitFor(() => expect(send).toHaveBeenCalledWith('fire'));
  });

  it('keeps controls disabled while the server cooldown is active', async () => {
    const send = vi.fn().mockResolvedValue({ status: 'cooldown', retryAfterMs: 5000 });
    render(<GuestReactionDock onReact={send} />);

    fireEvent.click(screen.getByRole('button', { name: 'Реакция ❤️' }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));

    expect(screen.getByRole('button', { name: 'Реакция 😂' })).toBeDisabled();
  });
});
