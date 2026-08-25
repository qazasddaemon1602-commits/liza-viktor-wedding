import { useEffect, useMemo, useRef, useState } from 'react';

type QuizPhaseTimerProps = {
  endsAt?: string | null;
  onExpire?: () => void;
  onSecondChange?: (seconds: number) => void;
  now?: () => number;
  className?: string;
};

function remainingSeconds(endsAt: string, now: () => number): number {
  const deadline = Date.parse(endsAt);
  if (!Number.isFinite(deadline)) return 0;
  return Math.max(0, Math.ceil((deadline - now()) / 1000));
}

function format(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function QuizPhaseTimer({
  endsAt,
  onExpire,
  onSecondChange,
  now,
  className = '',
}: QuizPhaseTimerProps) {
  const clock = useMemo(() => now ?? (() => Date.now()), [now]);
  const [seconds, setSeconds] = useState(() => endsAt ? remainingSeconds(endsAt, clock) : 0);
  const expiredFor = useRef<string | null>(null);
  const announcedSecond = useRef<number | null>(null);

  useEffect(() => {
    if (!endsAt) {
      setSeconds(0);
      expiredFor.current = null;
      announcedSecond.current = null;
      return;
    }

    const tick = () => {
      const next = remainingSeconds(endsAt, clock);
      setSeconds(next);
      if (announcedSecond.current !== next) {
        announcedSecond.current = next;
        onSecondChange?.(next);
      }
      if (next === 0 && expiredFor.current !== endsAt) {
        expiredFor.current = endsAt;
        onExpire?.();
      }
    };

    expiredFor.current = null;
    announcedSecond.current = null;
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [clock, endsAt, onExpire, onSecondChange]);

  if (!endsAt) return null;

  const label = format(seconds);
  return (
    <time
      className={`quiz-phase-timer ${className}`.trim()}
      dateTime={endsAt}
      aria-label={`Осталось ${label}`}
    >
      {label}
    </time>
  );
}

