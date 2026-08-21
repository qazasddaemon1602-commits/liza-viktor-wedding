import { describe, expect, it } from 'vitest';
import { enqueueNotices, type RegistrationNotice } from './notificationQueue';

const notice = (guestId: string): RegistrationNotice => ({
  guestId,
  fullName: `Гость ${guestId}`,
  carriageLabel: 'ВАГОН №3',
  carriageAccent: '#7E3F3C',
  affiliationLabel: 'Со стороны Виктора',
  createdAt: '2026-08-30T12:00:00+05:00',
});

describe('registration notification queue', () => {
  it('preserves every near-simultaneous registration in order', () => {
    const queue = enqueueNotices([], [notice('a'), notice('b'), notice('c')]);
    expect(queue.map((item) => item.guestId)).toEqual(['a', 'b', 'c']);
  });

  it('does not duplicate the same registration event', () => {
    const existing = [notice('a')];
    const queue = enqueueNotices(existing, [notice('a'), notice('b')]);
    expect(queue.map((item) => item.guestId)).toEqual(['a', 'b']);
  });
});
