import { useEffect, useMemo, useState } from 'react';
import {
  GUEST_REACTION_KEYS,
  reactionEmoji,
  type GuestReactionKey,
  type SubmitGuestReactionResult,
} from './weddingLive.service';

type Props = {
  onReact: (reaction: GuestReactionKey) => Promise<SubmitGuestReactionResult>;
};

export function GuestReactionDock({ onReact }: Props) {
  const [busy, setBusy] = useState<GuestReactionKey | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [feedback, setFeedback] = useState('');
  const disabled = busy !== null || cooldownUntil > nowMs;
  const remainingSeconds = Math.max(0, Math.ceil((cooldownUntil - nowMs) / 1000));

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [cooldownUntil]);

  const reactions = useMemo(() => GUEST_REACTION_KEYS.map((key) => ({
    key,
    emoji: reactionEmoji(key) ?? '',
  })), []);

  const react = async (reaction: GuestReactionKey) => {
    if (disabled) return;
    setBusy(reaction);
    setFeedback('');
    try {
      const result = await onReact(reaction);
      const duration = result.status === 'accepted' ? result.cooldownMs : result.retryAfterMs;
      const until = Date.now() + Math.max(0, duration);
      setNowMs(Date.now());
      setCooldownUntil(until);
      setFeedback(result.status === 'accepted' ? 'НА ЭКРАНЕ' : 'СЕКУНДУ…');
    } catch {
      setFeedback('НЕТ СВЯЗИ');
    } finally {
      setBusy(null);
    }
  };

  return (
    <aside className="guest-reaction-dock" aria-label="Живые реакции">
      <div className="guest-reaction-dock__rail">
        {reactions.map(({ key, emoji }) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            aria-label={`Реакция ${emoji}`}
            onClick={() => void react(key)}
          >
            <span aria-hidden="true">{emoji}</span>
          </button>
        ))}
      </div>
      <small aria-live="polite">
        {remainingSeconds > 0 ? `${remainingSeconds} С` : feedback || 'НА ТВ'}
      </small>
    </aside>
  );
}
