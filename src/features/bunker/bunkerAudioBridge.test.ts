import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  armBunkerPresentationAudio,
  registerBunkerPresentationAudioArmer,
} from './bunkerAudioBridge';

afterEach(() => {
  registerBunkerPresentationAudioArmer(null);
});

describe('bunker audio preflight bridge', () => {
  it('lets the normal projector sound gesture pre-arm bunker audio', async () => {
    const arm = vi.fn().mockResolvedValue(true);
    registerBunkerPresentationAudioArmer(arm);

    await expect(armBunkerPresentationAudio()).resolves.toBe(true);
    expect(arm).toHaveBeenCalledTimes(1);
  });

  it('is safe when no bunker projector guard is mounted', async () => {
    registerBunkerPresentationAudioArmer(null);
    await expect(armBunkerPresentationAudio()).resolves.toBe(false);
  });
});
