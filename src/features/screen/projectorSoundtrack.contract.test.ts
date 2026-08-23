import { describe, expect, it } from 'vitest';
import { createScreenAudioController } from './screenAudio';

describe('projector wedding soundtrack contract', () => {
  it('exposes stage-driven soundtrack controls on the projector audio controller', () => {
    const controller = createScreenAudioController(
      () => { throw new Error('audio context should not be created for this contract check'); },
      {
        arm: async () => false,
        preloadCue: async () => null,
        playCue: async () => 'failed',
        stopCue: () => undefined,
      },
      () => true,
    );

    expect(typeof controller.setSoundtrackTheme).toBe('function');
    expect(typeof controller.stopSoundtrack).toBe('function');

    controller.dispose();
  });
});
