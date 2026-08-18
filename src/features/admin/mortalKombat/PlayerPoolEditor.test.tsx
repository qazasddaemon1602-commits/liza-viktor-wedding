import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlayerPoolEditor } from './PlayerPoolEditor';

const registrations = [
  { registrationId: 'r1', guestId: 'g1', displayName: 'Сергей', status: 'active' as const, seed: 1, registeredAt: '2026-08-30T12:00:00Z' },
  { registrationId: 'r2', guestId: 'g2', displayName: 'Максим', status: 'active' as const, seed: 2, registeredAt: '2026-08-30T12:00:00Z' },
];

describe('PlayerPoolEditor', () => {
  it('lets the owner remove a no-show from the active pool before bracket start', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn().mockResolvedValue(undefined);

    render(
      <PlayerPoolEditor
        registrations={registrations}
        onSwap={vi.fn().mockResolvedValue(undefined)}
        onRemove={onRemove}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'УБРАТЬ ИЗ СЕТКИ · Сергей' }));

    expect(onRemove).toHaveBeenCalledWith('r1');
  });
});