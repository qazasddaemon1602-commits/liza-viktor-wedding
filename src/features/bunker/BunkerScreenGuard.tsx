import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import { BunkerEmergencyScene } from './BunkerEmergencyScene';
import { createBunkerAudioController, type BunkerAudioController } from './bunkerAudio';
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
    // Route/unit tests without a configured backend keep rendering their original screen.
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
  const deps = useMemo(
    () => dependencies ?? browserDependencies(eventSlug),
    [dependencies, eventSlug],
  );
  const [state, setState] = useState<BunkerScreenState | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [soundArmed, setSoundArmed] = useState(false);
  const activeRef = useRef(true);
  const serverOffsetRef = useRef(0);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!deps) return;
    let active = true;
    const reload = () => {
      void deps.load()
        .then((next) => {
          if (!active) return;
          const receivedAt = Date.now();
          const serverMs = Date.parse(next.serverNow);
          serverOffsetRef.current = Number.isFinite(serverMs) ? serverMs - receivedAt : 0;
          setState(next);
          setNowMs(receivedAt);
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
  const emergencyActive = state?.status === 'active' && remainingSeconds > 0;

  useEffect(() => {
    if (!emergencyActive) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [emergencyActive]);

  useEffect(() => {
    const audio = deps?.audio;
    if (!audio) return;
    if (!emergencyActive || state?.status !== 'active' || !state.soundEnabled) {
      audio.stopAlarm();
      return;
    }

    void audio.arm().then((armed) => {
      if (!activeRef.current) return;
      setSoundArmed(armed);
      if (armed) audio.startAlarm();
    });

    return () => audio.stopAlarm();
  }, [deps, emergencyActive, state?.status === 'active' ? state.soundEnabled : false]);

  useEffect(() => () => deps?.audio?.dispose(), [deps]);

  const armSound = () => {
    const audio = deps?.audio;
    if (!audio) return;
    void audio.arm().then((armed) => {
      if (!activeRef.current) return;
      setSoundArmed(armed);
      if (armed) audio.startAlarm();
    });
  };

  return (
    <>
      {children}
      {emergencyActive && state?.status === 'active' && (
        <BunkerEmergencyScene
          remainingSeconds={remainingSeconds}
          soundEnabled={state.soundEnabled}
          soundArmed={soundArmed}
          onArmSound={armSound}
        />
      )}
    </>
  );
}
