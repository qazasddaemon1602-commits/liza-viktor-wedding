import { describe, expect, it } from 'vitest';
import { resolveBunkerContractVersion } from './bunkerContractVersion';

describe('resolveBunkerContractVersion', () => {
  it('treats any legacy projection as V1 even when its envelope says contractVersion 2', () => {
    expect(resolveBunkerContractVersion([
      null,
      { contractVersion: 2, status: 'legacy' },
      { contractVersion: 2, status: 'idle' },
    ])).toBe(1);
  });

  it('returns V2 only when a non-legacy V2 projection is available', () => {
    expect(resolveBunkerContractVersion([
      null,
      { contractVersion: 2, status: 'idle' },
      { contractVersion: 2, status: 'active' },
    ])).toBe(2);
  });

  it('keeps explicit M01 legacy contract at V1', () => {
    expect(resolveBunkerContractVersion([
      { contractVersion: 1, status: 'legacy' },
      { contractVersion: 2, status: 'idle' },
    ])).toBe(1);
  });

  it('returns undefined when no projection establishes the run contract', () => {
    expect(resolveBunkerContractVersion([null, undefined])).toBeUndefined();
  });
});
