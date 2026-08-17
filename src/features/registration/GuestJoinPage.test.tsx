import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GuestJoinPage } from './GuestJoinPage';

const restoredGuest = {
  id: 'guest-31',
  firstName: 'Иван',
  lastName: 'Петров',
  affiliationType: 'viktor',
  affiliationDetail: '',
  ticketNumber: 'LV-031',
  carriage: {
    id: 'carriage-3',
    number: 3,
    label: 'ВАГОН №3',
    accentHex: '#7E3F3C',
    visualMark: '03',
  },
};

describe('GuestJoinPage', () => {
  it('restores the existing ticket before showing a new registration form', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { status: 'restored', guest: restoredGuest },
      error: null,
    });

    render(<GuestJoinPage client={{ rpc }} eventSlug="liza-viktor" deviceKey="lvw_device_31" revealDelayMs={0} />);

    expect(screen.getByText(/проверяем билет/i)).toBeInTheDocument();
    expect(await screen.findByText('LV-031')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /получить билет/i })).not.toBeInTheDocument();
  });

  it('shows registration when the device has no existing binding', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: 'not_found' }, error: null });

    render(<GuestJoinPage client={{ rpc }} eventSlug="liza-viktor" deviceKey="lvw_new_device" revealDelayMs={0} />);

    expect(await screen.findByRole('button', { name: /получить билет/i })).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith('restore_guest', {
      p_event_slug: 'liza-viktor',
      p_device_key: 'lvw_new_device',
    });
  });

  it('shows a recoverable error instead of an empty page when restore fails', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('offline') });

    render(<GuestJoinPage client={{ rpc }} eventSlug="liza-viktor" deviceKey="lvw_device_31" revealDelayMs={0} />);

    expect(await screen.findByText(/не удалось проверить билет/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /попробовать снова/i })).toBeInTheDocument();
  });
});
