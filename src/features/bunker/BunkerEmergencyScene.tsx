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
        <strong>EMERGENCY BROADCAST</strong>
        <span>NOCTRA SYSTEM · LIZA × VIKTOR</span>
      </header>

      <div className="bunker-emergency__content">
        <p>EVENT HORIZON REACHED.</p>
        <h1>BUNKER</h1>
        <p>ARCHIVAL CORE SECURED</p>

        <div className="bunker-emergency__timer-block">
          <span>{arrived ? 'ARRIVAL · BUNKER' : 'TIME UNTIL ARRIVAL'}</span>
          <strong data-testid="bunker-timer">{timerLabel(remainingSeconds)}</strong>
        </div>
      </div>

      <footer className="bunker-emergency__footer">
        <span>OBSERVE CULTURE IN THE NIGHT SKY</span>
        <span>{arrived ? 'CORE STABLE' : 'SHIFTING PERSPECTIVE'}</span>
      </footer>

      {soundEnabled && !soundArmed && onArmSound && (
        <button type="button" className="bunker-emergency__sound" onClick={onArmSound}>
          ARM SYSTEM SOUND
        </button>
      )}
    </section>
  );
}
