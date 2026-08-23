import { useEffect, useState } from 'react';
import type { CapsuleShowcaseMessage } from './messageCapsule.service';

type Props = {
  messages: CapsuleShowcaseMessage[];
  stepMs?: number;
};

export function CapsuleShowcaseOverlay({ messages, stepMs = 5500 }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [messages]);

  useEffect(() => {
    if (messages.length <= 1) return;
    const interval = window.setInterval(() => {
      setIndex((current) => Math.min(current + 1, messages.length - 1));
    }, stepMs);
    return () => window.clearInterval(interval);
  }, [messages.length, stepMs]);

  const current = messages[index];
  if (!current) return null;

  return (
    <aside className="wedding-capsule-showcase" aria-live="polite" aria-label="Капсула вечера">
      <div className="wedding-capsule-showcase__frame" key={`${index}:${current.displayName}`}>
        <p>КАПСУЛА ВЕЧЕРА · {index + 1} / {messages.length}</p>
        <blockquote>{current.message}</blockquote>
        <footer>
          <strong>{current.displayName}</strong>
          <span>{current.carriage}</span>
        </footer>
      </div>
    </aside>
  );
}
