import { useEffect, type CSSProperties } from 'react';

export type GuestRegistrationScreenEvent = {
  id: string;
  kind: 'guest_registered';
  createdAt: string;
  payload: {
    displayName: string;
    carriage: {
      id: string;
      number: number;
      label: string;
      accentHex: string;
      visualMark: string;
    };
  };
};

type TrainArrivalSceneProps = {
  event: GuestRegistrationScreenEvent;
  onSignal?: () => void;
};

export function TrainArrivalScene({ event, onSignal }: TrainArrivalSceneProps) {
  useEffect(() => {
    onSignal?.();
  }, [event.id, onSignal]);

  const accentStyle = {
    '--arrival-accent': event.payload.carriage.accentHex,
  } as CSSProperties;

  return (
    <section
      className="train-arrival train-arrival--editorial"
      data-testid="train-arrival-scene"
      style={accentStyle}
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="train-arrival__wash" aria-hidden="true" />
      <picture className="generated-artwork-picture">
        <source
          type="image/avif"
          srcSet="/images/ticket/paper-texture-512.avif 512w, /images/ticket/paper-texture-1024.avif 1024w"
          sizes="100vw"
        />
        <source
          type="image/webp"
          srcSet="/images/ticket/paper-texture-512.webp 512w, /images/ticket/paper-texture-1024.webp 1024w"
          sizes="100vw"
        />
        <img
          className="train-arrival__paper-grain"
          data-testid="arrival-paper-texture"
          src="/images/ticket/paper-texture.png"
          sizes="100vw"
          alt=""
          aria-hidden="true"
        />
      </picture>
      <picture className="generated-artwork-picture">
        <source
          type="image/avif"
          srcSet="/images/wedding/train-arrival-wide-960.avif 960w, /images/wedding/train-arrival-wide-1920.avif 1920w"
          sizes="(max-width: 900px) 96vw, min(67vw, 88rem)"
        />
        <source
          type="image/webp"
          srcSet="/images/wedding/train-arrival-wide-960.webp 960w, /images/wedding/train-arrival-wide-1920.webp 1920w"
          sizes="(max-width: 900px) 96vw, min(67vw, 88rem)"
        />
        <img
          className="train-arrival__plate"
          data-testid="arrival-train-plate"
          src="/images/wedding/train-arrival-wide.png"
          sizes="(max-width: 900px) 96vw, min(67vw, 88rem)"
          alt=""
          aria-hidden="true"
        />
      </picture>

      <div className="train-arrival__meta">
        <span>ПОЕЗД ВИКТОРА</span>
        <span>PLATFORM ANNOUNCEMENT</span>
        <span>30 · 08 · 2026</span>
      </div>

      <div
        className="train-arrival__platform-ticket"
        data-testid="arrival-platform-ticket"
        role="group"
        aria-label={`Посадка ${event.payload.displayName}, ${event.payload.carriage.label}`}
      >
        <div className="train-arrival__ticket-index" aria-hidden="true">
          <span>ARRIVAL</span>
          <strong>{event.payload.carriage.visualMark}</strong>
          <span>LV · TYUMEN</span>
        </div>

        <div className="train-arrival__copy">
          <p className="train-arrival__eyebrow">НОВЫЙ ПАССАЖИР</p>
          <h2>{event.payload.displayName}</h2>
          <div className="train-arrival__assignment">
            <span className="train-arrival__mark">{event.payload.carriage.visualMark}</span>
            <div>
              <small>МЕСТО В СОСТАВЕ</small>
              <strong>{event.payload.carriage.label}</strong>
            </div>
          </div>
        </div>

        <div className="train-arrival__editorial-seal" data-testid="arrival-editorial-seal" aria-hidden="true">
          <picture className="generated-artwork-picture">
            <source
              type="image/avif"
              srcSet="/images/ticket/railway-seal-128.avif 128w, /images/ticket/railway-seal-256.avif 256w"
              sizes="120px"
            />
            <source
              type="image/webp"
              srcSet="/images/ticket/railway-seal-128.webp 128w, /images/ticket/railway-seal-256.webp 256w"
              sizes="120px"
            />
            <img
              className="train-arrival__seal-emblem"
              data-testid="arrival-railway-seal"
              src="/images/ticket/railway-seal.png"
              sizes="120px"
              alt=""
              aria-hidden="true"
            />
          </picture>
          <span>PASSENGER ACCEPTED</span>
          <i />
          <span>LOVE RAILWAY · 2026</span>
        </div>

        <div className="train-arrival__ticket-route" aria-hidden="true">
          <span>WELCOME</span>
          <i />
          <span>CARRIAGE {event.payload.carriage.visualMark}</span>
        </div>
      </div>

      <div className="train-arrival__destination">
        <span>ПАССАЖИР ПРИНЯТ</span>
        <i />
        <span>{event.payload.carriage.label}</span>
      </div>
    </section>
  );
}
