import { useEffect, type CSSProperties } from 'react';
import { siteAudio } from '../../lib/siteAudio';
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
      <picture className="generated-artwork-picture">
        <source
          type="image/avif"
          srcSet="/images/ticket/paper-texture-512.avif 512w, /images/ticket/paper-texture-1024.avif 1024w"
          sizes="(max-width: 700px) calc(100vw - 1.6rem), min(68rem, 100vw)"
        />
        <source
          type="image/webp"
          srcSet="/images/ticket/paper-texture-512.webp 512w, /images/ticket/paper-texture-1024.webp 1024w"
          sizes="(max-width: 700px) calc(100vw - 1.6rem), min(68rem, 100vw)"
        />
        <img
          className="virtual-ticket__paper-texture"
          data-testid="ticket-paper-texture"
          src="/images/ticket/paper-texture.png"
          sizes="(max-width: 700px) calc(100vw - 1.6rem), min(68rem, 100vw)"
          alt=""
          aria-hidden="true"
        />
      </picture>

      <div className="virtual-ticket__main">
        <div className="virtual-ticket__topline">
          <span>THE LIZA × VIKTOR RAILWAY</span>
          <span>30.08.2026</span>
        </div>

        <div className="virtual-ticket__hero" aria-hidden="true">
          <picture className="generated-artwork-picture">
            <source
              type="image/avif"
              srcSet="/images/ticket/railway-seal-128.avif 128w, /images/ticket/railway-seal-256.avif 256w"
              sizes="(max-width: 700px) 64px, 102px"
            />
            <source
              type="image/webp"
              srcSet="/images/ticket/railway-seal-128.webp 128w, /images/ticket/railway-seal-256.webp 256w"
              sizes="(max-width: 700px) 64px, 102px"
            />
            <img
              className="virtual-ticket__seal"
              data-testid="ticket-railway-seal"
              src="/images/ticket/railway-seal.png"
              sizes="(max-width: 700px) 64px, 102px"
              alt=""
              aria-hidden="true"
            />
          </picture>
          <div className="virtual-ticket__title-lockup">
            <span>THE LOVE</span>
            <strong>RAILWAY</strong>
            <small>TYUMEN · SPECIAL SERVICE</small>
          </div>
          <picture className="generated-artwork-picture">
            <source
              type="image/avif"
              srcSet="/images/ticket/locomotive-engraving-480.avif 480w, /images/ticket/locomotive-engraving-960.avif 960w"
              sizes="(max-width: 700px) 224px, 208px"
            />
            <source
              type="image/webp"
              srcSet="/images/ticket/locomotive-engraving-480.webp 480w, /images/ticket/locomotive-engraving-960.webp 960w"
              sizes="(max-width: 700px) 224px, 208px"
            />
            <img
              className="virtual-ticket__locomotive"
              data-testid="ticket-locomotive-art"
              src="/images/ticket/locomotive-engraving.png"
              sizes="(max-width: 700px) 224px, 208px"
              alt=""
              aria-hidden="true"
            />
          </picture>
        </div>

        <div className="virtual-ticket__route" aria-hidden="true">
          <span>TYUMEN</span>
          <span className="virtual-ticket__line" />
          <span>LOVE EXPRESS</span>
        </div>

        <picture className="generated-artwork-picture">
          <source
            type="image/avif"
            srcSet="/images/ticket/tyumen-skyline-engraving-960.avif 960w, /images/ticket/tyumen-skyline-engraving-1600.avif 1600w"
            sizes="(max-width: 700px) calc(100vw - 4rem), 832px"
          />
          <source
            type="image/webp"
            srcSet="/images/ticket/tyumen-skyline-engraving-960.webp 960w, /images/ticket/tyumen-skyline-engraving-1600.webp 1600w"
            sizes="(max-width: 700px) calc(100vw - 4rem), 832px"
          />
          <img
            className="virtual-ticket__skyline"
            data-testid="ticket-skyline-art"
            src="/images/ticket/tyumen-skyline-engraving.png"
            sizes="(max-width: 700px) calc(100vw - 4rem), 832px"
            alt=""
            aria-hidden="true"
          />
        </picture>

        <div className="virtual-ticket__fields">
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
        <div className="virtual-ticket__stub-route" aria-hidden="true">
          <span>FROM</span><strong>TYUMEN</strong>
          <span>TO</span><strong>CELEBRATION</strong>
        </div>
        <span className="virtual-ticket__admit">ADMIT ONE · L × V</span>
      </aside>
    </article>
  );
}
