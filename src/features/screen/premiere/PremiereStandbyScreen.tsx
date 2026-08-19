import { WeddingRailwayEmblem } from '../../visual/WeddingRailwayEmblem';
import { PremiereEditorialFrame } from '../../premiere/PremiereEditorialFrame';

export function PremiereStandbyScreen() {
  return (
    <div
      className="premiere-standby"
      data-testid="premiere-standby"
      aria-label="Премьера подготовлена"
    >
      <PremiereEditorialFrame index="PRM · 01" />

      <div className="premiere-standby__content">
        <header className="premiere-standby__header">
          <p className="premiere-eyebrow">ЛИЗА × ВИКТОР · 30.08.2026</p>
          <h1 className="premiere-standby__title">ПРЕМЬЕРА</h1>
          <p className="premiere-standby__subtitle">СКОРО НА ЭКРАНЕ</p>
        </header>

        <div className="premiere-standby__art" aria-hidden="true">
          <span className="premiere-standby__rule" />
          <WeddingRailwayEmblem className="wedding-railway-emblem premiere-standby__locomotive" />
          <span className="premiere-standby__rule" />
        </div>

        <footer className="premiere-standby__footer">
          <span>FILM 01</span>
          <span>LV-830</span>
          <span>ГОТОВНОСТЬ ПОДТВЕРЖДЕНА</span>
        </footer>
      </div>
    </div>
  );
}
