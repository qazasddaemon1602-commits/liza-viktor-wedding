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

function formatEventDate(createdAt: string): string {
  const date = createdAt.slice(0, 10).split('-');
  if (date.length !== 3) return '30.08.2026';
  return `${date[2]}.${date[1]}.${date[0]}`;
}

export function TrainArrivalScene({ event, onSignal }: TrainArrivalSceneProps) {
  useEffect(() => {
    // The real 14 s recording begins first; the CSS train pass starts 1.25 s later.
    onSignal?.();
  }, [event.id, onSignal]);

  const accentStyle = {
    '--arrival-accent': event.payload.carriage.accentHex,
  } as CSSProperties;
  const eventDate = formatEventDate(event.createdAt);
  const wagonCopy = [
    'ПРИБЫЛ НОВЫЙ ИГРОК',
    event.payload.displayName,
    event.payload.carriage.label,
    `ПОСАДКА · ${eventDate}`,
  ];

  return (
    <section
      className="train-arrival train-arrival--editorial train-arrival--convoy"
      data-testid="train-arrival-scene"
      style={accentStyle}
    >
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
          className="train-arrival__atmosphere"
          src="/images/ticket/paper-texture.png"
          alt=""
          aria-hidden="true"
        />
      </picture>

      <div
        className="train-arrival__convoy"
        data-testid="arrival-convoy"
        data-reduced-motion="static-pass"
        aria-hidden="true"
      >
        <img
          className="train-arrival__smoke"
          data-testid="arrival-train-smoke"
          data-motion="rig-parallax"
          src="/images/wedding/arrival-train-smoke-v2.png"
          alt=""
        />
        <img
          className="train-arrival__sprite"
          data-testid="arrival-train-sprite"
          src="/images/wedding/arrival-train-sprite-v2.png"
          alt=""
        />
        {wagonCopy.map((copy, index) => (
          <span
            key={`${index}-${copy}`}
            className={`train-arrival__wagon-copy train-arrival__wagon-copy--${index + 1}`}
            data-testid={`arrival-wagon-copy-${index + 1}`}
          >
            {copy}
          </span>
        ))}
      </div>

      <div className="sr-only" role="status" aria-live="assertive" aria-atomic="true">
        <h2>{event.payload.displayName}</h2>
        <p>
          Прибыл новый игрок. {event.payload.displayName}. Назначен {event.payload.carriage.label}.
        </p>
      </div>
    </section>
  );
}
