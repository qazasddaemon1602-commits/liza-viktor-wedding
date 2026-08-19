import { useEffect, type CSSProperties } from 'react';
import { siteAudio } from '../../lib/siteAudio';
import { WeddingRailwayEmblem } from '../visual/WeddingRailwayEmblem';
import type { RegisteredGuest } from './registration.types';

type VirtualTicketProps = {
  guest: RegisteredGuest;
};

export function VirtualTicket({ guest }: VirtualTicketProps) {
  const ticketStyle = {
    '--carriage-accent': guest.carriage.accentHex,
    '--ticket-accent': guest.carriage.accentHex,
  } as CSSProperties;

  useEffect(() => {
    siteAudio.play('confirm');
    const timer = window.setTimeout(() => siteAudio.play('success'), 120);
    return () => window.clearTimeout(timer);
  }, [guest.id]);

  return (
    <article
      className="virtual-ticket"
      data-testid="virtual-ticket"
      style={ticketStyle}
      aria-label={`Билет ${guest.firstName} ${guest.lastName}, ${guest.carriage.label}`}
    >
      <div className="virtual-ticket__main">
        <div className="virtual-ticket__topline">
          <span>THE LIZA × VIKTOR RAILWAY</span>
          <span>30.08.2026</span>
        </div>

        <div className="virtual-ticket__route" aria-hidden="true">
          <span>TYUMEN</span>
          <span className="virtual-ticket__line" />
          <span>LOVE EXPRESS</span>
        </div>

        <div className="virtual-ticket__art-container">
          <WeddingRailwayEmblem className="wedding-railway-emblem virtual-ticket__locomotive" />
          <div className="virtual-ticket__stamp">
            <span>LV</span>
            <strong>30·08</strong>
            <span>2026</span>
          </div>
        </div>

        <div className="virtual-ticket__passenger">
          <span className="virtual-ticket__field-label">PASSENGER</span>
          <h2>{guest.firstName} {guest.lastName}</h2>
        </div>

        <div className="virtual-ticket__carriage">
          <span className="virtual-ticket__mark">{guest.carriage.visualMark}</span>
          <div>
            <span className="virtual-ticket__field-label">CARRIAGE</span>
            <strong>{guest.carriage.label}</strong>
          </div>
        </div>

        <div className="virtual-ticket__footer" aria-hidden="true">
          <span>ONE TRAIN · ONE STORY</span>
          <span>✦</span>
          <span>L × V</span>
        </div>
      </div>

      <aside className="virtual-ticket__stub" data-testid="virtual-ticket-stub">
        <span className="virtual-ticket__valid">VALID · 30 AUG 2026</span>
        <span className="virtual-ticket__stub-label">TICKET No.</span>
        <strong className="virtual-ticket__number">{guest.ticketNumber}</strong>
        <span className="virtual-ticket__stub-mark" aria-hidden="true">{guest.carriage.visualMark}</span>
        <div className="virtual-ticket__stub-seal" aria-hidden="true">
          <span>LV</span>
          <i>✦</i>
          <span>2026</span>
        </div>
      </aside>
    </article>
  );
}
