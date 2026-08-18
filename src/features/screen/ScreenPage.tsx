import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import {
  getRevealedCoupleAnswer,
  type CoupleRevealRpcClient,
  type RevealedCoupleAnswer,
} from '../quiz/coupleReveal.service';
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
import { IdleRegistrationScreen } from './IdleRegistrationScreen';
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
  subscribeToQuizRefresh?: (callback: () => void) => () => void;
  armArrivalAudio?: () => Promise<boolean>;
  playArrivalSignal?: () => void;
  disposeAudio?: () => void;
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
  const quizRealtimeClient = client as unknown as QuizRealtimeClient;
  const audio = createScreenAudioController();
  return {
    subscribe: (callback) => subscribeToScreenEvents(screenClient, eventSlug, callback),
    loadQuiz: () => getQuizScreenState(quizRpcClient, eventSlug),
    loadCoupleAnswer: () => getRevealedCoupleAnswer(coupleRevealRpcClient, eventSlug),
    subscribeToQuizRefresh: (callback) => subscribeToQuizRefresh(
      quizRealtimeClient,
      eventSlug,
      callback,
    ),
    armArrivalAudio: audio.arm,
    playArrivalSignal: audio.playArrival,
    disposeAudio: audio.dispose,
  };
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
  const [queue, setQueue] = useState<ScreenPresentationEvent[]>([]);
  const [activeEvent, setActiveEvent] = useState<ScreenPresentationEvent | null>(null);
  const [quizState, setQuizState] = useState<QuizScreenState | null>(null);
  const [coupleAnswer, setCoupleAnswer] = useState<RevealedCoupleAnswer>({ status: 'hidden' });
  const [audioArmed, setAudioArmed] = useState(!deps.armArrivalAudio);
  const [armingAudio, setArmingAudio] = useState(false);
  const seenIds = useRef(new Set<string>());

  useEffect(() => deps.subscribe((event) => {
    if (seenIds.current.has(event.id)) return;
    seenIds.current.add(event.id);
    setQueue((current) => [...current, event]);
  }), [deps]);

  useEffect(() => {
    if (!deps.loadQuiz && !deps.loadCoupleAnswer) return;
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
    };

    reload();
    const unsubscribe = deps.subscribeToQuizRefresh?.(reload);

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [deps]);

  useEffect(() => () => {
    deps.disposeAudio?.();
  }, [deps]);

  useEffect(() => {
    if (activeEvent || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setActiveEvent(next);
  }, [activeEvent, queue]);

  useEffect(() => {
    if (!activeEvent) return;
    const timer = window.setTimeout(() => {
      setActiveEvent(null);
    }, sceneDurationMs);
    return () => window.clearTimeout(timer);
  }, [activeEvent, sceneDurationMs]);

  const playSignal = useCallback(() => {
    deps.playArrivalSignal?.();
  }, [deps]);

  const armAudio = async () => {
    if (!deps.armArrivalAudio || armingAudio) return;
    setArmingAudio(true);
    try {
      setAudioArmed(await deps.armArrivalAudio());
    } finally {
      setArmingAudio(false);
    }
  };

  const activeQuiz = quizState?.status === 'active' ? quizState : null;
  const revealedForCurrentQuestion = activeQuiz?.phase === 'results'
    && coupleAnswer.status === 'revealed'
    && coupleAnswer.questionId === activeQuiz.question.id
    ? coupleAnswer
    : null;

  return (
    <div className="screen-page">
      {activeQuiz ? (
        revealedForCurrentQuestion && activeQuiz.phase === 'results' ? (
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

      {!audioArmed && deps.armArrivalAudio && (
        <button
          type="button"
          className="screen-audio-arm"
          disabled={armingAudio}
          onClick={() => void armAudio()}
        >
          {armingAudio ? 'ВКЛЮЧАЕМ…' : 'ВКЛЮЧИТЬ ЗВУК'}
        </button>
      )}

      {activeEvent?.kind === 'guest_registered' && (
        <TrainArrivalScene
          event={activeEvent}
          onSignal={playSignal}
        />
      )}

      {activeEvent?.kind === 'carriage_call' && (
        <CarriageCallScene event={activeEvent} />
      )}
    </div>
  );
}
