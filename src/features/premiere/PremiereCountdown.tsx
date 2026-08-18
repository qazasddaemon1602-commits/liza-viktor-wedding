import type { PremiereCountdownNumber } from './countdown';

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
      <p className="premiere-countdown-caption">ПРЕМЬЕРА ЧЕРЕЗ</p>
      <div className="premiere-countdown-number-wrap" aria-live="off">
        <span key={number} className="premiere-countdown-number">
          {number}
        </span>
      </div>
      <div className="premiere-countdown-line" aria-hidden="true" />
    </section>
  );
}
