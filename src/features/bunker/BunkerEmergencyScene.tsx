import { BunkerResponsivePicture } from './BunkerResponsivePicture';

type BunkerEmergencySceneProps = {
  remainingSeconds: number;
  motionPreference?: 'full' | 'reduced';
};

function timerLabel(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function BunkerEmergencyScene({
  remainingSeconds,
  motionPreference = 'full',
}: BunkerEmergencySceneProps) {
  const arrived = remainingSeconds <= 0;
  const reducedMotion = motionPreference === 'reduced';

  return (
    <section
      className="bunker-emergency"
      aria-live="assertive"
      data-motion={motionPreference}
      data-testid="bunker-emergency-scene"
    >
      <BunkerResponsivePicture
        asset="train-tunnel"
        className="bunker-emergency__artwork"
        testId="bunker-emergency-artwork"
        loading="eager"
      />
      {!reducedMotion && (
        <>
          <div className="bunker-emergency__blackout" aria-hidden="true" data-testid="bunker-blackout" />
          <div className="bunker-emergency__sync-tear" aria-hidden="true" data-testid="bunker-sync-tear" />
        </>
      )}
      <div className="bunker-emergency__scan" aria-hidden="true" />
      <div className="bunker-emergency__frame" aria-hidden="true">
        <span className="bunker-emergency__corner bunker-emergency__corner--tl" />
        <span className="bunker-emergency__corner bunker-emergency__corner--tr" />
        <span className="bunker-emergency__corner bunker-emergency__corner--bl" />
        <span className="bunker-emergency__corner bunker-emergency__corner--br" />
      </div>
      <div className="bunker-emergency__grid" aria-hidden="true" />

      <ul className="bunker-emergency__index" aria-hidden="true" data-testid="bunker-archive-index">
        <li>ARCH. 07 / 21</li>
        <li>SEC. LV-04</li>
        <li>N 55°45′ E 37°37′</li>
        <li>REG. 1602</li>
      </ul>

      <BunkerResponsivePicture
        asset="tunnel-map-master"
        className="bunker-emergency__schematic"
        testId="bunker-route-schematic"
        sizes="(max-width: 1100px) 1px, 30vw"
      />

      <header className="bunker-emergency__header">
        <span className="bunker-emergency__signal" aria-hidden="true" />
        <strong>ЭКСТРЕННОЕ СООБЩЕНИЕ</strong>
        <span>ПОЕЗД ВИКТОРА · СИСТЕМА ОПОВЕЩЕНИЯ</span>
      </header>

      <div className="bunker-emergency__content">
        <p>ПОЕЗД ИЗМЕНИЛ МАРШРУТ.</p>
        <h1 className="bunker-emergency__title-reveal">БУНКЕР</h1>
        <p>ЕДИНСТВЕННАЯ БЕЗОПАСНАЯ ТОЧКА</p>

        <div className="bunker-emergency__timer-block">
          <span>{arrived ? 'ПРИБЫТИЕ · БУНКЕР' : 'ВРЕМЯ ДО ПРИБЫТИЯ'}</span>
          <strong data-testid="bunker-timer">{timerLabel(remainingSeconds)}</strong>
        </div>
      </div>

      <footer className="bunker-emergency__footer">
        <span>СОХРАНЯЙТЕ СПОКОЙСТВИЕ · СЛЕДУЙТЕ УКАЗАНИЯМ ВЕДУЩЕГО</span>
        <span>{arrived ? 'ТОЧКА ДОСТИГНУТА' : 'МАРШРУТ ПЕРЕСТРОЕН'}</span>
      </footer>
    </section>
  );
}
