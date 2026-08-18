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
      className="train-arrival"
      data-testid="train-arrival-scene"
      style={accentStyle}
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="train-arrival__wash" aria-hidden="true" />

      <div className="train-arrival__meta">
        <span>ПОЕЗД ВИКТОРА</span>
        <span>30 · 08 · 2026</span>
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

      <div className="train-arrival__stage" aria-hidden="true">
        <div className="train-arrival__rail train-arrival__rail--far" />
        <div className="train-arrival__rail train-arrival__rail--near" />
        <div className="train-arrival__train">
          <div className="train-arrival__engine">
            <div className="train-arrival__cab">
              <span className="train-arrival__window" />
              <span className="train-arrival__window" />
            </div>
            <div className="train-arrival__nose" />
            <span className="train-arrival__lamp" />
          </div>
          <div className="train-arrival__carriage">
            <span className="train-arrival__carriage-number">{event.payload.carriage.visualMark}</span>
            <span className="train-arrival__window" />
            <span className="train-arrival__window" />
            <span className="train-arrival__window" />
          </div>
          <div className="train-arrival__wheels">
            <i /><i /><i /><i />
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
