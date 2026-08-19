import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getOrCreateDeviceKey } from '../../lib/deviceIdentity';
import { getSupabaseClient } from '../../lib/supabase';
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
import {
  subscribeToQuizRefresh,
  type QuizRealtimeClient,
} from '../quiz/quiz.realtime';
import { CarriageCallScene } from './CarriageCallScene';
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
  subscribeToQuizRefresh?: (callback: () => void) => () => void;
  subscribeToPremiereRefresh?: (callback: () => void) => () => void;
  subscribeToMkRefresh?: (callback: () => void) => () => void;
  broadcastPremierePresence?: (presence: PremiereScreenPresence) => Promise<void>;
  armArrivalAudio?: () => Promise<boolean>;
  playArrivalSignal?: () => void;
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
  const audio = createScreenAudioController();
  const premiereAudio = createPremiereAudioController();
  return {
    subscribe: (callback) => subscribeToScreenEvents(screenClient, eventSlug, callback),
    loadQuiz: () => getQuizScreenState(quizRpcClient, eventSlug),
    loadCoupleAnswer: () => getRevealedCoupleAnswer(coupleRevealRpcClient, eventSlug),
    loadFinalFive: () => getRevealedFinalFive(finalFiveRpcClient, eventSlug),
    loadPremiere: () => getPremiereScreenState(premiereRpcClient, eventSlug),
    loadMortalKombat: () => getMkTournamentScreenState(mkRpcClient, eventSlug),
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
    armArrivalAudio: audio.arm,
    playArrivalSignal: audio.playArrival,
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

export function ScreenPage({
  joinUrl,
  eventSlug = 'liza-viktor',
  screenId,
  sceneDurationMs = 5600,
  expectedGuestCount = 40,
  dependencies,
}: ScreenPageProps) {
  const deps = useMemo(
    () => dependencies ?? browserDependencies(eventSlug),
    [dependencies, eventSlug],
  );
  const [resolvedScreenId] = useState(() => screenId?.trim() || `screen-${getOrCreateDeviceKey()}`);
  const hasAudioArm = Boolean(deps.armArrivalAudio || deps.armPremiereAudio);
  const [queue, setQueue] = useState<ScreenPresentationEvent[]>([]);
  const [activeEvent, setActiveEvent] = useState<ScreenPresentationEvent | null>(null);
  const [quizState, setQuizState] = useState<QuizScreenState | null>(null);
  const [coupleAnswer, setCoupleAnswer] = useState<RevealedCoupleAnswer>({ status: 'hidden' });
  const [finalFive, setFinalFive] = useState<RevealedFinalFive>({ status: 'hidden' });
  const [premiereState, setPremiereState] = useState<PremiereScreenState | null>(null);
  const [mkState, setMkState] = useState<MkTournamentProjection | null>(null);
  const [premiereNowMs, setPremiereNowMs] = useState(() => Date.now());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioArmed, setAudioArmed] = useState(() => !hasAudioArm);
  const [armingAudio, setArmingAudio] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [connectionFailures, setConnectionFailures] = useState<ReadonlySet<ConnectionSource>>(
    () => browserLooksOnline() ? new Set<ConnectionSource>() : new Set<ConnectionSource>(['browser']),
  );
  const [reconnectEpoch, setReconnectEpoch] = useState(0);
  const [bunkerProtected, setBunkerProtected] = useState(getBunkerPresentationProtected);
  const seenIds = useRef(new Set<string>());
  const presentationProtectedRef = useRef(false);
  const premiereClockOffsetRef = useRef(0);
  const autoAudioAttemptedRef = useRef(false);

  const premiereProtected = isPremiereProtected(premiereState);
  const mortalKombatProtected = isMortalKombatProtected(mkState);
  const presentationProtected = premiereProtected || mortalKombatProtected || bunkerProtected;
  const currentPremiereMediaUrl = premiereMediaUrl(premiereState);
  const connectionDegraded = hasConnectionFailures(connectionFailures);
  presentationProtectedRef.current = presentationProtected;

  const markConnection = useCallback((source: ConnectionSource, healthy: boolean) => {
    setConnectionFailures((current) => updateConnectionHealth(current, source, healthy));
  }, []);

  const armAudio = useCallback(async () => {
    if (!hasAudioArm || armingAudio) return;
    setArmingAudio(true);
    try {
      const [arrivalReady, premiereReady] = await Promise.all([
        deps.armArrivalAudio?.() ?? Promise.resolve(true),
        deps.armPremiereAudio?.() ?? Promise.resolve(true),
      ]);
      setAudioArmed(Boolean(arrivalReady && premiereReady));
    } finally {
      setArmingAudio(false);
    }
  }, [armingAudio, deps, hasAudioArm]);

  useEffect(() => {
    if (!hasAudioArm || !soundEnabled || autoAudioAttemptedRef.current) return;
    autoAudioAttemptedRef.current = true;
    void armAudio();
  }, [armAudio, hasAudioArm, soundEnabled]);

  useEffect(() => subscribeToBunkerPresentationProtection((active) => {
    setBunkerProtected(active);
    if (active) {
      presentationProtectedRef.current = true;
      deps.stopArrivalAudio?.();
      setQueue([]);
      setActiveEvent(null);
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
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [markConnection]);

  useEffect(() => deps.subscribe((event) => {
    if (presentationProtectedRef.current) return;
    if (seenIds.current.has(event.id)) return;
    seenIds.current.add(event.id);
    setQueue((current) => [...current, event]);
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
    if (!presentationProtected) return;
    setQueue([]);
    setActiveEvent(null);
  }, [presentationProtected]);

  useEffect(() => () => {
    deps.disposeAudio?.();
    deps.disposePremiereAudio?.();
  }, [deps]);

  useEffect(() => {
    if (presentationProtected || activeEvent || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setActiveEvent(next);
  }, [activeEvent, presentationProtected, queue]);

  useEffect(() => {
    if (!activeEvent || presentationProtected) return;
    const timer = window.setTimeout(() => {
      setActiveEvent(null);
    }, sceneDurationMs);
    return () => window.clearTimeout(timer);
  }, [activeEvent, presentationProtected, sceneDurationMs]);

  const playSignal = useCallback(() => {
    if (!presentationProtectedRef.current && soundEnabled && audioArmed) {
      deps.playArrivalSignal?.();
    }
  }, [audioArmed, deps, soundEnabled]);

  const playPremiereCountdownTick = useCallback((second: number) => {
    if (soundEnabled && audioArmed) deps.playPremiereCountdownTick?.(second);
  }, [audioArmed, deps, soundEnabled]);

  const disableAudio = () => {
    setSoundEnabled(false);
    setAudioArmed(false);
    deps.stopArrivalAudio?.();
  };

  const enableAudio = async () => {
    setSoundEnabled(true);
    await armAudio();
  };

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
          <PublicBracket state={mkState} />
        )
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
          <QuizScreenScene state={activeQuiz} expectedGuestCount={expectedGuestCount} />
        )
      ) : (
        <IdleRegistrationScreen joinUrl={joinUrl} />
      )}

      {connectionDegraded && (
        <div className="screen-connection-indicator" role="status">
          СВЯЗЬ · ПЕРЕПОДКЛЮЧЕНИЕ
        </div>
      )}

      {hasAudioArm && (!presentationProtected || premiereState?.status === 'standby') && (
        <button
          type="button"
          className="screen-audio-arm"
          disabled={armingAudio}
          onClick={() => soundEnabled ? disableAudio() : void enableAudio()}
        >
          {armingAudio
            ? 'ВКЛЮЧАЕМ…'
            : soundEnabled
              ? 'ВЫКЛЮЧИТЬ ЗВУК'
              : 'ВКЛЮЧИТЬ ЗВУК'}
        </button>
      )}

      {!presentationProtected && activeEvent?.kind === 'guest_registered' && (
        <TrainArrivalScene
          event={activeEvent}
          onSignal={playSignal}
        />
      )}

      {!presentationProtected && activeEvent?.kind === 'carriage_call' && (
        <CarriageCallScene event={activeEvent} />
      )}
    </div>
  );
}
