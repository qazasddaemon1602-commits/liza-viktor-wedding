import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import { createPremiereAudioController } from '../premiere/premiereAudio';
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
  subscribeToQuizRefresh?: (callback: () => void) => () => void;
  subscribeToPremiereRefresh?: (callback: () => void) => () => void;
  armArrivalAudio?: () => Promise<boolean>;
  playArrivalSignal?: () => void;
  armPremiereAudio?: () => Promise<boolean>;
  playPremiereCountdownTick?: (second: number) => void;
  disposeAudio?: () => void;
  disposePremiereAudio?: () => void;
};

type ScreenPageProps = {
  joinUrl: string;
  eventSlug?: string;
  sceneDurationMs?: number;
  expectedGuestCount?: number;
  dependencies?: ScreenPageDependencies;
};

function browserDependencies(eventSlug: string): ScreenPageDependencies {
  const client = getSupabaseClient();
  const screenClient = client as unknown as ScreenEventsRealtimeClient;
  const quizRpcClient = client as unknown as QuizScreenRpcClient;
  const coupleRevealRpcClient = client as unknown as CoupleRevealRpcClient;
  const finalFiveRpcClient = client as unknown as FinalFiveRpcClient;
  const quizRealtimeClient = client as unknown as QuizRealtimeClient;
  const premiereRpcClient = client as unknown as PremiereRpcClient;
  const premiereRealtimeClient = client as unknown as PremiereRealtimeClient;
  const audio = createScreenAudioController();
  const premiereAudio = createPremiereAudioController();
  return {
    subscribe: (callback) => subscribeToScreenEvents(screenClient, eventSlug, callback),
    loadQuiz: () => getQuizScreenState(quizRpcClient, eventSlug),
    loadCoupleAnswer: () => getRevealedCoupleAnswer(coupleRevealRpcClient, eventSlug),
    loadFinalFive: () => getRevealedFinalFive(finalFiveRpcClient, eventSlug),
    loadPremiere: () => getPremiereScreenState(premiereRpcClient, eventSlug),
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
    armArrivalAudio: audio.arm,
    playArrivalSignal: audio.playArrival,
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

export function ScreenPage({
  joinUrl,
  eventSlug = 'liza-viktor',
  sceneDurationMs = 5600,
  expectedGuestCount = 40,
  dependencies,
}: ScreenPageProps) {
  const deps = useMemo(
    () => dependencies ?? browserDependencies(eventSlug),
    [dependencies, eventSlug],
  );
  const hasAudioArm = Boolean(deps.armArrivalAudio || deps.armPremiereAudio);
  const [queue, setQueue] = useState<ScreenPresentationEvent[]>([]);
  const [activeEvent, setActiveEvent] = useState<ScreenPresentationEvent | null>(null);
  const [quizState, setQuizState] = useState<QuizScreenState | null>(null);
  const [coupleAnswer, setCoupleAnswer] = useState<RevealedCoupleAnswer>({ status: 'hidden' });
  const [finalFive, setFinalFive] = useState<RevealedFinalFive>({ status: 'hidden' });
  const [premiereState, setPremiereState] = useState<PremiereScreenState | null>(null);
  const [premiereNowMs, setPremiereNowMs] = useState(() => Date.now());
  const [audioArmed, setAudioArmed] = useState(() => !hasAudioArm);
  const [armingAudio, setArmingAudio] = useState(false);
  const seenIds = useRef(new Set<string>());
  const premiereProtectedRef = useRef(false);
  const premiereClockOffsetRef = useRef(0);

  const premiereProtected = isPremiereProtected(premiereState);
  premiereProtectedRef.current = premiereProtected;

  useEffect(() => deps.subscribe((event) => {
    if (premiereProtectedRef.current) return;
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
            if (active) setQuizState(next);
          })
          .catch(() => {
            if (active) setQuizState((current) => current ?? { status: 'idle' });
          });
      }

      if (deps.loadCoupleAnswer) {
        void deps.loadCoupleAnswer()
          .then((next) => {
            if (active) setCoupleAnswer(next);
          })
          .catch(() => {
            if (active) setCoupleAnswer({ status: 'hidden' });
          });
      }

      if (deps.loadFinalFive) {
        void deps.loadFinalFive()
          .then((next) => {
            if (active) setFinalFive(next);
          })
          .catch(() => {
            if (active) setFinalFive({ status: 'hidden' });
          });
      }
    };

    reload();
    const unsubscribe = deps.subscribeToQuizRefresh?.(reload);

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [deps]);

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
        })
        .catch(() => {
          // Keep the last valid projector state during a temporary network/realtime failure.
        });
    };

    reload();
    const unsubscribe = deps.subscribeToPremiereRefresh?.(reload);

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [deps]);

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
    if (!premiereProtected) return;
    setQueue([]);
    setActiveEvent(null);
  }, [premiereProtected]);

  useEffect(() => () => {
    deps.disposeAudio?.();
    deps.disposePremiereAudio?.();
  }, [deps]);

  useEffect(() => {
    if (premiereProtected || activeEvent || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setActiveEvent(next);
  }, [activeEvent, premiereProtected, queue]);

  useEffect(() => {
    if (!activeEvent || premiereProtected) return;
    const timer = window.setTimeout(() => {
      setActiveEvent(null);
    }, sceneDurationMs);
    return () => window.clearTimeout(timer);
  }, [activeEvent, premiereProtected, sceneDurationMs]);

  const playSignal = useCallback(() => {
    if (!premiereProtectedRef.current) deps.playArrivalSignal?.();
  }, [deps]);

  const playPremiereCountdownTick = useCallback((second: number) => {
    deps.playPremiereCountdownTick?.(second);
  }, [deps]);

  const armAudio = async () => {
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

  return (
    <div className={`screen-page${premiereProtected ? ' screen-page--premiere' : ''}`}>
      {premiereProtected && premiereState ? (
        <PremiereScreen
          state={premiereState}
          nowMs={premiereNowMs}
          onCountdownTick={playPremiereCountdownTick}
        />
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

      {!audioArmed && hasAudioArm && (!premiereProtected || premiereState?.status === 'standby') && (
        <button
          type="button"
          className="screen-audio-arm"
          disabled={armingAudio}
          onClick={() => void armAudio()}
        >
          {armingAudio ? 'ВКЛЮЧАЕМ…' : 'ВКЛЮЧИТЬ ЗВУК'}
        </button>
      )}

      {!premiereProtected && activeEvent?.kind === 'guest_registered' && (
        <TrainArrivalScene
          event={activeEvent}
          onSignal={playSignal}
        />
      )}

      {!premiereProtected && activeEvent?.kind === 'carriage_call' && (
        <CarriageCallScene event={activeEvent} />
      )}
    </div>
  );
}
