import { useEffect, type CSSProperties } from 'react';
import { siteAudio } from '../../lib/siteAudio';
import type { CarriageCallScreenEvent } from './screenEvents.realtime';

type CarriageCallSceneProps = {
  event: CarriageCallScreenEvent;
};

function projectorSoundEnabled(): boolean {
  if (typeof document === 'undefined') return true;
  const control = document.querySelector('.screen-audio-arm');
  return !control?.textContent?.includes('ВКЛЮЧИТЬ ЗВУК');
}

export function CarriageCallScene({ event }: CarriageCallSceneProps) {
  useEffect(() => {
    siteAudio.beginPriority('scene');
    if (!projectorSoundEnabled()) {
      return () => siteAudio.endPriority('scene');
    }

    let audio: HTMLAudioElement | null = null;
    if (typeof Audio !== 'undefined') {
      audio = new Audio('/audio/train/carriage-call.mp3');
      audio.preload = 'auto';
      audio.volume = 0.72;
      const playback = audio.play();
      if (playback && typeof playback.catch === 'function') {
        void playback.catch(() => {
          void siteAudio.arm().then((ready) => {
            if (ready) siteAudio.play('impact');
          });
        });
      }
    } else {
      void siteAudio.arm().then((ready) => {
        if (ready) siteAudio.play('impact');
      });
    }

    return () => {
      if (audio) {
        audio.pause();
        try {
          audio.currentTime = 0;
        } catch {
          // Metadata may not have loaded yet; pause is enough.
        }
      }
      siteAudio.endPriority('scene');
    };
  }, [event.id]);

  return (
    <section className="carriage-call-scene" aria-live="assertive" aria-atomic="true">
      <div className="carriage-call-scene__frame" aria-hidden="true" />

      <header className="carriage-call-scene__meta">
        <span>ПОЕЗД ВИКТОРА</span>
        <span>30 · 08 · 2026</span>
      </header>

      <div className="carriage-call-scene__content">
        <p className="carriage-call-scene__eyebrow">ОБЪЯВЛЕНИЕ ПО СОСТАВУ</p>
        <h2>{event.payload.message}</h2>

        <div className="carriage-call-scene__targets" aria-label="Вызванные вагоны">
          {event.payload.carriages.map((carriage) => (
            <div
              key={carriage.id}
              className="carriage-call-scene__target"
              data-testid={`carriage-call-${carriage.id}`}
              style={{ '--call-accent': carriage.accentHex } as CSSProperties}
            >
              <span className="carriage-call-scene__mark">{carriage.visualMark}</span>
              <strong>{carriage.label}</strong>
            </div>
          ))}
        </div>
      </div>

      <footer className="carriage-call-scene__footer">
        <span>СЛЕДУЙТЕ К ОБЪЯВЛЕННОЙ ЗОНЕ</span>
        <i />
        <span>СОСТАВ ПРОДОЛЖАЕТ ДВИЖЕНИЕ</span>
      </footer>
    </section>
  );
}
