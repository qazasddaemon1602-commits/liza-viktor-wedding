import { describe, expect, it } from 'vitest';
import { hasConnectionFailures, updateConnectionHealth, type ConnectionSource } from './connectionHealth';

describe('projector connection health', () => {
  it('keeps a failed source degraded until that exact source recovers', () => {
    let failures: ReadonlySet<ConnectionSource> = new Set();

    failures = updateConnectionHealth(failures, 'premiere', false);
    expect(hasConnectionFailures(failures)).toBe(true);
    expect(failures.has('premiere')).toBe(true);

    failures = updateConnectionHealth(failures, 'quiz', true);
    expect(hasConnectionFailures(failures)).toBe(true);
    expect(failures.has('premiere')).toBe(true);

    failures = updateConnectionHealth(failures, 'premiere', true);
    expect(hasConnectionFailures(failures)).toBe(false);
  });

  it('tracks browser and API failures independently', () => {
    let failures: ReadonlySet<ConnectionSource> = new Set(['browser']);
    failures = updateConnectionHealth(failures, 'mortalKombat', false);
    failures = updateConnectionHealth(failures, 'browser', true);

    expect(failures.has('browser')).toBe(false);
    expect(failures.has('mortalKombat')).toBe(true);
    expect(hasConnectionFailures(failures)).toBe(true);
  });
});
