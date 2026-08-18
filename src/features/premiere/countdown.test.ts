import { describe, expect, it } from 'vitest';
import { getCountdownFrame } from './countdown';

describe('premiere countdown', () => {
  it('shows 10 at the beginning of a ten-second countdown', () => {
    expect(getCountdownFrame(0, 10_000)).toEqual({ number: 10, shouldPlay: false });
  });

  it('derives the displayed number from the authoritative start timestamp', () => {
    expect(getCountdownFrame(2_001, 10_000)).toEqual({ number: 8, shouldPlay: false });
    expect(getCountdownFrame(8_999, 10_000)).toEqual({ number: 2, shouldPlay: false });
  });

  it('shows 1 during the final second and never renders zero', () => {
    expect(getCountdownFrame(9_001, 10_000)).toEqual({ number: 1, shouldPlay: false });
    expect(getCountdownFrame(9_999, 10_000)).toEqual({ number: 1, shouldPlay: false });
    expect(getCountdownFrame(10_000, 10_000)).toEqual({ number: null, shouldPlay: true });
  });

  it('stays in play mode after the start boundary', () => {
    expect(getCountdownFrame(10_001, 10_000)).toEqual({ number: null, shouldPlay: true });
    expect(getCountdownFrame(25_000, 10_000)).toEqual({ number: null, shouldPlay: true });
  });

  it('caps early countdown frames at 10 instead of exposing larger numbers', () => {
    expect(getCountdownFrame(0, 30_000)).toEqual({ number: 10, shouldPlay: false });
  });
});
