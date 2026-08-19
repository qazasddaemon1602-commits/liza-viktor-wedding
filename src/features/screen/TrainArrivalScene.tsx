import { useEffect, type CSSProperties } from 'react';
import { WeddingRailwayEmblem } from '../visual/WeddingRailwayEmblem';

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

function Coach({ mark, featured = false }: { mark?: string; featured?: boolean }) {
  return (
    <div className={`train-arrival__coach${featured ? ' train-arrival__coach--featured' : ''}`}>
      <div className="train-arrival__coach-roof" />
      <div className="train-arrival__coach-windows">
        <i /><i /><i /><i /><i />
      </div>
      <span className="train-arrival__coach-door" />
      {mark && <strong className="train-arrival__coach-mark">{mark}</strong>}
      <div className="train-arrival__bogie train-arrival__bogie--left"><i /><i /></div>
      <div className="train-arrival__bogie train-arrival__bogie--right"><i /><i /></div>
    </div>
  );
}

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
      <div className="train-arrival__speed-lines" aria-hidden="true" />
      <div className="train-arrival__paper-grain" aria-hidden="true" />

      <div className="train-arrival__meta">
        <span>ПОЕЗД ВИКТОРА</span>
        <span>PLATFORM ANNOUNCEMENT</span>
        <span>30 · 08 · 2026</span>
      </div>

      <div className="train-arrival__platform-ticket" data-testid="arrival-platform-ticket">
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
          <WeddingRailwayEmblem className="wedding-railway-emblem train-arrival__seal-emblem" />
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

      <div className="train-arrival__stage" aria-hidden="true">
        <div className="train-arrival__steam" data-testid="arrival-steam">
          <i /><i /><i />
        </div>

        <div className="train-arrival__track" data-testid="arrival-track">
          <div className="train-arrival__sleepers" />
          <div className="train-arrival__rail train-arrival__rail--far" />
          <div className="train-arrival__rail train-arrival__rail--near" />
        </div>

        <div className="train-arrival__train">
          <div className="train-arrival__locomotive" data-testid="arrival-locomotive">
            <div className="train-arrival__pantograph"><i /><i /></div>
            <div className="train-arrival__loco-roof" />
            <div className="train-arrival__loco-body">
              <div className="train-arrival__windshield"><i /><i /></div>
              <span className="train-arrival__loco-side-window" />
              <span className="train-arrival__loco-stripe" />
              <strong className="train-arrival__loco-monogram">ЛВ</strong>
            </div>
            <div className="train-arrival__loco-nose">
              <span className="train-arrival__headlight train-arrival__headlight--top" />
              <span className="train-arrival__headlight train-arrival__headlight--bottom" />
            </div>
            <div className="train-arrival__bogie train-arrival__bogie--loco-left"><i /><i /></div>
            <div className="train-arrival__bogie train-arrival__bogie--loco-right"><i /><i /></div>
          </div>

          <span className="train-arrival__coupler" />

          <div className="train-arrival__passenger-consist" data-testid="arrival-passenger-consist">
            <Coach mark={event.payload.carriage.visualMark} featured />
            <span className="train-arrival__coupler train-arrival__coupler--coach" />
            <Coach />
          </div>
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
