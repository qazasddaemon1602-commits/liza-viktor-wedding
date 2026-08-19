import { siteAudio } from '../../lib/siteAudio';

export type BunkerAudioController = {
  arm: () => Promise<boolean>;
  startAlarm: () => void;
  stopAlarm: () => void;
  dispose: () => void;
};

type AudioContextLike = AudioContext;

export function createBunkerAudioController(): BunkerAudioController {
  let context: AudioContextLike | null = null;
  let interval: number | null = null;
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

  return {
    arm: async () => {
      const ctx = ensureContext();
      if (!ctx) return false;
      try {
        if (ctx.state !== 'running') await ctx.resume();
        return ctx.state === 'running';
      } catch {
        return false;
      }
    },
    startAlarm: () => {
      if (interval !== null) return;
      pulse();
      interval = window.setInterval(pulse, 2200);
    },
    stopAlarm: () => {
      if (interval !== null) window.clearInterval(interval);
      interval = null;
      stopActive();
    },
    dispose: () => {
      if (interval !== null) window.clearInterval(interval);
      interval = null;
      unsubscribeSettings();
      stopActive();
      void context?.close();
      context = null;
    },
  };
}
