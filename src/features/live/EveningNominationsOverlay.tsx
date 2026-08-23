import { useEffect, useState } from 'react';
import type { EveningNomination } from './eveningNominations.service';

type Props = {
  nominations: EveningNomination[];
  stepMs?: number;
};

export function EveningNominationsOverlay({ nominations, stepMs = 5800 }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [nominations]);

  useEffect(() => {
    if (nominations.length <= 1) return;
    const interval = window.setInterval(() => {
      setIndex((current) => Math.min(current + 1, nominations.length - 1));
    }, stepMs);
    return () => window.clearInterval(interval);
  }, [nominations.length, stepMs]);

  const current = nominations[index];
  if (!current) return null;

  return (
    <aside className="wedding-nominations" aria-live="polite" aria-label="Номинации вечера">
      <div className="wedding-nominations__frame" key={`${index}:${current.key}`}>
        <header>
          <p>ЛИЗА × ВИКТОР · НАГРАДЫ ВЕЧЕРА</p>
          <span>{String(index + 1).padStart(2, '0')} / {String(nominations.length).padStart(2, '0')}</span>
        </header>
        <main>
          <span>{current.title}</span>
          <h1>{current.recipient}</h1>
          <p>{current.detail}</p>
        </main>
        <footer>ТОЛЬКО ПО ФАКТАМ ЭТОГО ВЕЧЕРА</footer>
      </div>
    </aside>
  );
}
