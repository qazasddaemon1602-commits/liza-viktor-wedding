import { QRCodeSVG } from 'qrcode.react';
import { WeddingRailwayEmblem } from '../visual/WeddingRailwayEmblem';

type IdleRegistrationScreenProps = {
  joinUrl: string;
};

export function IdleRegistrationScreen({ joinUrl }: IdleRegistrationScreenProps) {
  return (
    <main className="event-screen event-screen--idle wedding-editorial-surface">
      <div className="event-screen__ambient event-screen__ambient--left" />
      <div className="event-screen__ambient event-screen__ambient--right" />
      
      <section className="idle-ticket" aria-label="Свадебный железнодорожный билет">
        <div className="idle-ticket__body" data-testid="idle-ticket-body">
          <header className="idle-screen__masthead">
            <p className="idle-screen__brand">ЛИЗА × ВИКТОР</p>
            <p className="idle-screen__date">30 АВГУСТА 2026</p>
          </header>

          <div className="idle-ticket__body-grid">
            <div className="idle-screen__copy">
              <p className="eyebrow">ДОБРО ПОЖАЛОВАТЬ НА ВТОРОЙ ДЕНЬ</p>
              <h1>ПОЛУЧИТЕ СВОЙ БИЛЕТ</h1>
              <p className="idle-screen__lead">
                Наведите камеру телефона на QR-код, представьтесь и узнайте свой вагон.
              </p>
              <div className="idle-screen__route" aria-hidden="true">
                <span>ЛИЗА</span>
                <i />
                <span>ВИКТОР</span>
              </div>
            </div>

            <div className="idle-ticket__art" aria-hidden="true">
              <span className="idle-ticket__art-kicker">THE LOVE RAILWAY</span>
              <div className="idle-ticket__art-container">
                <WeddingRailwayEmblem className="wedding-railway-emblem idle-ticket__locomotive" />
                <div className="idle-ticket__stamp">
                  <span>LV</span>
                  <strong>30·08</strong>
                  <span>2026</span>
                </div>
              </div>
            </div>
          </div>

          <div className="idle-ticket__serial" aria-hidden="true">
            <span>TYUMEN · SPECIAL SERVICE</span>
            <span>✦</span>
            <span>ONE TRAIN · FIVE CARRIAGES</span>
          </div>
        </div>

        <aside className="idle-ticket__stub" data-testid="idle-ticket-stub">
          <div className="idle-ticket__stub-head">
            <span>BOARDING PASS</span>
            <strong>TRAIN No. LV-830</strong>
          </div>

          <div
            className="idle-screen__qr-frame"
            data-testid="registration-qr"
            data-join-url={joinUrl}
          >
            <QRCodeSVG
              value={joinUrl}
              size={420}
              level="M"
              bgColor="#F3EEE5"
              fgColor="#252724"
              title="QR-код регистрации гостей"
              className="idle-screen__qr"
            />
          </div>

          <p className="idle-screen__scan-label">НАВЕДИТЕ КАМЕРУ → ПОЛУЧИТЕ БИЛЕТ</p>

          <div className="idle-ticket__stub-meta" aria-hidden="true">
            <span>DATE</span><strong>30 AUG 2026</strong>
            <span>ROUTE</span><strong>LIZA ✦ VIKTOR</strong>
            <span>CLASS</span><strong>LOVE / LIVE</strong>
          </div>
        </aside>
      </section>

      <footer className="idle-screen__footer">
        <span>ПОЕЗД ВИКТОРА</span>
        <span>ОДИН СОСТАВ · ПЯТЬ ВАГОНОВ</span>
      </footer>
    </main>
  );
}
