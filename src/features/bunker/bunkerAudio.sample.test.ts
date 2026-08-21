import { describe, expect, it, vi } from 'vitest';
import { PROJECTOR_AUDIO_REARM_EVENT } from '../../lib/siteAudio';
import { createBunkerAudioController } from './bunkerAudio';

describe('Bunker sample audio bridge', () => {
  it('plays and stops the acquired alarm loop on the shared timestamp-capable bus', async () => {
    const samplePlayer = {
      arm: vi.fn().mockResolvedValue(true),
      playCue: vi.fn().mockResolvedValue('played'),
      stopCue: vi.fn(),
    };
    const audio = createBunkerAudioController({
      samplePlayer,
      hasSample: () => true,
    });

    await expect(audio.arm()).resolves.toBe(true);
    audio.startAlarm();
    audio.stopAlarm();

    expect(samplePlayer.playCue).toHaveBeenCalledWith('bunker.alarm', {
      loop: true,
      priority: 'major',
    });
    expect(samplePlayer.stopCue).toHaveBeenCalledWith('bunker.alarm');
    audio.dispose();
  });

  it('retries an requested sample alarm after the projector is rearmed', async () => {
    const samplePlayer = {
      arm: vi.fn().mockResolvedValue(true),
      playCue: vi.fn().mockResolvedValue('played'),
      stopCue: vi.fn(),
    };
    const audio = createBunkerAudioController({ samplePlayer, hasSample: () => true });

    audio.startAlarm();
    window.dispatchEvent(new Event(PROJECTOR_AUDIO_REARM_EVENT));

    await vi.waitFor(() => expect(samplePlayer.playCue).toHaveBeenCalledTimes(2));
    audio.dispose();
  });

  it('runs the recorded bunker room tone as a scene loop and exposes the recorded door hit', () => {
    const samplePlayer = {
      arm: vi.fn().mockResolvedValue(true),
      playCue: vi.fn().mockResolvedValue('played'),
      stopCue: vi.fn(),
    };
    const audio = createBunkerAudioController({ samplePlayer, hasSample: () => true });

    audio.startAmbience();
    audio.playDoorUnlock();
    audio.stopAmbience();

    expect(samplePlayer.playCue).toHaveBeenCalledWith('bunker.ambience', {
      loop: true,
      priority: 'scene',
    });
    expect(samplePlayer.playCue).toHaveBeenCalledWith('bunker.door', {
      priority: 'major',
    });
    expect(samplePlayer.stopCue).toHaveBeenCalledWith('bunker.ambience');
    audio.dispose();
  });

  it('restarts requested recorded ambience after projector audio is rearmed', async () => {
    const samplePlayer = {
      arm: vi.fn().mockResolvedValue(true),
      playCue: vi.fn().mockResolvedValue('played'),
      stopCue: vi.fn(),
    };
    const audio = createBunkerAudioController({ samplePlayer, hasSample: () => true });

    audio.startAmbience();
    window.dispatchEvent(new Event(PROJECTOR_AUDIO_REARM_EVENT));

    await vi.waitFor(() => expect(samplePlayer.playCue).toHaveBeenCalledTimes(2));
    audio.dispose();
  });

  it('does not restart a requested alarm when a pending projector rearm resolves after dispose', async () => {
    let resolveArm: ((value: boolean) => void) | undefined;
    const samplePlayer = {
      arm: vi.fn().mockImplementation(() => new Promise<boolean>((resolve) => { resolveArm = resolve; })),
      playCue: vi.fn().mockResolvedValue('played'),
      stopCue: vi.fn(),
    };
    const audio = createBunkerAudioController({ samplePlayer, hasSample: () => true });

    audio.startAlarm();
    window.dispatchEvent(new Event(PROJECTOR_AUDIO_REARM_EVENT));
    audio.dispose();
    resolveArm?.(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(samplePlayer.playCue).toHaveBeenCalledTimes(1);
  });
});
