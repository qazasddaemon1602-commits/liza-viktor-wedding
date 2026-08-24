import { PROJECTOR_AUDIO_REARM_EVENT, siteAudio } from '../../lib/siteAudio';
import { hasLocalAudioSource, type AudioCueId } from '../../lib/audioManifest';
import { sampleAudio, type SampleAudioController } from '../../lib/sampleAudio';

export type BunkerAudioController = {
  arm: () => Promise<boolean>;
  startAlarm: () => void;
  stopAlarm: () => void;
  startAmbience: () => void;
  stopAmbience: () => void;
  playDoorUnlock: () => void;
  playReveal: () => void;
  dispose: () => void;
};

export type BunkerAudioFinaleController = BunkerAudioController & {
  playFinale: () => void;
  stopFinale: () => void;
};

type AudioContextLike = AudioContext;

type BunkerAudioOptions = {
  samplePlayer?: Pick<SampleAudioController, 'arm' | 'playCue' | 'stopCue'>;
  hasSample?: (id: AudioCueId) => boolean;
};

export function createBunkerAudioController(options: BunkerAudioOptions = {}): BunkerAudioFinaleController {
  const samplePlayer = options.samplePlayer ?? sampleAudio;
  const hasSample = options.hasSample ?? hasLocalAudioSource;
  let context: AudioContextLike | null = null;
  let interval: number | null = null;
  let sampleAlarmRequested = false;
  let sampleAmbienceRequested = false;
  let disposed = false;
  let lifecycleRevision = 0;
  const activeOscillators = new Set<OscillatorNode>();

  const ensureContext = () => {
    if (context) return context;
    const AudioContextCtor = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;
    context = new AudioContextCtor();
    return context;
  };

  const stopActive = () => {
    if (!context) return;
    for (const oscillator of activeOscillators) {
      try {
        oscillator.stop(context.currentTime);
      } catch {
        // Already ended.
      }
    }
    activeOscillators.clear();
  };

  const arm = async (): Promise<boolean> => {
    if (disposed) return false;
    if (!siteAudio.isEnabled() || siteAudio.getVolume() <= 0) return false;
    if (hasSample('bunker.alarm')) return samplePlayer.arm();
    const ctx = ensureContext();
    if (!ctx) return false;
    try {
      if (ctx.state !== 'running') await ctx.resume();
      return ctx.state === 'running';
    } catch {
      return false;
    }
  };

  const pulse = () => {
    const volume = siteAudio.getVolume();
    if (!siteAudio.isEnabled() || volume <= 0) return;
    const ctx = ensureContext();
    if (!ctx || ctx.state !== 'running') return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(82, now);
    oscillator.frequency.exponentialRampToValueAtTime(58, now + 0.42);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.22 * volume), now + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    activeOscillators.add(oscillator);
    oscillator.onended = () => activeOscillators.delete(oscillator);
    oscillator.start(now);
    oscillator.stop(now + 0.5);
  };

  const unsubscribeSettings = siteAudio.subscribe((settings) => {
    if (!settings.enabled || settings.volume <= 0) {
      stopActive();
      return;
    }
    if (context?.state === 'suspended') void context.resume().catch(() => undefined);
  });

  const rearmFromProjectorControl = () => {
    const revision = lifecycleRevision;
    void arm().then((armed) => {
      if (!armed || disposed || revision !== lifecycleRevision) return;
      if (sampleAlarmRequested) {
        void samplePlayer.playCue('bunker.alarm', { loop: true, priority: 'major' });
      } else if (interval !== null) {
        pulse();
      }
      if (sampleAmbienceRequested && hasSample('bunker.ambience')) {
        void samplePlayer.playCue('bunker.ambience', { loop: true, priority: 'scene' });
      }
    });
  };
  window.addEventListener(PROJECTOR_AUDIO_REARM_EVENT, rearmFromProjectorControl);

  return {
    arm,
    startAlarm: () => {
      if (disposed) return;
      if (hasSample('bunker.alarm')) {
        sampleAlarmRequested = true;
        void samplePlayer.playCue('bunker.alarm', { loop: true, priority: 'major' });
        return;
      }
      if (interval !== null) return;
      pulse();
      interval = window.setInterval(pulse, 2200);
    },
    stopAlarm: () => {
      sampleAlarmRequested = false;
      if (hasSample('bunker.alarm')) samplePlayer.stopCue('bunker.alarm');
      if (interval !== null) window.clearInterval(interval);
      interval = null;
      sampleAlarmRequested = false;
      stopActive();
    },
    startAmbience: () => {
      if (disposed) return;
      if (!hasSample('bunker.ambience')) return;
      sampleAmbienceRequested = true;
      void samplePlayer.playCue('bunker.ambience', { loop: true, priority: 'scene' });
    },
    stopAmbience: () => {
      sampleAmbienceRequested = false;
      if (hasSample('bunker.ambience')) samplePlayer.stopCue('bunker.ambience');
    },
    playDoorUnlock: () => {
      if (disposed) return;
      if (!siteAudio.isEnabled() || siteAudio.getVolume() <= 0) return;
      if (!hasSample('bunker.door')) return;
      void samplePlayer.playCue('bunker.door', { priority: 'major' });
    },
    playReveal: () => {
      if (disposed) return;
      if (!siteAudio.isEnabled() || siteAudio.getVolume() <= 0) return;
      if (!hasSample('ui.reveal')) return;
      void samplePlayer.playCue('ui.reveal', { priority: 'scene' });
    },
    playFinale: () => {
      if (disposed) return;
      if (!siteAudio.isEnabled() || siteAudio.getVolume() <= 0) return;
      if (!hasSample('bunker.finale')) return;
      void samplePlayer.playCue('bunker.finale', { priority: 'scene' });
    },
    stopFinale: () => {
      if (hasSample('bunker.finale')) samplePlayer.stopCue('bunker.finale');
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      lifecycleRevision += 1;
      sampleAlarmRequested = false;
      sampleAmbienceRequested = false;
      if (interval !== null) window.clearInterval(interval);
      interval = null;
      window.removeEventListener(PROJECTOR_AUDIO_REARM_EVENT, rearmFromProjectorControl);
      unsubscribeSettings();
      if (hasSample('bunker.alarm')) samplePlayer.stopCue('bunker.alarm');
      if (hasSample('bunker.ambience')) samplePlayer.stopCue('bunker.ambience');
      if (hasSample('bunker.door')) samplePlayer.stopCue('bunker.door');
      if (hasSample('ui.reveal')) samplePlayer.stopCue('ui.reveal');
      if (hasSample('bunker.finale')) samplePlayer.stopCue('bunker.finale');
      stopActive();
      void context?.close();
      context = null;
    },
  };
}

