import { useCallback, useEffect, useMemo, useState } from 'react';
import { getOrCreateDeviceKey } from '../../lib/deviceIdentity';
import { getSupabaseClient } from '../../lib/supabase';
import { GuestLiveQuizCard } from './GuestLiveQuizCard';
import {
  subscribeToQuizRefresh,
  type QuizRealtimeClient,
} from './quiz.realtime';
import {
  getGuestQuizState,
  submitGuestQuizVote,
  type GuestQuizState,
  type QuizChoice,
  type QuizRpcClient,
  type SubmitQuizVoteResult,
} from './quiz.service';

const DEFAULT_EVENT_SLUG = 'liza-viktor';

export type GuestQuizPageDependencies = {
  getDeviceKey: () => string;
  load: (deviceKey: string) => Promise<GuestQuizState>;
  vote: (
    deviceKey: string,
    questionId: string,
    choice: QuizChoice,
  ) => Promise<SubmitQuizVoteResult>;
  subscribeToRefresh?: (callback: () => void) => () => void;
};

type GuestQuizPageProps = {
  dependencies?: GuestQuizPageDependencies;
  eventSlug?: string;
};

function browserDependencies(eventSlug: string): GuestQuizPageDependencies {
  const client = getSupabaseClient();
  const rpcClient = client as unknown as QuizRpcClient;
  const realtimeClient = client as unknown as QuizRealtimeClient;
  let cachedDeviceKey: string | undefined;
  const getDeviceKey = () => {
    cachedDeviceKey ??= getOrCreateDeviceKey();
    return cachedDeviceKey;
  };

  return {
    getDeviceKey,
    load: (deviceKey) => getGuestQuizState(rpcClient, eventSlug, deviceKey),
    vote: (deviceKey, questionId, choice) => submitGuestQuizVote(
      rpcClient,
      eventSlug,
      deviceKey,
      questionId,
      choice,
    ),
    subscribeToRefresh: (callback) => subscribeToQuizRefresh(realtimeClient, eventSlug, callback),
  };
}

export function GuestQuizPage({
  dependencies,
  eventSlug = DEFAULT_EVENT_SLUG,
}: GuestQuizPageProps) {
  const deps = useMemo(
    () => dependencies ?? browserDependencies(eventSlug),
    [dependencies, eventSlug],
  );
  const [state, setState] = useState<GuestQuizState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<QuizChoice | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      const next = await deps.load(deps.getDeviceKey());
      setState(next);
      setError('');
      return next;
    } catch {
      setError('Связь с игрой прервалась. Проверьте интернет.');
      return null;
    }
  }, [deps]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void deps.load(deps.getDeviceKey())
      .then((next) => {
        if (active) setState(next);
      })
      .catch(() => {
        if (active) setError('Не удалось загрузить вопрос. Проверьте интернет и обновите страницу.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [deps]);

  useEffect(() => {
    if (!deps.subscribeToRefresh) return;
    return deps.subscribeToRefresh(() => { void reload(); });
  }, [deps, reload]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [reload]);

  const choose = async (choice: QuizChoice) => {
    if (state?.status !== 'active' || state.phase !== 'voting' || state.selectedChoice || submitting) return;
    setSubmitting(choice);
    setError('');
    try {
      const result = await deps.vote(deps.getDeviceKey(), state.question.id, choice);
      setState((current) => {
        if (current?.status !== 'active' || current.phase !== 'voting') return current;
        return {
          ...current,
          selectedChoice: result.choice,
          answeredCount: result.status === 'accepted'
            ? current.answeredCount + 1
            : current.answeredCount,
        };
      });
    } catch {
      setError('Ответ не отправился. Попробуйте ещё раз.');
      void reload();
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <main className="quiz-shell">
        <section className="quiz-card" aria-live="polite">
          <p className="eyebrow">ЛИЗА ИЛИ ВИКТОР?</p>
          <h1>ЗАГРУЖАЕМ ВОПРОС…</h1>
        </section>
      </main>
    );
  }

  if (error && !state) {
    return (
      <main className="quiz-shell">
        <section className="quiz-card" role="alert">
          <p className="eyebrow">ЛИЗА ИЛИ ВИКТОР?</p>
          <h1>НЕТ СВЯЗИ С ИГРОЙ</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!state || state.status === 'not_found') {
    return (
      <main className="quiz-shell">
        <section className="quiz-card">
          <p className="eyebrow">ЛИЗА ИЛИ ВИКТОР?</p>
          <h1>ИГРА ПОКА НЕДОСТУПНА</h1>
          <p>Вернитесь чуть позже — билет останется действительным.</p>
        </section>
      </main>
    );
  }

  if (state.status === 'not_registered') {
    return (
      <main className="quiz-shell">
        <section className="quiz-card">
          <p className="eyebrow">НУЖЕН БИЛЕТ</p>
          <h1>СНАЧАЛА ПОЛУЧИТЕ БИЛЕТ</h1>
          <p>Участвовать в голосовании могут только зарегистрированные гости.</p>
          <a className="quiz-primary-link" href="/join">ПОЛУЧИТЬ БИЛЕТ</a>
        </section>
      </main>
    );
  }

  if (state.status === 'idle') {
    return (
      <main className="quiz-shell">
        <section className="quiz-card">
          <p className="eyebrow">ЛИЗА ИЛИ ВИКТОР?</p>
          <h1>ЖДЁМ СЛЕДУЮЩИЙ ВОПРОС</h1>
          <p>Когда организатор запустит раунд, вопрос появится здесь.</p>
          <a className="quiz-primary-link" href="/join">ВЕРНУТЬСЯ К БИЛЕТУ</a>
        </section>
      </main>
    );
  }

  return (
    <main className="quiz-shell">
      <GuestLiveQuizCard
        state={state}
        submitting={submitting}
        error={error}
        onVote={(choice) => void choose(choice)}
        onDeadline={() => void reload()}
      />
    </main>
  );
}
