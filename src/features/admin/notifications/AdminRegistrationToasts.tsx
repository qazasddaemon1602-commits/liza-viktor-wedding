import { useEffect } from 'react';
import type { RegistrationNotice } from './notificationQueue';

type AdminRegistrationToastsProps = {
  notices: readonly RegistrationNotice[];
  onDismiss: (guestId: string) => void;
  autoDismissMs?: number;
};

export function AdminRegistrationToasts({
  notices,
  onDismiss,
  autoDismissMs = 6000,
}: AdminRegistrationToastsProps) {
  const current = notices[0];

  useEffect(() => {
    if (!current || autoDismissMs <= 0) return;
    const timer = window.setTimeout(() => onDismiss(current.guestId), autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [current, autoDismissMs, onDismiss]);

  if (!current) return null;

  return (
    <aside
      className="admin-registration-toast"
      role="status"
      aria-live="polite"
      style={{ '--notice-accent': current.carriageAccent } as React.CSSProperties}
    >
      <span className="admin-registration-toast__accent" aria-hidden="true" />
      <div className="admin-registration-toast__copy">
        <p className="eyebrow">НОВЫЙ ПАССАЖИР</p>
        <strong>{current.fullName}</strong>
        <span>{current.carriageLabel}</span>
        <small>{current.affiliationLabel}</small>
      </div>
      <button
        type="button"
        aria-label="Закрыть уведомление"
        onClick={() => onDismiss(current.guestId)}
      >
        ×
      </button>
    </aside>
  );
}
