import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOrCreateDeviceKey } from './deviceIdentity';

describe('getOrCreateDeviceKey', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('reuses the same persisted device key', () => {
    const first = getOrCreateDeviceKey();
    const second = getOrCreateDeviceKey();

    expect(first).toMatch(/^lvw_[a-zA-Z0-9_-]+$/);
    expect(second).toBe(first);
  });

  it('restores a previously stored key instead of creating a new guest identity', () => {
    localStorage.setItem('lvw:device-key', 'lvw_existing_guest_device');

    expect(getOrCreateDeviceKey()).toBe('lvw_existing_guest_device');
  });
});
