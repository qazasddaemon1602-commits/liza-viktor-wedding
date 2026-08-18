import type { CSSProperties } from 'react';
import type { CarriageSummary } from '../registration/registration.types';
import type { GuestCarriageCall } from '../carriages/carriageCalls.service';

type GuestCallBannerProps = {
  carriage: CarriageSummary;
  call: GuestCarriageCall | null;
};

export function GuestCallBanner({ carriage, call }: GuestCallBannerProps) {
  if (!call) return null;

  return (
    <aside
      className="guest-call-banner"
      data-testid="guest-call-banner"
      role="status"
      aria-live="polite"
      style={{ '--carriage-accent': carriage.accentHex } as CSSProperties}
    >
      <p className="eyebrow">ВЫЗОВ ВАГОНА</p>
      <strong>{carriage.label}</strong>
      <p>{call.message}</p>
    </aside>
  );
}
