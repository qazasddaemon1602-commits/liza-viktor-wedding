import { describe, expect, it } from 'vitest';
import { EVENT_DATE, EXPECTED_GUEST_COUNT, WEDDING_DATE } from './eventConfig';

describe('eventConfig', () => {
  it('pins the wedding and second-day dates', () => {
    expect(WEDDING_DATE).toBe('2026-08-29');
    expect(EVENT_DATE).toBe('2026-08-30');
    expect(EXPECTED_GUEST_COUNT).toBe(40);
  });
});
