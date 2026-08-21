import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminRegistrationToasts } from './AdminRegistrationToasts';
import type { RegistrationNotice } from './notificationQueue';

const notice: RegistrationNotice = {
  guestId: 'g31',
  fullName: 'Иван Петров',
  carriageLabel: 'ВАГОН №3',
  carriageAccent: '#7E3F3C',
  affiliationLabel: 'Со стороны Виктора',
  createdAt: '2026-08-30T12:00:00+05:00',
};

describe('AdminRegistrationToasts', () => {
  it('shows the next owner-only registration notice with guest and carriage', () => {
    render(<AdminRegistrationToasts notices={[notice]} onDismiss={vi.fn()} />);

    expect(screen.getByText('НОВЫЙ ПАССАЖИР')).toBeInTheDocument();
    expect(screen.getByText('Иван Петров')).toBeInTheDocument();
    expect(screen.getByText('ВАГОН №3')).toBeInTheDocument();
    expect(screen.getByText('Со стороны Виктора')).toBeInTheDocument();
  });

  it('dismisses exactly the notice currently being shown', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<AdminRegistrationToasts notices={[notice]} onDismiss={onDismiss} />);

    await user.click(screen.getByRole('button', { name: 'Закрыть уведомление' }));
    expect(onDismiss).toHaveBeenCalledWith('g31');
  });
});
