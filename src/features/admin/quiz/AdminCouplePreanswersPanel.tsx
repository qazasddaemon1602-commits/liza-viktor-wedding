import { useEffect, useState } from 'react';
import type {
  IssuedCouplePreanswerAccess,
  OwnerCouplePreanswerStatus,
} from '../../quiz/ownerCouplePreanswers.service';

export type AdminCouplePreanswersPanelDependencies = {
  load: (eventId: string) => Promise<OwnerCouplePreanswerStatus>;
  issue: (eventId: string) => Promise<IssuedCouplePreanswerAccess>;
  buildAccessUrl: (token: string) => string;
};

type AdminCouplePreanswersPanelProps = {
  eventId: string;
  dependencies: AdminCouplePreanswersPanelDependencies;
};

export function AdminCouplePreanswersPanel({
  eventId,
  dependencies,
}: AdminCouplePreanswersPanelProps) {
  const [status, setStatus] = useState<OwnerCouplePreanswerStatus | null>(null);
  const [accessUrl, setAccessUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState('');

  const reload = async () => {
    const next = await dependencies.load(eventId);
    setStatus(next);
    return next;
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void dependencies.load(eventId)
      .then((next) => {
        if (active) setStatus(next);
      })
      .catch(() => {
        if (active) setError('Не удалось проверить статус ответов пары.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [dependencies, eventId]);

  const issue = async () => {
    if (issuing || status?.status === 'finalized') return;
    setIssuing(true);
    setError('');
    try {
      const result = await dependencies.issue(eventId);
      setAccessUrl(dependencies.buildAccessUrl(result.token));
      await reload();
    } catch {
      setError('Не удалось выдать ссылку. Проверьте интернет и права владельца.');
    } finally {
      setIssuing(false);
    }
  };

  if (loading) {
    return (
      <section className="admin-couple-preanswers" aria-live="polite">
        <p className="eyebrow">ПОДГОТОВКА ВИКТОРИНЫ</p>
        <h2>ОТВЕТЫ ЛИЗЫ И ВИКТОРА</h2>
        <p>Проверяем статус…</p>
      </section>
    );
  }

  if (error && !status) {
    return (
      <section className="admin-couple-preanswers" role="alert">
        <p className="eyebrow">ПОДГОТОВКА ВИКТОРИНЫ</p>
        <h2>ОТВЕТЫ ЛИЗЫ И ВИКТОРА</h2>
        <p>{error}</p>
      </section>
    );
  }

  if (!status) return null;

  const finalized = status.status === 'finalized';
  const active = status.status === 'active';

  return (
    <section className="admin-couple-preanswers" aria-label="Совместные ответы Лизы и Виктора">
      <div className="admin-couple-preanswers-head">
        <div>
          <p className="eyebrow">ПОДГОТОВКА ВИКТОРИНЫ · СЕКРЕТНО</p>
          <h2>ОТВЕТЫ ЛИЗЫ И ВИКТОРА</h2>
        </div>
        {finalized ? (
          <strong>ОТВЕТЫ ЗАФИКСИРОВАНЫ</strong>
        ) : active ? (
          <strong>{status.answeredCount} / {status.totalCount} ОТВЕЧЕНО</strong>
        ) : (
          <strong>ССЫЛКА ЕЩЁ НЕ ВЫДАНА</strong>
        )}
      </div>

      <p className="admin-couple-preanswers-note">
        Админка показывает только готовность. Сам выбор «Лиза / Виктор» здесь не раскрывается до официального показа во время игры.
      </p>

      {!finalized && (
        <button
          type="button"
          className="registration-secondary"
          disabled={issuing}
          onClick={() => void issue()}
        >
          {issuing ? 'ВЫДАЁМ…' : active ? 'ПЕРЕВЫДАТЬ ССЫЛКУ' : 'СОЗДАТЬ ССЫЛКУ'}
        </button>
      )}

      {accessUrl && !finalized && (
        <div className="admin-couple-preanswers-link">
          <label>
            <span>Одноразовая ссылка для Лизы и Виктора</span>
            <input
              aria-label="Ссылка для Лизы и Виктора"
              readOnly
              value={accessUrl}
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
          <p>Скопируйте ссылку сейчас. После обновления страницы секретный токен повторно не показывается.</p>
        </div>
      )}

      {finalized && (
        <p>Ссылка закрыта, ответы больше нельзя изменить или перевыдать.</p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
