import { describe, expect, it, vi } from 'vitest';
import { registerGuest, restoreGuest } from './registration.service';

const guestPayload = {
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

describe('registration service', () => {
  it('sends normalized registration through the constrained RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: 'registered', guest: guestPayload }, error: null });
    const result = await registerGuest({ rpc }, 'liza-viktor', 'lvw_device_1', {
      firstName: 'Иван',
      lastName: 'Петров',
      affiliationType: 'viktor',
      affiliationDetail: 'коллега Виктора',
    });

    expect(rpc).toHaveBeenCalledWith('register_guest', {
      p_event_slug: 'liza-viktor',
      p_device_key: 'lvw_device_1',
      p_first_name: 'Иван',
      p_last_name: 'Петров',
      p_affiliation_type: 'viktor',
      p_affiliation_detail: 'коллега Виктора',
      p_confirm_duplicate: false,
    });
    expect(result).toEqual({ status: 'registered', guest: guestPayload });
  });

  it('returns duplicate warning instead of inventing a guest', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: 'duplicate_warning', publicName: 'Иван П.' }, error: null });
    const result = await registerGuest({ rpc }, 'liza-viktor', 'lvw_device_2', {
      firstName: 'Иван',
      lastName: 'Петров',
      affiliationType: 'common',
      affiliationDetail: '',
    });

    expect(result).toEqual({ status: 'duplicate_warning', publicName: 'Иван П.' });
  });

  it('restores the same guest from the same device binding', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: 'restored', guest: guestPayload }, error: null });
    expect(await restoreGuest({ rpc }, 'liza-viktor', 'lvw_device_1')).toEqual({ status: 'restored', guest: guestPayload });
    expect(rpc).toHaveBeenCalledWith('restore_guest', {
      p_event_slug: 'liza-viktor',
      p_device_key: 'lvw_device_1',
    });
  });

  it('surfaces backend RPC errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('network') });
    await expect(restoreGuest({ rpc }, 'liza-viktor', 'lvw_device_1')).rejects.toThrow('network');
  });
});
