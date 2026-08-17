import type { RegisteredGuest } from './registration.types';

type VirtualTicketProps = {
  guest: RegisteredGuest;
};

export function VirtualTicket({ guest }: VirtualTicketProps) {
  return (
    <article
      className="virtual-ticket"
      style={{ '--ticket-accent': guest.carriage.accentHex } as React.CSSProperties}
      aria-label={`Билет ${guest.firstName} ${guest.lastName}, ${guest.carriage.label}`}
    >
      <div className="virtual-ticket__topline">
        <span>ЛИЗА × ВИКТОР</span>
        <span>30 · 08 · 2026</span>
      </div>
      <div className="virtual-ticket__route" aria-hidden="true">
        <span>TYUMEN</span>
        <span className="virtual-ticket__line" />
        <span>LV</span>
      </div>
      <div className="virtual-ticket__body">
        <div>
          <p className="eyebrow">ПРОЕЗДНОЙ БИЛЕТ</p>
          <h2>{guest.firstName} {guest.lastName}</h2>
        </div>
        <div className="virtual-ticket__carriage">
          <span className="virtual-ticket__mark">{guest.carriage.visualMark}</span>
          <strong>{guest.carriage.label}</strong>
        </div>
      </div>
      <div className="virtual-ticket__footer">
        <span>{guest.ticketNumber}</span>
        <span>ОДИН СОСТАВ · ОДНА КОМАНДА</span>
      </div>
    </article>
  );
}
