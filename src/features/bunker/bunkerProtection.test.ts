import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getBunkerPresentationProtected,
  setBunkerPresentationProtected,
  subscribeToBunkerPresentationProtection,
} from './bunkerProtection';

afterEach(() => {
  setBunkerPresentationProtected(false);
});

describe('bunker presentation protection', () => {
  it('notifies screen consumers only when emergency protection changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToBunkerPresentationProtection(listener);

    expect(getBunkerPresentationProtected()).toBe(false);
    setBunkerPresentationProtected(true);
    setBunkerPresentationProtected(true);
    setBunkerPresentationProtected(false);

    expect(listener.mock.calls).toEqual([[true], [false]]);
    unsubscribe();
    setBunkerPresentationProtected(true);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
