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
