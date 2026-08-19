type BunkerEmergencySceneProps = {
  remainingSeconds: number;
  soundEnabled: boolean;
  soundArmed: boolean;
  onArmSound?: () => void;
};

function timerLabel(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function BunkerEmergencyScene({
  remainingSeconds,
  soundEnabled,
  soundArmed,
  onArmSound,
}: BunkerEmergencySceneProps) {
  const arrived = remainingSeconds <= 0;

  return (
    <section className="bunker-emergency" aria-live="assertive" data-testid="bunker-emergency-scene">
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

      <svg
        className="bunker-emergency__schematic"
        aria-hidden="true"
        data-testid="bunker-route-schematic"
        viewBox="0 0 640 160"
        preserveAspectRatio="xMidYMid meet"
        focusable="false"
      >
        <g className="bunker-emergency__schematic-lines">
          <path d="M8 60 H240" />
          <path d="M240 60 H632" strokeDasharray="6 8" />
          <path d="M240 60 C 320 60, 340 120, 430 120 H612" />
          <path d="M430 120 L 452 108 M430 120 L 452 132" />
        </g>
        <g className="bunker-emergency__schematic-nodes">
          <circle cx="8" cy="60" r="4" />
          <circle cx="240" cy="60" r="6" />
          <circle cx="612" cy="120" r="9" className="bunker-emergency__schematic-target" />
          <rect x="600" y="108" width="24" height="24" />
        </g>
        <g className="bunker-emergency__schematic-labels">
          <text x="8" y="42">PT-01</text>
          <text x="228" y="42">DIV-Δ</text>
          <text x="470" y="104">SHELTER 09</text>
          <text x="470" y="152">LN 30.00</text>
        </g>
      </svg>


      <header className="bunker-emergency__header">
        <span className="bunker-emergency__signal" aria-hidden="true" />
        <strong>ЭКСТРЕННОЕ СООБЩЕНИЕ</strong>
        <span>ПОЕЗД ВИКТОРА · СИСТЕМА ОПОВЕЩЕНИЯ</span>
      </header>

      <div className="bunker-emergency__content">
        <p>ПОЕЗД ИЗМЕНИЛ МАРШРУТ.</p>
        <h1>БУНКЕР</h1>
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

      {soundEnabled && !soundArmed && onArmSound && (
        <button type="button" className="bunker-emergency__sound" onClick={onArmSound}>
          ВКЛЮЧИТЬ ТРЕВОГУ
        </button>
      )}
    </section>
  );
}
