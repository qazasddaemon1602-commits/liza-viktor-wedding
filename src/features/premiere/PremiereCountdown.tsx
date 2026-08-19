import type { PremiereCountdownNumber } from './countdown';
import { PremiereEditorialFrame } from './PremiereEditorialFrame';

type PremiereCountdownProps = {
  number: PremiereCountdownNumber | null;
};

export function PremiereCountdown({ number }: PremiereCountdownProps) {
  if (number === null) return null;

  const finalClass = number <= 3 ? ' premiere-countdown-final' : '';

  return (
    <section
      className={`premiere-countdown${finalClass}`}
      aria-label={`Премьера через ${number}`}
      data-second={number}
    >
      <PremiereEditorialFrame index="PRM · 01" />

      <p className="premiere-countdown-caption">ПРЕМЬЕРА ЧЕРЕЗ</p>

      <div className="premiere-countdown-number-wrap" aria-live="off">
        <svg
          className="premiere-film-leader"
          data-testid="premiere-film-leader"
          aria-hidden="true"
          viewBox="0 0 200 200"
          role="presentation"
        >
          <circle cx="100" cy="100" r="96" />
          <circle cx="100" cy="100" r="72" />
          <circle cx="100" cy="100" r="40" />
          <line x1="100" y1="0" x2="100" y2="200" />
          <line x1="0" y1="100" x2="200" y2="100" />
          <path className="premiere-film-leader__sweep" d="M100 100 L100 4 A96 96 0 0 1 196 100 Z" />
        </svg>
        <span key={number} className="premiere-countdown-number">
          {number}
        </span>
      </div>

      <div className="premiere-countdown-meta">
        <span>ЛИЗА × ВИКТОР · 30.08.2026</span>
        <span className="premiere-countdown-line" aria-hidden="true" />
        <span>FILM 01</span>
      </div>
    </section>
  );
}
