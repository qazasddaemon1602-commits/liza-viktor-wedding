import { describe, expect, it, vi } from 'vitest';
import { getRegistrationCarriageMap, parseRegistrationCarriageMap } from './carriageMap.service';

const carriage = (number = 1, guests: unknown[] = []) => ({
  id: `carriage-${number}`,
  number,
  label: `ВАГОН №${number}`,
  accentHex: '#31483A',
  visualMark: String(number).padStart(2, '0'),
  guests,
});

const payload = (status: 'registration' | 'complete' | 'not_found' = 'registration') => ({
  status,
  expectedGuestCount: status === 'not_found' ? 0 : 12,
  registeredGuestCount: status === 'complete' ? 12 : 0,
  serverNow: '2026-08-30T10:00:00.000Z',
  unassignedCount: status === 'complete' ? 12 : 0,
  carriages: status === 'not_found' ? [] : [carriage(1), carriage(2)],
});

describe('parseRegistrationCarriageMap', () => {
  it.each(['registration', 'complete', 'not_found'] as const)('accepts the %s state', (status) => {
    expect(parseRegistrationCarriageMap(payload(status))).toEqual(payload(status));
  });

  it('accepts Cyrillic and Latin initials and preserves deterministic seat indexes', () => {
    const response = payload();
    response.carriages[0].guests = [
      { id: 'guest-1', initials: 'АП', seatIndex: 1 },
      { id: 'guest-2', initials: 'V', seatIndex: 2 },
    ];
    response.registeredGuestCount = 2;

    expect(parseRegistrationCarriageMap(response)?.carriages[0].guests).toEqual(response.carriages[0].guests);
  });

  it.each([
    { ...payload(), status: 'loading' },
    { ...payload(), serverNow: 'not-a-date' },
    { ...payload(), expectedGuestCount: -1 },
    { ...payload(), registeredGuestCount: 1.5 },
    { ...payload(), unassignedCount: -1 },
    { ...payload(), carriages: [carriage(1)] },
    { ...payload(), carriages: Array.from({ length: 6 }, (_, index) => carriage(index + 1)) },
    { ...payload('complete'), registeredGuestCount: 11, unassignedCount: 11 },
    { ...payload(), registeredGuestCount: 3 },
    { ...payload('not_found'), expectedGuestCount: 1 },
  ])('rejects malformed root payload %#', (value) => {
    expect(parseRegistrationCarriageMap(value)).toBeNull();
  });

  it.each([
    { id: 'guest-1', initials: '', seatIndex: 1 },
    { id: 'guest-1', initials: 'A1', seatIndex: 1 },
    { id: 'guest-1', initials: 'ABC', seatIndex: 1 },
    { id: 'guest-1', initials: 'АП', seatIndex: 0 },
    { id: 'guest-1', initials: 'АП', seatIndex: 41 },
    { id: 'guest-1', initials: 'АП', seatIndex: 1.5 },
  ])('rejects an unsafe or malformed guest %#', (guest) => {
    const response = payload();
    response.carriages[0].guests = [guest];
    expect(parseRegistrationCarriageMap(response)).toBeNull();
  });

  it.each([
    { ...payload(), phone: '+79990000000' },
    { ...payload(), token: 'secret' },
  ])('rejects unexpected private root keys %#', (value) => {
    expect(parseRegistrationCarriageMap(value)).toBeNull();
  });

  it.each([
    { ...carriage(1), guests: [], guestNames: ['Анна Петрова'] },
    { ...carriage(1), guests: [], ownerToken: 'secret' },
  ])('rejects unexpected carriage keys %#', (unsafeCarriage) => {
    const response = payload();
    response.carriages[0] = unsafeCarriage;
    expect(parseRegistrationCarriageMap(response)).toBeNull();
  });

  it.each([
    { id: 'guest-1', initials: 'АП', seatIndex: 1, firstName: 'Анна' },
    { id: 'guest-1', initials: 'АП', seatIndex: 1, phone: '+79990000000' },
    { id: 'guest-1', initials: 'АП', seatIndex: 1, token: 'secret' },
  ])('rejects unexpected guest keys %#', (unsafeGuest) => {
    const response = payload();
    response.carriages[0].guests = [unsafeGuest];
    expect(parseRegistrationCarriageMap(response)).toBeNull();
  });

  it('rejects duplicate or non-sequential seat indexes', () => {
    const response = payload();
    response.registeredGuestCount = 2;
    response.carriages[0].guests = [
      { id: 'guest-1', initials: 'АП', seatIndex: 1 },
      { id: 'guest-2', initials: 'ВК', seatIndex: 1 },
    ];
    expect(parseRegistrationCarriageMap(response)).toBeNull();

    response.carriages[0].guests[1] = { id: 'guest-2', initials: 'ВК', seatIndex: 3 };
    expect(parseRegistrationCarriageMap(response)).toBeNull();
  });
});

describe('getRegistrationCarriageMap', () => {
  it('calls the public RPC and parses its response', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: payload(), error: null });

    await expect(getRegistrationCarriageMap({ rpc }, 'liza-viktor')).resolves.toEqual(payload());
    expect(rpc).toHaveBeenCalledWith('get_registration_carriage_map', {
      p_event_slug: 'liza-viktor',
    });
  });

  it('rejects RPC errors and malformed data', async () => {
    await expect(getRegistrationCarriageMap({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'offline' } }),
    }, 'liza-viktor')).rejects.toThrow('offline');

    await expect(getRegistrationCarriageMap({
      rpc: vi.fn().mockResolvedValue({ data: { status: 'registration' }, error: null }),
    }, 'liza-viktor')).rejects.toThrow('Unexpected carriage map response');
  });
});
