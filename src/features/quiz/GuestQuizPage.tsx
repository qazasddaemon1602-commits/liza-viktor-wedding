import { useEffect, useMemo, useState } from 'react';
import { getOrCreateDeviceKey } from '../../lib/deviceIdentity';
import { getSupabaseClient } from '../../lib/supabase';
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
};

type GuestQuizPageProps = {
  dependencies?: GuestQuizPageDependencies;
  eventSlug?: string;
};

function browserDependencies(eventSlug: string): GuestQuizPageDependencies {
  const client = getSupabaseClient() as unknown as QuizRpcClient;
  let cachedDeviceKey: string | undefined;
  const getDeviceKey = () => {
    cachedDeviceKey ??= getOrCreateDeviceKey();
    return cachedDeviceKey;
  };

  return {
    getDeviceKey,
    load: (deviceKey) => getGuestQuizState(client, eventSlug, deviceKey),
    vote: (deviceKey, questionId, choice) => submitGuestQuizVote(
      client,
      eventSlug,
      deviceKey,
      questionId,
      choice,
    ),
  };
}

function percentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
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

    return () => {
      active = false;
    };
  }, [deps]);

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
        </section>
      </main>
    );
  }

  const locked = state.phase === 'results' || Boolean(state.selectedChoice) || Boolean(submitting);
  const lizaPercent = state.phase === 'results' ? percentage(state.results.liza, state.results.total) : null;
  const viktorPercent = state.phase === 'results' ? percentage(state.results.viktor, state.results.total) : null;

  return (
    <main className="quiz-shell">
      <section className="quiz-card quiz-live-card">
        <header className="quiz-heading">
          <p className="eyebrow">ЛИЗА ИЛИ ВИКТОР?</p>
          <h1>{state.question.text}</h1>
          <p className="quiz-answered">{state.answeredCount} ответили</p>
        </header>

        {state.question.imagePath && (
          <img
            className="quiz-question-image"
            src={state.question.imagePath}
            alt=""
          />
        )}

        <div className="quiz-choices" aria-label="Варианты ответа">
          <button
            type="button"
            className={`quiz-choice quiz-choice-liza${state.selectedChoice === 'liza' ? ' is-selected' : ''}`}
            disabled={locked}
            onClick={() => void choose('liza')}
          >
            <span>ЛИЗА</span>
            {lizaPercent !== null && <strong>{lizaPercent}%</strong>}
          </button>
          <button
            type="button"
            className={`quiz-choice quiz-choice-viktor${state.selectedChoice === 'viktor' ? ' is-selected' : ''}`}
            disabled={locked}
            onClick={() => void choose('viktor')}
          >
            <span>ВИКТОР</span>
            {viktorPercent !== null && <strong>{viktorPercent}%</strong>}
          </button>
        </div>

        {submitting && <p className="quiz-status" aria-live="polite">ФИКСИРУЕМ ОТВЕТ…</p>}
        {!submitting && state.phase === 'voting' && state.selectedChoice && (
          <p className="quiz-status" aria-live="polite">ОТВЕТ ПРИНЯТ</p>
        )}
        {state.phase === 'results' && (
          <p className="quiz-status quiz-status-results">РЕЗУЛЬТАТ ОТКРЫТ</p>
        )}
        {error && <p className="quiz-error" role="alert">{error}</p>}
      </section>
    </main>
  );
}
