import { type ReactNode, useEffect, useRef, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import { BunkerEmergencyScene } from './BunkerEmergencyScene';
import { BunkerQuestScene, phaseForGlobalGameState } from './BunkerQuestScene';
import { createBunkerAudioController, type BunkerAudioController } from './bunkerAudio';
import { setBunkerPresentationProtected } from './bunkerProtection';
import {
  subscribeToBunkerRefresh,
  type BunkerRealtimeClient,
} from './bunker.realtime';
import {
  getBunkerScreenState,
  type BunkerRpcClient,
  type BunkerScreenState,
} from './bunker.service';

export type BunkerScreenGuardDependencies = {
  load: () => Promise<BunkerScreenState>;
  subscribe?: (callback: () => void) => () => void;
  audio?: BunkerAudioController;
};

type BunkerScreenGuardProps = {
  eventSlug?: string;
  dependencies?: BunkerScreenGuardDependencies;
  children: ReactNode;
};

function browserDependencies(eventSlug: string): BunkerScreenGuardDependencies | null {
  try {
    const client = getSupabaseClient();
    const rpcClient = client as unknown as BunkerRpcClient;
    const realtimeClient = client as unknown as BunkerRealtimeClient;
    return {
      load: () => getBunkerScreenState(rpcClient, eventSlug),
      subscribe: (callback) => subscribeToBunkerRefresh(realtimeClient, eventSlug, callback),
      audio: createBunkerAudioController(),
    };
  } catch {
    return null;
  }
}

function remainingFromState(
  state: Extract<BunkerScreenState, { status: 'active' }>,
  nowMs: number,
  serverOffsetMs: number,
): number {
  const startedMs = Date.parse(state.startedAt);
  if (!Number.isFinite(startedMs)) return state.remainingSeconds;
  const effectiveNow = nowMs + serverOffsetMs;
  return Math.max(0, Math.ceil(state.durationSeconds - (effectiveNow - startedMs) / 1000));
}

export function BunkerScreenGuard({
  eventSlug = 'liza-viktor',
  dependencies,
  children,
}: BunkerScreenGuardProps) {
  const [browserDeps, setBrowserDeps] = useState<BunkerScreenGuardDependencies | null>(null);
  const deps = dependencies ?? browserDeps;
  const [state, setState] = useState<BunkerScreenState | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [motionPreference, setMotionPreference] = useState<'full' | 'reduced'>(() => (
    typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'reduced'
      : 'full'
  ));
  const serverOffsetRef = useRef(0);
  const latestServerMsRef = useRef(Number.NEGATIVE_INFINITY);
  const previousUnlockRef = useRef<boolean | null>(null);

  const applyServerState = (next: BunkerScreenState) => {
    const receivedAt = Date.now();
    const serverMs = Date.parse(next.serverNow);
    if (Number.isFinite(serverMs) && serverMs < latestServerMsRef.current) return;
    if (Number.isFinite(serverMs)) latestServerMsRef.current = serverMs;
    serverOffsetRef.current = Number.isFinite(serverMs) ? serverMs - receivedAt : 0;
    setState(next);
    setNowMs(receivedAt);
  };

  useEffect(() => {
    if (dependencies) {
      setBrowserDeps(null);
      return;
    }
    const next = browserDependencies(eventSlug);
    setBrowserDeps(next);
    return () => next?.audio?.dispose();
  }, [dependencies, eventSlug]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setMotionPreference(query.matches ? 'reduced' : 'full');
    updateMotionPreference();
    query.addEventListener?.('change', updateMotionPreference);
    return () => query.removeEventListener?.('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    if (!deps) return;
    let active = true;
    const reload = () => {
      void deps.load()
        .then((next) => {
          if (!active) return;
          applyServerState(next);
        })
        .catch(() => {
          // Keep last authoritative bunker state during a short network drop.
        });
    };

    reload();
    const unsubscribe = deps.subscribe?.(reload);
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [deps]);

  const remainingSeconds = state?.status === 'active'
    ? remainingFromState(state, nowMs, serverOffsetRef.current)
    : 0;
  const bunkerActive = state?.status === 'active';
  const activePhase = state?.status === 'active'
    ? phaseForGlobalGameState(state.globalGameState, state.phase ?? 'emergency')
    : null;
  const emergencyPhase = bunkerActive && activePhase === 'emergency';

  useEffect(() => {
    setBunkerPresentationProtected(bunkerActive);
    return () => {
      setBunkerPresentationProtected(false);
    };
  }, [bunkerActive]);

  useEffect(() => {
    if (!bunkerActive || remainingSeconds <= 0) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [bunkerActive, remainingSeconds <= 0]);

  useEffect(() => {
    if (!deps) return;
    let active = true;
    const interval = window.setInterval(() => {
      void deps.load()
        .then((next) => {
          if (active) applyServerState(next);
        })
        .catch(() => {
          // Keep the last valid screen state until connectivity returns.
        });
    }, bunkerActive ? 2_000 : 1_500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [deps, bunkerActive]);

  useEffect(() => {
    const audio = deps?.audio;
    if (!audio) return;
    if (
      !emergencyPhase
      || remainingSeconds <= 0
      || state?.status !== 'active'
      || !state.soundEnabled
    ) {
      audio.stopAlarm();
      return;
    }

    // Schedule the alarm even if autoplay initially blocks AudioContext.resume().
    // The shared projector icon/slider can re-arm the context later without losing the scene.
    audio.startAlarm();
    void audio.arm();

    return () => audio.stopAlarm();
  }, [deps, emergencyPhase, remainingSeconds <= 0, state?.status === 'active' ? state.soundEnabled : false]);

  useEffect(() => {
    const audio = deps?.audio;
    if (!audio) return;
    if (!bunkerActive || state?.status !== 'active' || !state.soundEnabled) {
      audio.stopAmbience();
      return;
    }

    audio.startAmbience();
    void audio.arm();
    return () => audio.stopAmbience();
  }, [deps, bunkerActive, state?.status === 'active' ? state.soundEnabled : false]);

  useEffect(() => {
    const audio = deps?.audio;
    if (!bunkerActive || state?.status !== 'active') {
      previousUnlockRef.current = null;
      return;
    }

    const finalPhase = activePhase === 'final' || activePhase === 'completed';
    const wasUnlocked = previousUnlockRef.current;
    if (
      finalPhase
      && state.soundEnabled
      && wasUnlocked === false
      && state.unlocked
    ) {
      audio?.playDoorUnlock();
      void audio?.arm();
    }
    previousUnlockRef.current = state.unlocked;
  }, [deps, bunkerActive, activePhase, state?.status === 'active' ? state.unlocked : false, state?.status === 'active' ? state.soundEnabled : false]);

  return (
    <>
      {children}
      {bunkerActive && state?.status === 'active' && activePhase === 'emergency' && (
        <BunkerEmergencyScene
          remainingSeconds={remainingSeconds}
          motionPreference={motionPreference}
        />
      )}
      {bunkerActive && state?.status === 'active' && activePhase !== 'emergency' && (
        <BunkerQuestScene
          key={activePhase}
          state={state}
          remainingSeconds={remainingSeconds}
          motionPreference={motionPreference}
        />
      )}
    </>
  );
}
