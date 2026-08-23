import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { getOrCreateDeviceKey } from '../../lib/deviceIdentity';
import { getSupabaseClient } from '../../lib/supabase';
import { PROJECTOR_AUDIO_REARM_EVENT, siteAudio } from '../../lib/siteAudio';
import {
  getBunkerPresentationProtected,
  subscribeToBunkerPresentationProtection,
} from '../bunker/bunkerProtection';
import { ChampionScene } from '../mortalKombat/ChampionScene';
import { MkFightScene } from '../mortalKombat/MkFightScene';
import { subscribeToMkRefresh, type MkRealtimeClient } from '../mortalKombat/mk.realtime';
import { getMkTournamentScreenState, type MkRpcClient } from '../mortalKombat/mk.service';
import type { MkTournamentProjection } from '../mortalKombat/mk.types';
import { PublicBracket } from '../mortalKombat/PublicBracket';
import { createPremiereAudioController } from '../premiere/premiereAudio';
import {
  broadcastPremiereScreenPresence,
  type PremierePresenceRealtimeClient,
  type PremiereScreenPresence,
} from '../premiere/premierePresence.realtime';
import {
  subscribeToPremiereRefresh,
  type PremiereRealtimeClient,
} from '../premiere/premiere.realtime';
import {
  getPremiereScreenState,
  type PremiereRpcClient,
  type PremiereScreenState,
} from '../premiere/premiere.service';
import {
  getRevealedCoupleAnswer,
  type CoupleRevealRpcClient,
  type RevealedCoupleAnswer,
} from '../quiz/coupleReveal.service';
import {
  getRevealedFinalFive,
  type FinalFiveRpcClient,
  type RevealedFinalFive,
} from '../quiz/finalFive.service';
import {
  getQuizScreenState,
  type QuizScreenRpcClient,
  type QuizScreenState,
} from '../quiz/quizScreen.service';
import { quizPresentationKey } from '../quiz/quizPresentation';
import {
  subscribeToQuizRefresh,
  type QuizRealtimeClient,
} from '../quiz/quiz.realtime';
import { CarriageCallScene } from './CarriageCallScene';
import { BoardingSummaryScene } from './BoardingSummaryScene';
import {
  announcementQueueReducer,
  createAnnouncementQueueState,
} from './arrivalAnnouncementQueue';
import { CarriageMapScreen } from './CarriageMapScreen';
import {
  getRegistrationCarriageMap,
  type CarriageMapRpcClient,
  type RegistrationCarriageMap,
} from './carriageMap.service';
import { hasConnectionFailures, updateConnectionHealth, type ConnectionSource } from './connectionHealth';
import { CoupleAnswerRevealScene } from './CoupleAnswerRevealScene';
import { FinalFiveRevealScene } from './FinalFiveRevealScene';
import { IdleRegistrationScreen } from './IdleRegistrationScreen';
import { PremiereScreen } from './premiere/PremiereScreen';
import { QuizScreenScene } from './QuizScreenScene';
import { createScreenAudioController } from './screenAudio';
import {
  subscribeToScreenEvents,
  type ScreenEventsRealtimeClient,
  type ScreenPresentationEvent,
} from './screenEvents.realtime';
import { TrainArrivalScene } from './TrainArrivalScene';

export type ScreenPageDependencies = {
  subscribe: (callback: (event: ScreenPresentationEvent) => void) => () => void;
  loadQuiz?: () => Promise<QuizScreenState>;
  loadCoupleAnswer?: () => Promise<RevealedCoupleAnswer>;
  loadFinalFive?: () => Promise<RevealedFinalFive>;
  loadPremiere?: () => Promise<PremiereScreenState>;
  loadMortalKombat?: () => Promise<MkTournamentProjection>;
  loadCarriageMap?: () => Promise<RegistrationCarriageMap>;
  subscribeToQuizRefresh?: (callback: () => void) => () => void;
  subscribeToPremiereRefresh?: (callback: () => void) => () => void;
  subscribeToMkRefresh?: (callback: () => void) => () => void;
  broadcastPremierePresence?: (presence: PremiereScreenPresence) => Promise<void>;
  prepareArrival?: () => Promise<boolean>;
  armArrivalAudio?: () => Promise<boolean>;
  playArrivalSignal?: () => void;
  playQuizVotingSignal?: () => void;
  playQuizRevealSignal?: () => void;
  stopArrivalAudio?: () => void;
  armPremiereAudio?: () => Promise<boolean>;
  playPremiereCountdownTick?: (second: number) => void;
  disposeAudio?: () => void;
  disposePremiereAudio?: () => void;
};

type ScreenPageProps = {
  joinUrl: string;
  eventSlug?: string;
  screenId?: string;
  sceneDurationMs?: number;
  carriageCallDurationMs?: number;
  expectedGuestCount?: number;
  dependencies?: ScreenPageDependencies;
};

function browserDependencies(eventSlug: string): ScreenPageDependencies {
  const client = getSupabaseClient();
  const screenClient = client as unknown as ScreenEventsRealtimeClient;
  const mkRpcClient = client as unknown as MkRpcClient;
  const mkRealtimeClient = client as unknown as MkRealtimeClient;
  const quizRpcClient = client as unknown as QuizScreenRpcClient;
  const coupleRevealRpcClient = client as unknown as CoupleRevealRpcClient;
  const finalFiveRpcClient = client as unknown as FinalFiveRpcClient;
  const quizRealtimeClient = client as unknown as QuizRealtimeClient;
  const premiereRpcClient = client as unknown as PremiereRpcClient;
  const premiereRealtimeClient = client as unknown as PremiereRealtimeClient;
  const premierePresenceClient = client as unknown as PremierePresenceRealtimeClient;
  const carriageMapRpcClient = client as unknown as CarriageMapRpcClient;
  const audio = createScreenAudioController();
  const premiereAudio = createPremiereAudioController();
  return {
    subscribe: (callback) => subscribeToScreenEvents(screenClient, eventSlug, callback),
    loadQuiz: () => getQuizScreenState(quizRpcClient, eventSlug),
    loadCoupleAnswer: () => getRevealedCoupleAnswer(coupleRevealRpcClient, eventSlug),
    loadFinalFive: () => getRevealedFinalFive(finalFiveRpcClient, eventSlug),
    loadPremiere: () => getPremiereScreenState(premiereRpcClient, eventSlug),
    loadMortalKombat: () => getMkTournamentScreenState(mkRpcClient, eventSlug),
    loadCarriageMap: () => getRegistrationCarriageMap(carriageMapRpcClient, eventSlug),
    subscribeToQuizRefresh: (callback) => subscribeToQuizRefresh(
      quizRealtimeClient,
      eventSlug,
      callback,
    ),
    subscribeToPremiereRefresh: (callback) => subscribeToPremiereRefresh(
      premiereRealtimeClient,
      eventSlug,
      callback,
    ),
    subscribeToMkRefresh: (callback) => subscribeToMkRefresh(
      mkRealtimeClient,
      eventSlug,
      callback,
    ),
    broadcastPremierePresence: (presence) => broadcastPremiereScreenPresence(
      premierePresenceClient,
      eventSlug,
      presence,
    ),
    prepareArrival: () => prepareArrivalExperience(audio.prepareArrival),
    armArrivalAudio: audio.arm,
    playArrivalSignal: audio.playArrival,
    playQuizVotingSignal: audio.playQuizVoting,
    playQuizRevealSignal: audio.playQuizReveal,
    stopArrivalAudio: audio.stopArrival,
    armPremiereAudio: premiereAudio.arm,
    playPremiereCountdownTick: premiereAudio.playCountdownTick,
    disposeAudio: audio.dispose,
    disposePremiereAudio: premiereAudio.dispose,
  };
}

function isPremiereProtected(state: PremiereScreenState | null): boolean {
  return state?.status === 'standby'
    || state?.status === 'countdown'
    || state?.status === 'playing'
    || state?.status === 'paused'
    || state?.status === 'black';
}

function isMortalKombatProtected(state: MkTournamentProjection | null): state is Extract<MkTournamentProjection, { status: 'active' }> {
  return state?.status === 'active' && (state.state === 'active' || state.state === 'complete');
}

function premiereMediaUrl(state: PremiereScreenState | null): string | null {
  if (
    state?.status === 'standby'
    || state?.status === 'countdown'
    || state?.status === 'playing'
    || state?.status === 'paused'
  ) {
    return state.mediaUrl;
  }
  return null;
}

function browserLooksOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

const ARRIVAL_VISUAL_ASSETS = [
  '/images/wedding/arrival-train-sprite-v2.png',
  '/images/wedding/arrival-train-smoke-v2.png',
] as const;

function preloadDecodedImage(src: string): Promise<boolean> {
  if (typeof Image === 'undefined') return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      image.onload = null;
      image.onerror = null;
      resolve(ready);
    };
    image.decoding = 'async';
    image.onload = () => {
      if (typeof image.decode !== 'function') {
        finish(image.naturalWidth > 0);
        return;
      }
      void image.decode()
        .then(() => finish(image.naturalWidth > 0))
        .catch(() => finish(image.complete && image.naturalWidth > 0));
    };
    image.onerror = () => finish(false);
    image.src = src;
  });
}

async function prepareArrivalExperience(prepareAudio: () => Promise<boolean>): Promise<boolean> {
  const readiness = await Promise.all([
    prepareAudio(),
    ...ARRIVAL_VISUAL_ASSETS.map((src) => preloadDecodedImage(src)),
  ]);
  return readiness.every(Boolean);
}

function armWithTimeout(
  arm: (() => Promise<boolean>) | undefined,
  timeoutMs = 1500,
): Promise<boolean> {
  if (!arm) return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(ready);
    };
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    void arm().then((ready) => finish(Boolean(ready))).catch(() => finish(false));
  });
}

function prepareWithTimeout(
  prepare: () => Promise<boolean>,
  timeoutMs = 4_000,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(ready);
    };
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    void prepare().then((ready) => finish(Boolean(ready))).catch(() => finish(false));
  });
}

export function ScreenPage({
  joinUrl,
  eventSlug = 'liza-viktor',
  screenId,
  sceneDurationMs = 14_000,
  carriageCallDurationMs,
  expectedGuestCount = 40,
  dependencies,
}: ScreenPageProps) {
  const deps = useMemo(
    () => dependencies ?? browserDependencies(eventSlug),
    [dependencies, eventSlug],
  );
  const resolvedCarriageCallDurationMs = carriageCallDurationMs
    ?? (sceneDurationMs === 14_000 ? 12_000 : sceneDurationMs);
  const [resolvedScreenId] = useState(() => screenId?.trim() || `screen-${getOrCreateDeviceKey()}`);
  const hasAudioArm = Boolean(deps.armArrivalAudio || deps.armPremiereAudio);
  const [announcementQueue, dispatchAnnouncement] = useReducer(
    announcementQueueReducer,
    eventSlug,
    createAnnouncementQueueState,
  );
  const [preparedArrivalId, setPreparedArrivalId] = useState<string | null>(null);
  const [quizState, setQuizState] = useState<QuizScreenState | null>(null);
  const [coupleAnswer, setCoupleAnswer] = useState<RevealedCoupleAnswer>({ status: 'hidden' });
  const [finalFive, setFinalFive] = useState<RevealedFinalFive>({ status: 'hidden' });
  const [premiereState, setPremiereState] = useState<PremiereScreenState | null>(null);
  const [mkState, setMkState] = useState<MkTournamentProjection | null>(null);
  const [carriageMap, setCarriageMap] = useState<RegistrationCarriageMap | null>(null);
  const [premiereNowMs, setPremiereNowMs] = useState(() => Date.now());
  const [audioSettings, setAudioSettings] = useState(() => siteAudio.getSettings());
  const [audioArmed, setAudioArmed] = useState(() => !hasAudioArm);
  const [armingAudio, setArmingAudio] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [connectionFailures, setConnectionFailures] = useState<ReadonlySet<ConnectionSource>>(
    () => browserLooksOnline() ? new Set<ConnectionSource>() : new Set<ConnectionSource>(['browser']),
  );
  const [reconnectEpoch, setReconnectEpoch] = useState(0);
  const [bunkerProtected, setBunkerProtected] = useState(getBunkerPresentationProtected);
  const presentationProtectedRef = useRef(false);
  const wasPresentationProtectedRef = useRef(false);
  const protectedMapDirtyRef = useRef(false);
  const premiereClockOffsetRef = useRef(0);
  const autoAudioAttemptedRef = useRef(false);
  const arrivalReadyRef = useRef(!deps.prepareArrival);
  const arrivalPreparationRef = useRef<Promise<boolean> | null>(null);
  const lastPresentedQuizKeyRef = useRef<string | null>(null);
  const carriageMapRefreshRef = useRef<() => void>(() => undefined);

  const soundEnabled = audioSettings.enabled && audioSettings.volume > 0;
  const premiereProtected = isPremiereProtected(premiereState);
  const mortalKombatProtected = isMortalKombatProtected(mkState);
  const presentationProtected = premiereProtected || mortalKombatProtected || bunkerProtected;
  const activePresentation = announcementQueue.active?.presentation ?? null;
  const activePresentationId = activePresentation?.eventIds[0] ?? null;
  const visiblePresentation = activePresentation?.kind === 'arrival' && deps.prepareArrival
    ? (preparedArrivalId === activePresentationId ? activePresentation : null)
    : activePresentation;
  const currentPremiereMediaUrl = premiereMediaUrl(premiereState);
  const connectionDegraded = hasConnectionFailures(connectionFailures);
  presentationProtectedRef.current = presentationProtected;

  const markConnection = useCallback((source: ConnectionSource, healthy: boolean) => {
    setConnectionFailures((current) => updateConnectionHealth(current, source, healthy));
  }, []);

  const ensureArrivalPrepared = useCallback((): Promise<boolean> => {
    if (!deps.prepareArrival || arrivalReadyRef.current) return Promise.resolve(true);
    if (arrivalPreparationRef.current) return arrivalPreparationRef.current;

    const preparation = prepareWithTimeout(deps.prepareArrival)
      .then((ready) => {
        arrivalReadyRef.current = Boolean(ready);
        return Boolean(ready);
      })
      .catch(() => false)
      .finally(() => {
        if (!arrivalReadyRef.current) arrivalPreparationRef.current = null;
      });
    arrivalPreparationRef.current = preparation;
    return preparation;
  }, [deps]);

  useEffect(() => {
    arrivalReadyRef.current = !deps.prepareArrival;
    arrivalPreparationRef.current = null;
    void ensureArrivalPrepared();
  }, [deps, ensureArrivalPrepared]);

  const armAudio = useCallback(async () => {
    if (!hasAudioArm || armingAudio) return;
    if (!siteAudio.isEnabled() || siteAudio.getVolume() <= 0) {
      setAudioArmed(false);
      return;
    }

    setArmingAudio(true);
    try {
      const [arrivalReady, premiereReady] = await Promise.all([
        armWithTimeout(deps.armArrivalAudio),
        armWithTimeout(deps.armPremiereAudio),
      ]);
      setAudioArmed(Boolean(arrivalReady && premiereReady));
    } finally {
      setArmingAudio(false);
    }
  }, [armingAudio, deps, hasAudioArm]);

  useEffect(() => siteAudio.subscribe((settings) => {
    setAudioSettings(settings);
    if (!settings.enabled || settings.volume <= 0) setAudioArmed(false);
  }), []);

  useEffect(() => {
    if (!hasAudioArm || !soundEnabled || autoAudioAttemptedRef.current) return;
    autoAudioAttemptedRef.current = true;
    void armAudio();
  }, [armAudio, hasAudioArm, soundEnabled]);

  useEffect(() => {
    if (!hasAudioArm || !soundEnabled || audioArmed || armingAudio) return;
    const retry = () => void armAudio();
    window.addEventListener('pointerdown', retry, { once: true });
    window.addEventListener('keydown', retry, { once: true });
    return () => {
      window.removeEventListener('pointerdown', retry);
      window.removeEventListener('keydown', retry);
    };
  }, [armAudio, armingAudio, audioArmed, hasAudioArm, soundEnabled]);

  useEffect(() => {
    const rearm = () => void armAudio();
    window.addEventListener(PROJECTOR_AUDIO_REARM_EVENT, rearm);
    return () => window.removeEventListener(PROJECTOR_AUDIO_REARM_EVENT, rearm);
  }, [armAudio]);

  useEffect(() => subscribeToBunkerPresentationProtection((active) => {
    setBunkerProtected(active);
    if (active) {
      presentationProtectedRef.current = true;
      deps.stopArrivalAudio?.();
      setQuizState(null);
      setCoupleAnswer({ status: 'hidden' });
      setFinalFive({ status: 'hidden' });
      setPremiereState(null);
      setMkState(null);
      return;
    }
    setReconnectEpoch((current) => current + 1);
  }), [deps]);

  useEffect(() => {
    const handleOffline = () => markConnection('browser', false);
    const handleOnline = () => {
      markConnection('browser', true);
      setReconnectEpoch((current) => current + 1);
      carriageMapRefreshRef.current();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [markConnection]);

  useEffect(() => {
    const loadCarriageMap = deps.loadCarriageMap;
    if (!loadCarriageMap) {
      setCarriageMap(null);
      carriageMapRefreshRef.current = () => undefined;
      return;
    }

    let active = true;
    let inFlight = false;
    let refreshQueued = false;

    const reload = () => {
      if (!active) return;
      if (inFlight) {
        refreshQueued = true;
        return;
      }

      inFlight = true;
      void loadCarriageMap()
        .then((next) => {
          if (active) setCarriageMap(next);
        })
        .catch(() => {
          // Keep the last valid map during a temporary network failure.
        })
        .finally(() => {
          inFlight = false;
          if (!active || !refreshQueued) return;
          refreshQueued = false;
          reload();
        });
    };

    carriageMapRefreshRef.current = reload;
    reload();
    const interval = window.setInterval(reload, 2_000);

    return () => {
      active = false;
      refreshQueued = false;
      window.clearInterval(interval);
      if (carriageMapRefreshRef.current === reload) {
        carriageMapRefreshRef.current = () => undefined;
      }
    };
  }, [deps]);

  useEffect(() => deps.subscribe((event) => {
    if (event.kind === 'guest_registered') {
      if (presentationProtectedRef.current) protectedMapDirtyRef.current = true;
      else carriageMapRefreshRef.current();
    }
    dispatchAnnouncement({ type: 'receive', event });
  }), [deps]);

  useEffect(() => {
    if (!deps.loadQuiz && !deps.loadCoupleAnswer && !deps.loadFinalFive) return;
    let active = true;

    const reload = () => {
      if (deps.loadQuiz) {
        void deps.loadQuiz()
          .then((next) => {
            if (!active) return;
            setQuizState(next);
            markConnection('quiz', true);
          })
          .catch(() => {
            if (active) markConnection('quiz', false);
          });
      }

      if (deps.loadCoupleAnswer) {
        void deps.loadCoupleAnswer()
          .then((next) => {
            if (!active) return;
            setCoupleAnswer(next);
            markConnection('couple', true);
          })
          .catch(() => {
            if (active) markConnection('couple', false);
          });
      }

      if (deps.loadFinalFive) {
        void deps.loadFinalFive()
          .then((next) => {
            if (!active) return;
            setFinalFive(next);
            markConnection('finalFive', true);
          })
          .catch(() => {
            if (active) markConnection('finalFive', false);
          });
      }
    };

    reload();
    const unsubscribe = deps.subscribeToQuizRefresh?.(reload);

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [deps, reconnectEpoch, markConnection]);

  useEffect(() => {
    if (!deps.loadPremiere) return;
    let active = true;

    const reload = () => {
      void deps.loadPremiere?.()
        .then((next) => {
          if (!active) return;
          const serverMs = Date.parse(next.serverNow);
          const offset = Number.isFinite(serverMs) ? serverMs - Date.now() : 0;
          premiereClockOffsetRef.current = offset;
          setPremiereNowMs(Date.now() + offset);
          setPremiereState(next);
          markConnection('premiere', true);
        })
        .catch(() => {
          if (active) markConnection('premiere', false);
          // Keep the last valid projector state during a temporary network/realtime failure.
        });
    };

    reload();
    const unsubscribe = deps.subscribeToPremiereRefresh?.(reload);

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [deps, reconnectEpoch, markConnection]);

  useEffect(() => {
    if (!deps.loadMortalKombat) return;
    let active = true;

    const reload = () => {
      void deps.loadMortalKombat?.()
        .then((next) => {
          if (!active) return;
          setMkState(next);
          markConnection('mortalKombat', true);
        })
        .catch(() => {
          if (active) markConnection('mortalKombat', false);
          // Keep the last valid fight/bracket during a temporary network failure.
        });
    };

    reload();
    const unsubscribe = deps.subscribeToMkRefresh?.(reload);
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [deps, reconnectEpoch, markConnection]);

  useEffect(() => {
    setVideoReady(false);
  }, [currentPremiereMediaUrl]);

  useEffect(() => {
    const broadcastPresence = deps.broadcastPremierePresence;
    if (!broadcastPresence) return;
    let active = true;
    const heartbeat: PremiereScreenPresence = {
      screenId: resolvedScreenId,
      videoReady,
      audioArmed,
    };
    const report = () => {
      if (!active) return;
      void broadcastPresence(heartbeat)
        .then(() => {
          if (active) markConnection('presence', true);
        })
        .catch(() => {
          if (active) markConnection('presence', false);
        });
    };

    report();
    const interval = window.setInterval(report, 5_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [audioArmed, deps, markConnection, resolvedScreenId, videoReady]);

  useEffect(() => {
    if (premiereState?.status !== 'countdown') return;
    const updateClock = () => {
      setPremiereNowMs(Date.now() + premiereClockOffsetRef.current);
    };
    updateClock();
    const interval = window.setInterval(updateClock, 50);
    return () => window.clearInterval(interval);
  }, [premiereState?.status, premiereState?.status === 'countdown' ? premiereState.startAt : null]);

  useEffect(() => {
    dispatchAnnouncement({ type: 'set_protected', protected: presentationProtected });
    if (presentationProtected) {
      if (activePresentation?.kind === 'arrival') deps.stopArrivalAudio?.();
    } else if (wasPresentationProtectedRef.current) {
      protectedMapDirtyRef.current = false;
      carriageMapRefreshRef.current();
    }
    wasPresentationProtectedRef.current = presentationProtected;
  }, [activePresentation?.kind, deps, presentationProtected]);

  useEffect(() => {
    dispatchAnnouncement({ type: 'reset_session', sessionKey: eventSlug });
    if (presentationProtectedRef.current) {
      dispatchAnnouncement({ type: 'set_protected', protected: true });
    }
  }, [eventSlug]);

  useEffect(() => () => {
    deps.disposeAudio?.();
    deps.disposePremiereAudio?.();
  }, [deps]);

  useEffect(() => {
    if (activePresentation?.kind !== 'arrival' || !deps.prepareArrival) {
      setPreparedArrivalId(null);
      return;
    }
    let cancelled = false;
    void ensureArrivalPrepared().then(() => {
      if (!cancelled && !presentationProtectedRef.current) {
        setPreparedArrivalId(activePresentation.event.id);
      }
    });
    return () => { cancelled = true; };
  }, [activePresentation, deps.prepareArrival, ensureArrivalPrepared]);

  useEffect(() => {
    if (!visiblePresentation || presentationProtected) return;
    const durationMs = visiblePresentation.kind === 'boarding_summary'
      ? 8_000
      : visiblePresentation.kind === 'carriage_call'
        ? resolvedCarriageCallDurationMs
        : sceneDurationMs;
    const timer = window.setTimeout(() => {
      dispatchAnnouncement({ type: 'complete' });
    }, durationMs);
    return () => window.clearTimeout(timer);
  }, [presentationProtected, resolvedCarriageCallDurationMs, sceneDurationMs, visiblePresentation]);

  const playSignal = useCallback(() => {
    if (!presentationProtectedRef.current) deps.playArrivalSignal?.();
  }, [deps]);

  const playPremiereCountdownTick = useCallback((second: number) => {
    deps.playPremiereCountdownTick?.(second);
  }, [deps]);

  const activeQuiz = quizState?.status === 'active' ? quizState : null;
  const finalFiveForCurrentQuestion = activeQuiz?.phase === 'results'
    && finalFive.status === 'revealed'
    && finalFive.question.id === activeQuiz.question.id
    ? finalFive
    : null;
  const revealedForCurrentQuestion = activeQuiz?.phase === 'results'
    && coupleAnswer.status === 'revealed'
    && coupleAnswer.questionId === activeQuiz.question.id
    ? coupleAnswer
    : null;
  const currentMkMatch = mortalKombatProtected
    ? mkState.matches.find((match) => match.current) ?? null
    : null;
  const presentedQuiz = activeQuiz && !finalFiveForCurrentQuestion && !revealedForCurrentQuestion
    ? activeQuiz
    : null;

  useEffect(() => {
    lastPresentedQuizKeyRef.current = null;
  }, [eventSlug]);

  useEffect(() => {
    if (!presentedQuiz || presentationProtected || activePresentation) return;
    const key = quizPresentationKey(presentedQuiz.question.id, presentedQuiz.phase);
    if (lastPresentedQuizKeyRef.current === key) return;

    lastPresentedQuizKeyRef.current = key;
    if (presentedQuiz.phase === 'voting') deps.playQuizVotingSignal?.();
    else deps.playQuizRevealSignal?.();
  }, [activePresentation, deps, eventSlug, presentedQuiz, presentationProtected]);

  return (
    <div className={`screen-page${premiereProtected ? ' screen-page--premiere' : ''}${mortalKombatProtected ? ' screen-page--mk' : ''}`}>
      {bunkerProtected ? null : premiereProtected && premiereState ? (
        <PremiereScreen
          state={premiereState}
          nowMs={premiereNowMs}
          muted={!soundEnabled}
          onCountdownTick={playPremiereCountdownTick}
          onVideoReady={() => setVideoReady(true)}
        />
      ) : mortalKombatProtected ? (
        mkState.state === 'complete' && mkState.championGuestId ? (
          <ChampionScene championGuestId={mkState.championGuestId} players={mkState.players} />
        ) : currentMkMatch ? (
          <MkFightScene match={currentMkMatch} players={mkState.players} />
        ) : (
          <PublicBracket state={mkState} displayMode="projector" />
        )
      ) : visiblePresentation?.kind === 'arrival' ? (
        <TrainArrivalScene event={visiblePresentation.event} onSignal={playSignal} />
      ) : visiblePresentation?.kind === 'boarding_summary' ? (
        <BoardingSummaryScene summary={visiblePresentation} map={carriageMap} />
      ) : visiblePresentation?.kind === 'carriage_call' ? (
        <CarriageCallScene event={visiblePresentation.event} />
      ) : activeQuiz ? (
        finalFiveForCurrentQuestion ? (
          <FinalFiveRevealScene state={finalFiveForCurrentQuestion} />
        ) : revealedForCurrentQuestion && activeQuiz.phase === 'results' ? (
          <CoupleAnswerRevealScene
            question={activeQuiz.question.text}
            choice={revealedForCurrentQuestion.choice}
            results={activeQuiz.results}
          />
        ) : (
          <QuizScreenScene
            state={activeQuiz}
            expectedGuestCount={expectedGuestCount}
          />
        )
      ) : carriageMap?.status === 'complete' ? (
        <CarriageMapScreen map={carriageMap} variant="full" />
      ) : (
        <IdleRegistrationScreen
          joinUrl={joinUrl}
          carriageMap={carriageMap?.status === 'registration' ? carriageMap : null}
        />
      )}

      {connectionDegraded && (
        <div className="screen-connection-indicator" role="status">
          СВЯЗЬ · ПЕРЕПОДКЛЮЧЕНИЕ
        </div>
      )}

    </div>
  );
}

