import { WeddingRailwayEmblem } from '../../visual/WeddingRailwayEmblem';

export function PremiereStandbyScreen() {
  return (
    <div
      className="premiere-standby wedding-editorial-surface"
      data-testid="premiere-standby"
      aria-label="Премьера подготовлена"
    >
      <div className="premiere-standby__content">
        <header className="premiere-standby__header">
          <p className="eyebrow">LIZA × VIKTOR</p>
          <h1>PREMIERE COMING SOON</h1>
        </header>
        
        <div className="premiere-standby__art">
          <WeddingRailwayEmblem className="wedding-railway-emblem premiere-standby__locomotive" />
          <div className="premiere-standby__line" />
        </div>

        <footer className="premiere-standby__footer">
          <p>TECHNICAL READINESS: ARMED & READY</p>
        </footer>
      </div>
    </div>
  );
}
