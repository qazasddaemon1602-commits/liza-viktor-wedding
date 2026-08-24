import { radioAudioSource } from './trainRadioAudio';
import type { RadioTransmissionScreenEvent } from './trainRadio.service';
import { WeddingLiveAudioPlayer } from './WeddingLiveAudioPlayer';

type Props = {
  transmission: RadioTransmissionScreenEvent;
  onAudioEnded?: () => void;
};

export function TrainRadioOverlay({ transmission, onAudioEnded }: Props) {
  return (
    <aside className="wedding-train-radio" aria-live="assertive" aria-label="Радио состава">
      <WeddingLiveAudioPlayer
        src={radioAudioSource(transmission.preset)}
        eventKey={transmission.id}
        onEnded={onAudioEnded}
      />
      <div className="wedding-train-radio__signal" aria-hidden="true"><span /><span /><span /><span /></div>
      <section className="wedding-train-radio__frame">
        <header>
          <p>РАДИО СОСТАВА</p>
          <strong>ON AIR</strong>
        </header>
        <div className="wedding-train-radio__copy">
          <span>{transmission.label}</span>
          <blockquote>{transmission.message}</blockquote>
        </div>
        <footer>
          <span>ЛИЗА × ВИКТОР · 30.08.2026</span>
          <span>СЛУЖЕБНАЯ ЧАСТОТА · 30.08 FM</span>
        </footer>
      </section>
    </aside>
  );
}
