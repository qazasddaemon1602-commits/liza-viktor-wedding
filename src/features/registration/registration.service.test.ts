import { describe, expect, it, vi } from 'vitest';
import { recoverGuest, registerGuest, restoreGuest } from './registration.service';

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

  it('uses an owner-issued code to rebind a new device to the existing guest', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: 'recovered', guest: guestPayload }, error: null });

    const result = await recoverGuest({ rpc }, 'liza-viktor', 'lvw_new_device', 'AB12-CD34');

    expect(rpc).toHaveBeenCalledWith('recover_guest', {
      p_event_slug: 'liza-viktor',
      p_recovery_code: 'AB12-CD34',
      p_device_key: 'lvw_new_device',
    });
    expect(result).toEqual({ status: 'recovered', guest: guestPayload });
  });

  it('returns invalid-or-expired instead of creating a duplicate guest', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: 'invalid_or_expired' }, error: null });

    expect(await recoverGuest({ rpc }, 'liza-viktor', 'lvw_new_device', 'BAD-CODE')).toEqual({
      status: 'invalid_or_expired',
    });
  });

  it('surfaces backend RPC errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('network') });
    await expect(restoreGuest({ rpc }, 'liza-viktor', 'lvw_device_1')).rejects.toThrow('network');
  });
});
