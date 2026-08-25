import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PROJECTOR_AUDIO_REARM_EVENT } from '../../lib/siteAudio';
import { getSupabaseClient } from '../../lib/supabase';
import { BunkerEmergencyScene } from './BunkerEmergencyScene';
import { BunkerQuestScene, phaseForGlobalGameState } from './BunkerQuestScene';
import { createBunkerAudioController, type BunkerAudioFinaleController } from './bunkerAudio';
import {
  bunkerNarrationSession,
  type BunkerNarrationSessionController,
} from './bunkerNarration';
import { setBunkerPresentationProtected } from './bunkerProtection';
import { subscribeToBunkerRefresh, type BunkerRealtimeClient } from './bunker.realtime';
import { getBunkerScreenState, type BunkerRpcClient, type BunkerScreenState } from './bunker.service';
import { getMissionOneScreenReadModel, type MissionOneRpcClient, type MissionOneScreenReadModel as M01 } from './v2/m01.service';
import type { MissionOneScreenReadModel } from './v2/MissionOneScreen';
import { getMissionTwoScreenReadModel, type MissionTwoScreenReadModel as M02 } from './v2/m02.service';
import type { MissionTwoScreenModel } from './v2/MissionTwoScreen';
import { getMissionThreeScreenReadModel, type MissionThreeScreenReadModel as M03 } from './v2/m03.service';
import type { MissionThreeScreenModel } from './v2/MissionThreeScreen';
import { getMissionFourScreenReadModel, type MissionFourScreenReadModel as M04 } from './v2/m04.service';
import type { MissionFourScreenModel } from './v2/MissionFourScreen';
import { getMissionFiveScreenReadModel, type MissionFiveScreenReadModel as M05 } from './v2/m05.service';
import type { MissionFiveScreenModel } from './v2/MissionFiveScreen';
import { getMissionSixScreenReadModel, type MissionSixScreenReadModel as M06 } from './v2/m06.service';
import type { MissionSixScreenModel } from './v2/MissionSixScreen';
import { getUnknownPassengerScreenReadModel, type UnknownPassengerScreenReadModel } from './v2/unknownPassenger.service';
import { UnknownPassengerScreen, type UnknownPassengerScreenModel } from './v2/UnknownPassengerScreen';
import { getFinalScreenReadModel, type FinalScreenReadModel } from './v2/final.service';
import { FinalScreen, type FinalScreenModel } from './v2/FinalScreen';
import { getBunkerV2Results, type BunkerV2ResultSummary, type BunkerV2ResultsReadModel } from './v2/results.service';
import { BunkerResultsScreen, type BunkerResultsScreenModel } from './v2/BunkerResultsScreen';
import { getBunkerMissionContent } from './v2/content/missionContent';
import { BunkerOperatorTransmission } from './operator/BunkerOperatorTransmission';
import { LizaRevealScreen } from './operator/LizaRevealScreen';
import {
  getBunkerOperatorFeed,
  useBunkerOperatorFeed,
  type BunkerOperatorFeedDependencies,
  type BunkerOperatorFeedRpcClient,
} from './operator/useBunkerOperatorFeed';

export type BunkerScreenGuardDependencies = {
  load: () => Promise<BunkerScreenState>;
  loadMissionOne?: () => Promise<M01>;
  loadMissionTwo?: () => Promise<M02>;
  loadMissionThree?: () => Promise<M03>;
  loadMissionFour?: () => Promise<M04>;
  loadMissionFive?: () => Promise<M05>;
  loadMissionSix?: () => Promise<M06>;
  loadUnknownPassenger?: () => Promise<UnknownPassengerScreenReadModel>;
  loadFinal?: () => Promise<FinalScreenReadModel>;
  loadResults?: () => Promise<BunkerV2ResultsReadModel>;
  loadOperatorFeed?: BunkerOperatorFeedDependencies['load'];
  subscribe?: (callback: () => void) => () => void;
  audio?: BunkerAudioFinaleController;
  narration?: BunkerNarrationSessionController;
};

type Props = { eventSlug?: string; dependencies?: BunkerScreenGuardDependencies; children: ReactNode };
type Timed<T> = { model: T; receivedAt: number };
const BUNKER_AUTOMATIC_INTRO_ID = 'bunker-run-intro';
const BUNKER_REVEAL_AUDIO_DELAY_MS = 1_600;
type AmbienceAuthorization = {
  run: string | null;
  status: 'idle' | 'pending' | 'blocked' | 'armed';
  revision: number;
};

function browserDependencies(eventSlug: string): BunkerScreenGuardDependencies | null {
  try {
    const client = getSupabaseClient();
    const rpc = client as unknown as BunkerRpcClient & MissionOneRpcClient;
    const realtime = client as unknown as BunkerRealtimeClient;
    return {
      load: () => getBunkerScreenState(rpc, eventSlug),
      loadMissionOne: () => getMissionOneScreenReadModel(rpc, eventSlug),
      loadMissionTwo: () => getMissionTwoScreenReadModel(rpc, eventSlug),
      loadMissionThree: () => getMissionThreeScreenReadModel(rpc, eventSlug),
      loadMissionFour: () => getMissionFourScreenReadModel(rpc, eventSlug),
      loadMissionFive: () => getMissionFiveScreenReadModel(rpc, eventSlug),
      loadMissionSix: () => getMissionSixScreenReadModel(rpc, eventSlug),
      loadUnknownPassenger: () => getUnknownPassengerScreenReadModel(rpc, eventSlug),
      loadFinal: () => getFinalScreenReadModel(rpc, eventSlug),
      loadResults: () => getBunkerV2Results(rpc, eventSlug),
      loadOperatorFeed: () => getBunkerOperatorFeed(
        client as unknown as BunkerOperatorFeedRpcClient,
        eventSlug,
      ),
      subscribe: (callback) => subscribeToBunkerRefresh(realtime, eventSlug, callback),
      audio: createBunkerAudioController(),
      narration: bunkerNarrationSession,
    };
  } catch {
    return null;
  }
}

function remaining(deadline: string, serverNow: string, receivedAt: number, now: number) {
  return Math.max(
    0,
    Math.ceil((Date.parse(deadline) - Date.parse(serverNow)) / 1000 - (now - receivedAt) / 1000),
  );
}

function missionOneModel(
  value: Timed<Extract<M01, { status: 'active' }>> | null,
  now: number,
): MissionOneScreenReadModel | undefined {
  return value ? {
    title: value.model.title,
    publicSummary: value.model.publicSummary,
    remainingSeconds: remaining(value.model.deadlineAt, value.model.serverNow, value.receivedAt, now),
    wagons: value.model.wagons,
  } : undefined;
}

function missionTwoModel(
  value: Timed<Extract<M02, { status: 'active' | 'completed' }>> | null,
  now: number,
): MissionTwoScreenModel | undefined {
  return value ? {
    title: value.model.title,
    subtitle: value.model.subtitle,
    remainingSeconds: remaining(value.model.deadlineAt, value.model.serverNow, value.receivedAt, now),
    wagons: value.model.wagons,
  } : undefined;
}

function missionThreeModel(
  value: Timed<Extract<M03, { status: 'active' | 'completed' }>> | null,
  now: number,
): MissionThreeScreenModel | undefined {
  return value ? {
    title: value.model.title,
    remainingSeconds: remaining(value.model.deadlineAt, value.model.serverNow, value.receivedAt, now),
    wagons: value.model.wagons,
  } : undefined;
}

function missionFourModel(
  value: Timed<Extract<M04, { status: 'active' | 'completed' }>> | null,
  now: number,
): MissionFourScreenModel | undefined {
  return value ? {
    title: value.model.title,
    remainingSeconds: remaining(value.model.deadlineAt, value.model.serverNow, value.receivedAt, now),
    groups: value.model.groups,
  } : undefined;
}

function missionFiveModel(
  value: Timed<Extract<M05, { status: 'active' | 'completed' }>> | null,
  now: number,
): MissionFiveScreenModel | undefined {
  return value ? {
    title: value.model.title,
    remainingSeconds: remaining(value.model.deadlineAt, value.model.serverNow, value.receivedAt, now),
    wagons: value.model.wagons,
  } : undefined;
}

function missionSixModel(
  value: Timed<Extract<M06, { status: 'active' | 'completed' }>> | null,
  now: number,
): MissionSixScreenModel | undefined {
  return value ? {
    title: value.model.title,
    remainingSeconds: remaining(value.model.deadlineAt, value.model.serverNow, value.receivedAt, now),
    fragmentsRevealed: value.model.fragmentsRevealed,
    fragmentsTotal: value.model.fragmentsTotal,
    wagons: value.model.wagons,
  } : undefined;
}

function storyModel(
  value: Timed<Extract<UnknownPassengerScreenReadModel, { status: 'active' }>> | null,
  now: number,
): UnknownPassengerScreenModel | undefined {
  return value ? {
    title: value.model.title,
    dossierId: value.model.dossierId,
    sector: value.model.sector,
    remainingSeconds: remaining(value.model.deadlineAt, value.model.serverNow, value.receivedAt, now),
  } : undefined;
}

function finalModel(
  value: Timed<Extract<FinalScreenReadModel, { status: 'active' | 'completed' }>> | null,
  now: number,
): FinalScreenModel | undefined {
  return value ? {
    remainingSeconds: remaining(value.model.deadlineAt, value.model.serverNow, value.receivedAt, now),
    solved: value.model.solved,
    total: value.model.total,
    wrongAttempts: value.model.wrongAttempts,
    unlocked: value.model.unlocked,
    hintLevel: value.model.hintLevel,
    timeAdjustmentSeconds: value.model.timeAdjustmentSeconds,
  } : undefined;
}

function resultModel(value: Timed<BunkerV2ResultSummary> | null): BunkerResultsScreenModel | undefined {
  if (!value) return undefined;
  const { contractVersion: _contractVersion, status: _status, serverNow: _serverNow, ...result } = value.model;
  return result;
}

function stateRemaining(
  state: Extract<BunkerScreenState, { status: 'active' }>,
  now: number,
  serverOffset: number,
) {
  const started = Date.parse(state.startedAt);
  return Number.isFinite(started)
    ? Math.max(0, Math.ceil(state.durationSeconds - (now + serverOffset - started) / 1000))
    : state.remainingSeconds;
}

export function BunkerScreenGuard({ eventSlug = 'liza-viktor', dependencies, children }: Props) {
  const [browserDeps, setBrowserDeps] = useState<BunkerScreenGuardDependencies | null>(null);
  const deps = dependencies ?? browserDeps;
  const [state, setState] = useState<BunkerScreenState | null>(null);
  const [one, setOne] = useState<any>(null);
  const [two, setTwo] = useState<any>(null);
  const [three, setThree] = useState<any>(null);
  const [four, setFour] = useState<any>(null);
  const [five, setFive] = useState<any>(null);
  const [six, setSix] = useState<any>(null);
  const [unknown, setUnknown] = useState<any>(null);
  const [final, setFinal] = useState<any>(null);
  const [results, setResults] = useState<Timed<BunkerV2ResultSummary> | null>(null);
  const [contractVersion, setContractVersion] = useState<1 | 2 | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [motion, setMotion] = useState<'full' | 'reduced'>(() => (
    typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'reduced'
      : 'full'
  ));
  const offset = useRef(0);
  const latest = useRef(Number.NEGATIVE_INFINITY);
  const ambiencePlayToken = useRef(0);
  const ambienceAuthorization = useRef<AmbienceAuthorization>({
    run: null,
    status: 'idle',
    revision: 0,
  });
  const revealPlayToken = useRef(0);
  const revealSequence = useRef<{ run: string; doorPlayed: boolean; complete: boolean } | null>(null);
  const missionCompletion = useRef<{ key: string | null; complete: boolean }>({ key: null, complete: false });
  const completedMissionCues = useRef(new Set<string>());
  const loadGeneration = useRef(0);
  const loadInFlight = useRef<Promise<BunkerScreenState | null> | null>(null);

  const applyState = useCallback((next: BunkerScreenState) => {
    const received = Date.now();
    const server = Date.parse(next.serverNow);
    if (Number.isFinite(server) && server < latest.current) return false;
    if (Number.isFinite(server)) latest.current = server;
    offset.current = Number.isFinite(server) ? server - received : 0;
    setState(next);
    setNowMs(received);
    return true;
  }, []);

  const reloadMain = useCallback((): Promise<BunkerScreenState | null> => {
    if (!deps) return Promise.resolve(null);
    if (loadInFlight.current) return loadInFlight.current;
    const generation = loadGeneration.current;
    let request: Promise<BunkerScreenState | null>;
    request = deps.load()
      .then((next) => {
        if (loadGeneration.current === generation) applyState(next);
        return next;
      })
      .catch(() => null)
      .finally(() => {
        if (loadInFlight.current === request) loadInFlight.current = null;
      });
    loadInFlight.current = request;
    return request;
  }, [applyState, deps]);

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
    const update = () => setMotion(query.matches ? 'reduced' : 'full');
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  const applyProjection = (next: any, set: (value: any) => void) => {
    if (!next) return;
    if (next.status === 'legacy') {
      setContractVersion(1);
      set(null);
      return;
    }
    // An authoritative V2 projection may briefly be idle while the owner RPC
    // advances the mission.  Keep the projector on the protected V2 loading
    // scene instead of falling back to the legacy dossier during that race.
    if (next.contractVersion === 2) {
      setContractVersion(2);
    }
    if (next.status === 'active' || next.status === 'completed') {
      setContractVersion(2);
      set({ model: next, receivedAt: Date.now() });
      return;
    }
    set(null);
  };

  const refresh = () => {
    if (!deps) return;
    void reloadMain();
    void Promise.resolve(deps.loadMissionOne?.() ?? null)
      .then((value) => applyProjection(value, setOne)).catch(() => {});
    void Promise.resolve(deps.loadMissionTwo?.() ?? null)
      .then((value) => applyProjection(value, setTwo)).catch(() => {});
    void Promise.resolve(deps.loadMissionThree?.() ?? null)
      .then((value) => applyProjection(value, setThree)).catch(() => {});
    void Promise.resolve(deps.loadMissionFour?.() ?? null)
      .then((value) => applyProjection(value, setFour)).catch(() => {});
    void Promise.resolve(deps.loadMissionFive?.() ?? null)
      .then((value) => applyProjection(value, setFive)).catch(() => {});
    void Promise.resolve(deps.loadMissionSix?.() ?? null)
      .then((value) => applyProjection(value, setSix)).catch(() => {});
    void Promise.resolve(deps.loadUnknownPassenger?.() ?? null)
      .then((value) => applyProjection(value, setUnknown)).catch(() => {});
    void Promise.resolve(deps.loadFinal?.() ?? null)
      .then((value) => applyProjection(value, setFinal)).catch(() => {});
    if (deps.loadResults) {
      void deps.loadResults().then((value) => {
        if (value.status === 'completed') {
          setContractVersion(2);
          setResults({ model: value, receivedAt: Date.now() });
        } else {
          setResults(null);
        }
      }).catch(() => {});
    }
  };
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!deps) return;
    const reload = () => refreshRef.current();
    reload();
    const unsubscribe = deps.subscribe?.(reload);
    window.addEventListener('focus', reload);
    window.addEventListener('online', reload);
    return () => {
      loadGeneration.current += 1;
      loadInFlight.current = null;
      unsubscribe?.();
      window.removeEventListener('focus', reload);
      window.removeEventListener('online', reload);
    };
  }, [deps, reloadMain]);

  const remainingSeconds = state?.status === 'active'
    ? stateRemaining(state, nowMs, offset.current)
    : 0;
  const bunkerActive = state?.status === 'active';
  const operatorSessionKey = state?.status === 'active'
    ? `${eventSlug}:${state.startedAt}`
    : `${eventSlug}:inactive`;
  const operatorFeedDependencies = useMemo<BunkerOperatorFeedDependencies | null>(() => (
    deps?.loadOperatorFeed
      ? { load: deps.loadOperatorFeed, subscribe: deps.subscribe }
      : null
  ), [deps]);
  const operatorFeed = useBunkerOperatorFeed({
    eventSlug,
    sessionKey: operatorSessionKey,
    enabled: Boolean(bunkerActive && operatorFeedDependencies),
    dependencies: operatorFeedDependencies,
  });
  const phase = state?.status === 'active'
    ? phaseForGlobalGameState(state.globalGameState, state.phase ?? 'emergency')
    : null;
  const emergency = bunkerActive && phase === 'emergency';
  const explicitV2 = contractVersion === 2;
  const storyActive = bunkerActive
    && explicitV2
    && state?.status === 'active'
    && state.globalGameState === 'UNKNOWN_PASSENGER';
  const finalActive = bunkerActive
    && explicitV2
    && state?.status === 'active'
    && state.globalGameState === 'FINAL_30';
  const revealActive = bunkerActive
    && state?.status === 'active'
    && state.globalGameState === 'BUNKER_OPEN';
  const resultsActive = bunkerActive
    && explicitV2
    && state?.status === 'active'
    && state.globalGameState === 'FINISHED';
  const storyView = storyModel(unknown, nowMs);
  const finalView = finalModel(final, nowMs);
  const resultsView = resultModel(results);
  const narrationContent = state?.status === 'active'
    ? getBunkerMissionContent(state.currentMission?.id ?? state.globalGameState)
    : undefined;
  const narrationRunIdentity = state?.status === 'active' ? state.startedAt : null;
  const completionProgress = state?.status === 'active'
    && state.missionProgress
    && /^MISSION_0[1-6]$/.test(state.missionProgress.missionState)
    ? state.missionProgress
    : null;
  const completionKey = state?.status === 'active' && completionProgress
    ? `${eventSlug}:${state.startedAt}:${completionProgress.missionState}`
    : null;
  const completionReached = completionProgress?.complete === true;

  useEffect(() => {
    setBunkerPresentationProtected(bunkerActive);
    return () => setBunkerPresentationProtected(false);
  }, [bunkerActive]);

  useEffect(() => {
    const previous = missionCompletion.current;
    if (previous.key !== completionKey) {
      missionCompletion.current = { key: completionKey, complete: completionReached };
      return;
    }
    const transitioned = !previous.complete && completionReached;
    missionCompletion.current = { key: completionKey, complete: completionReached };
    if (!transitioned || !completionKey || completedMissionCues.current.has(completionKey)) return;
    completedMissionCues.current.add(completionKey);
    if (state?.status === 'active' && state.soundEnabled) deps?.audio?.playSuccess();
  }, [completionKey, completionReached, deps?.audio, state?.status === 'active' ? state.soundEnabled : false]);

  useEffect(() => {
    if (!bunkerActive || remainingSeconds <= 0) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [bunkerActive, remainingSeconds <= 0]);

  useEffect(() => {
    if (!deps) return;
    const interval = window.setInterval(() => refreshRef.current(), bunkerActive ? 2_000 : 1_500);
    return () => window.clearInterval(interval);
  }, [deps, bunkerActive]);

  useEffect(() => {
    const audio = deps?.audio;
    if (!audio) return;
    if (!emergency || remainingSeconds <= 0 || state?.status !== 'active' || !state.soundEnabled) {
      audio.stopAlarm();
      return;
    }
    audio.startAlarm();
    void audio.arm();
    return () => audio.stopAlarm();
  }, [deps, emergency, remainingSeconds <= 0, state?.status === 'active' ? state.soundEnabled : false]);

  useEffect(() => {
    const audio = deps?.audio;
    if (!audio) return;
    const token = ++ambiencePlayToken.current;
    const run = narrationRunIdentity;
    if (ambienceAuthorization.current.run !== run) {
      ambienceAuthorization.current = {
        run,
        status: 'idle',
        revision: ambienceAuthorization.current.revision + 1,
      };
    }
    if (!bunkerActive || emergency || revealActive || resultsActive || state?.status !== 'active' || !state.soundEnabled) {
      audio.stopAmbience();
      return;
    }
    let active = true;
    let started = false;
    const startAuthorizedAmbience = () => {
      if (!active || token !== ambiencePlayToken.current || started) return;
      started = true;
      audio.startAmbience();
    };
    const startWhenArmed = (explicitRearm = false) => {
      const authorization = ambienceAuthorization.current;
      if (authorization.run !== run || authorization.status === 'pending') return;
      if (authorization.status === 'armed') {
        startAuthorizedAmbience();
        return;
      }
      if (authorization.status === 'blocked' && !explicitRearm) return;
      authorization.status = 'pending';
      authorization.revision += 1;
      const revision = authorization.revision;
      void audio.arm()
        .then((armed) => {
          const current = ambienceAuthorization.current;
          if (current.run !== run || current.revision !== revision) return;
          current.status = armed ? 'armed' : 'blocked';
          if (armed) startAuthorizedAmbience();
        })
        .catch(() => {
          const current = ambienceAuthorization.current;
          if (current.run === run && current.revision === revision) current.status = 'blocked';
        });
    };
    startWhenArmed();
    const rearm = () => startWhenArmed(true);
    window.addEventListener(PROJECTOR_AUDIO_REARM_EVENT, rearm);
    return () => {
      active = false;
      ambiencePlayToken.current += 1;
      const authorization = ambienceAuthorization.current;
      if (authorization.run === run && authorization.status === 'pending') {
        authorization.status = 'blocked';
        authorization.revision += 1;
      }
      window.removeEventListener(PROJECTOR_AUDIO_REARM_EVENT, rearm);
      audio.stopAmbience();
    };
  }, [
    deps?.audio,
    bunkerActive,
    emergency,
    narrationRunIdentity,
    revealActive,
    resultsActive,
    state?.status === 'active' ? state.soundEnabled : false,
  ]);

  useEffect(() => {
    const audio = deps?.audio;
    if (!audio) return;
    const token = ++revealPlayToken.current;
    audio.stopFinale();
    if (!revealActive || state?.status !== 'active' || !state.soundEnabled) return;
    if (revealSequence.current?.run !== operatorSessionKey) {
      revealSequence.current = { run: operatorSessionKey, doorPlayed: false, complete: false };
    }
    if (revealSequence.current.complete) return;

    let active = true;
    let armPending = false;
    let revealTimer: number | null = null;
    const startWhenArmed = () => {
      const sequence = revealSequence.current;
      if (armPending || revealTimer !== null || !sequence || sequence.run !== operatorSessionKey || sequence.complete) return;
      armPending = true;
      void audio.arm()
        .then((armed) => {
          armPending = false;
          const currentSequence = revealSequence.current;
          if (!active || token !== revealPlayToken.current || !armed
            || !currentSequence || currentSequence.run !== operatorSessionKey || currentSequence.complete) return;
          audio.stopAlarm();
          audio.stopAmbience();
          if (!currentSequence.doorPlayed) {
            currentSequence.doorPlayed = true;
            audio.playDoorUnlock();
          }
          revealTimer = window.setTimeout(() => {
            if (!active || token !== revealPlayToken.current) return;
            const completingSequence = revealSequence.current;
            if (!completingSequence || completingSequence.run !== operatorSessionKey || completingSequence.complete) return;
            completingSequence.complete = true;
            revealTimer = null;
            audio.playReveal();
            audio.playFinale();
          }, BUNKER_REVEAL_AUDIO_DELAY_MS);
        })
        .catch(() => { armPending = false; });
    };

    startWhenArmed();
    window.addEventListener(PROJECTOR_AUDIO_REARM_EVENT, startWhenArmed);
    return () => {
      active = false;
      revealPlayToken.current += 1;
      if (revealTimer !== null) window.clearTimeout(revealTimer);
      window.removeEventListener(PROJECTOR_AUDIO_REARM_EVENT, startWhenArmed);
      audio.stopFinale();
    };
  }, [
    deps?.audio,
    operatorSessionKey,
    revealActive,
    state?.status === 'active' ? state.soundEnabled : false,
  ]);

  useEffect(() => {
    const narration = deps?.narration;
    if (!narration) return;
    narration.setRun(narrationRunIdentity);
    return () => narration.setRun(null);
  }, [deps?.narration, narrationRunIdentity]);

  useEffect(() => {
    const narration = deps?.narration;
    const audio = deps?.audio;
    if (!narration) return;
    if (!bunkerActive || state?.status !== 'active' || !narrationContent) {
      narration.setMission(null);
      return;
    }

    narration.setMission({
      id: BUNKER_AUTOMATIC_INTRO_ID,
      text: narrationContent.intro.narration,
    });
    narration.setArmed(false);
    let active = true;
    const armNarration = () => {
      if (!audio || !state.soundEnabled) {
        narration.setArmed(false);
        return;
      }
      void audio.arm()
        .then((armed) => { if (active) narration.setArmed(armed); })
        .catch(() => { if (active) narration.setArmed(false); });
    };

    armNarration();
    window.addEventListener(PROJECTOR_AUDIO_REARM_EVENT, armNarration);
    return () => {
      active = false;
      window.removeEventListener(PROJECTOR_AUDIO_REARM_EVENT, armNarration);
      narration.setMission(null);
      narration.stop();
    };
  }, [
    deps,
    bunkerActive,
    narrationRunIdentity,
    narrationContent?.key,
    narrationContent?.intro.narration,
    state?.status === 'active' ? state.currentMission?.id : null,
    state?.status === 'active' ? state.soundEnabled : false,
  ]);

  return (
    <>
      {children}
      {bunkerActive && state?.status === 'active' && phase === 'emergency' && (
        <BunkerEmergencyScene remainingSeconds={remainingSeconds} motionPreference={motion} />
      )}
      {storyActive && (
        storyView ? <UnknownPassengerScreen model={storyView} /> : (
          <section className="bunker-v2-screen bunker-v2-unknown-passenger-screen" aria-label="Неизвестный оператор · общий экран">
            <p role="status">НЕИЗВЕСТНЫЙ ОПЕРАТОР · ЗАГРУЖАЕМ ДОСЬЕ BK-17…</p>
          </section>
        )
      )}
      {finalActive && (
        finalView ? <FinalScreen model={finalView} /> : (
          <section className="bunker-v2-screen bunker-v2-final-screen" aria-label="Финал · общий экран">
            <p role="status">ФИНАЛ · СИНХРОНИЗИРУЕМ ТЕРМИНАЛ…</p>
          </section>
        )
      )}
      {revealActive && (
        <LizaRevealScreen
          sessionKey={operatorSessionKey}
          soundEnabled={state?.status === 'active' && state.soundEnabled}
        />
      )}
      {resultsActive && (
        resultsView ? <BunkerResultsScreen model={resultsView} /> : (
          <section className="bunker-v2-screen bunker-v2-results" aria-label="Бункер открыт · итоги игры">
            <h1>БУНКЕР ОТКРЫТ</h1>
            <p role="status">СОБИРАЕМ ИТОГИ ВАШЕГО СОСТАВА…</p>
          </section>
        )
      )}
      {bunkerActive
        && state?.status === 'active'
        && phase !== 'emergency'
        && !storyActive
        && !finalActive
        && !revealActive
        && !resultsActive && (
          <BunkerQuestScene
            key={state.globalGameState ?? phase}
            state={state}
            remainingSeconds={remainingSeconds}
            motionPreference={motion}
            missionOne={missionOneModel(one, nowMs)}
            missionTwo={missionTwoModel(two, nowMs)}
            missionThree={missionThreeModel(three, nowMs)}
            missionFour={missionFourModel(four, nowMs)}
            missionFive={missionFiveModel(five, nowMs)}
            missionSix={missionSixModel(six, nowMs)}
            bunkerContractVersion={contractVersion ?? 2}
          />
        )}
      {bunkerActive && !revealActive && !resultsActive && (
        <BunkerOperatorTransmission
          sessionKey={operatorSessionKey}
          variant="projector"
          message={operatorFeed.feed?.message ?? null}
          motionPreference={motion}
          soundEnabled={state?.status === 'active' && state.soundEnabled}
        />
      )}
    </>
  );
}
