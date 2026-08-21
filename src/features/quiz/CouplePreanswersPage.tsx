import { useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import type { QuizChoice } from './quiz.service';
import {
  finalizeCouplePreanswers,
  getCouplePreanswerForm,
  saveCouplePreanswer,
  type CouplePreanswerForm,
  type CouplePreanswerRpcClient,
  type FinalizedCouplePreanswers,
  type SavedCouplePreanswer,
} from './couplePreanswers.service';

const DEFAULT_EVENT_SLUG = 'liza-viktor';

export type CouplePreanswersPageDependencies = {
  load: (token: string) => Promise<CouplePreanswerForm>;
  save: (token: string, questionId: string, choice: QuizChoice) => Promise<SavedCouplePreanswer>;
  finalize: (token: string) => Promise<FinalizedCouplePreanswers>;
};

type CouplePreanswersPageProps = {
  token?: string;
  eventSlug?: string;
  dependencies?: CouplePreanswersPageDependencies;
};

function tokenFromLocation(): string {
  return new URLSearchParams(window.location.search).get('token')?.trim() ?? '';
}

function browserDependencies(eventSlug: string): CouplePreanswersPageDependencies {
  const client = getSupabaseClient() as unknown as CouplePreanswerRpcClient;
  return {
    load: (token) => getCouplePreanswerForm(client, eventSlug, token),
    save: (token, questionId, choice) => saveCouplePreanswer(
      client,
      eventSlug,
      token,
      questionId,
      choice,
    ),
    finalize: (token) => finalizeCouplePreanswers(client, eventSlug, token),
  };
}

function completedView(alreadyFinished = false) {
  return (
    <main className="couple-preanswers-shell">
      <section className="couple-preanswers-finished">
        <p className="eyebrow">ЛИЗА × ВИКТОР · СЕКРЕТНЫЕ ОТВЕТЫ</p>
        <h1>{alreadyFinished ? 'ОТВЕТЫ УЖЕ ЗАФИКСИРОВАНЫ' : 'ОТВЕТЫ ЗАФИКСИРОВАНЫ'}</h1>
        <p>Ссылка закрыта. Во время викторины ответы появятся только в момент официального показа.</p>
      </section>
    </main>
  );
}

export function CouplePreanswersPage({
  token,
  eventSlug = DEFAULT_EVENT_SLUG,
  dependencies,
}: CouplePreanswersPageProps) {
  const accessToken = useMemo(() => token ?? tokenFromLocation(), [token]);
  const deps = useMemo(
    () => dependencies ?? browserDependencies(eventSlug),
    [dependencies, eventSlug],
  );
  const [form, setForm] = useState<CouplePreanswerForm | null>(null);
  const [loading, setLoading] = useState(Boolean(accessToken));
  const [savingQuestionId, setSavingQuestionId] = useState('');
  const [finalizing, setFinalizing] = useState(false);
  const [justFinalized, setJustFinalized] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    setLoading(true);
    setError('');
    void deps.load(accessToken)
      .then((next) => {
        if (active) setForm(next);
      })
      .catch(() => {
        if (active) setError('Ссылка недействительна или доступ был отозван.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken, deps]);

  if (!accessToken) {
    return (
      <main className="couple-preanswers-shell">
        <section className="couple-preanswers-finished" role="alert">
          <p className="eyebrow">ЛИЗА × ВИКТОР</p>
          <h1>ССЫЛКА НЕДЕЙСТВИТЕЛЬНА</h1>
          <p>Откройте персональную ссылку, которую прислал организатор.</p>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="couple-preanswers-shell">
        <section className="couple-preanswers-finished" aria-live="polite">
          <p className="eyebrow">ЛИЗА × ВИКТОР</p>
          <h1>ЗАГРУЖАЕМ ВОПРОСЫ…</h1>
        </section>
      </main>
    );
  }

  if (justFinalized) return completedView(false);
  if (form?.status === 'finished') return completedView(true);

  if (error || !form || form.status === 'not_found') {
    return (
      <main className="couple-preanswers-shell">
        <section className="couple-preanswers-finished" role="alert">
          <p className="eyebrow">ЛИЗА × ВИКТОР</p>
          <h1>ССЫЛКА НЕДЕЙСТВИТЕЛЬНА</h1>
          <p>{error || 'Событие не найдено.'}</p>
        </section>
      </main>
    );
  }

  const choose = async (questionId: string, choice: QuizChoice) => {
    if (savingQuestionId || finalizing) return;
    setSavingQuestionId(questionId);
    setError('');
    try {
      const saved = await deps.save(accessToken, questionId, choice);
      setForm((current) => {
        if (!current || current.status !== 'active') return current;
        const previous = current.questions.find((question) => question.id === questionId)?.choice ?? null;
        return {
          ...current,
          answeredCount: previous === null ? current.answeredCount + 1 : current.answeredCount,
          questions: current.questions.map((question) => question.id === questionId
            ? { ...question, choice: saved.choice }
            : question),
        };
      });
    } catch {
      setError('Ответ не сохранился. Проверьте интернет и нажмите ещё раз.');
    } finally {
      setSavingQuestionId('');
    }
  };

  const finalize = async () => {
    if (form.answeredCount !== form.totalCount || finalizing || savingQuestionId) return;
    setFinalizing(true);
    setError('');
    try {
      await deps.finalize(accessToken);
      setJustFinalized(true);
      setForm({ status: 'finished' });
    } catch {
      setError('Не удалось зафиксировать ответы. Убедитесь, что заполнены все вопросы, и попробуйте ещё раз.');
    } finally {
      setFinalizing(false);
    }
  };

  const complete = form.answeredCount === form.totalCount && form.totalCount > 0;

  return (
    <main className="couple-preanswers-shell">
      <header className="couple-preanswers-hero">
        <div>
          <p className="eyebrow">ТОЛЬКО ДЛЯ ЛИЗЫ И ВИКТОРА</p>
          <h1>ОТВЕТЫ ЛИЗЫ И ВИКТОРА</h1>
          <p>Выберите один общий ответ на каждый вопрос. До финальной фиксации любой выбор можно поменять.</p>
        </div>
        <strong>{form.answeredCount} / {form.totalCount} ОТВЕЧЕНО</strong>
      </header>

      <section className="couple-preanswers-list" aria-label="Вопросы для совместных ответов">
        {form.questions.map((question) => (
          <article key={question.id} className="couple-preanswer-card">
            <div className="couple-preanswer-copy">
              <span>{String(question.sortOrder).padStart(2, '0')}</span>
              <h2>{question.text}</h2>
            </div>

            {question.imagePath && (
              <img src={question.imagePath} alt="" className="couple-preanswer-image" />
            )}

            <div className="couple-preanswer-choices">
              <button
                type="button"
                aria-label={`ЛИЗА — ${question.text}`}
                aria-pressed={question.choice === 'liza'}
                disabled={Boolean(savingQuestionId) || finalizing}
                onClick={() => void choose(question.id, 'liza')}
              >
                ЛИЗА
              </button>
              <button
                type="button"
                aria-label={`ВИКТОР — ${question.text}`}
                aria-pressed={question.choice === 'viktor'}
                disabled={Boolean(savingQuestionId) || finalizing}
                onClick={() => void choose(question.id, 'viktor')}
              >
                ВИКТОР
              </button>
            </div>
            {savingQuestionId === question.id && <small aria-live="polite">СОХРАНЯЕМ…</small>}
          </article>
        ))}
      </section>

      <footer className="couple-preanswers-finalize">
        <div>
          <strong>{complete ? 'ВСЕ ОТВЕТЫ ГОТОВЫ' : `ОСТАЛОСЬ ${form.totalCount - form.answeredCount}`}</strong>
          <p>После фиксации изменить или снова посмотреть ответы по этой ссылке будет нельзя.</p>
        </div>
        <button
          type="button"
          disabled={!complete || Boolean(savingQuestionId) || finalizing}
          onClick={() => void finalize()}
        >
          {finalizing ? 'ФИКСИРУЕМ…' : 'ЗАФИКСИРОВАТЬ ОТВЕТЫ'}
        </button>
      </footer>

      {error && <p className="couple-preanswers-error" role="alert">{error}</p>}
    </main>
  );
}
