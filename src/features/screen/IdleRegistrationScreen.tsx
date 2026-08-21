import { QRCodeSVG } from 'qrcode.react';

type IdleRegistrationScreenProps = {
  joinUrl: string;
};

export function IdleRegistrationScreen({ joinUrl }: IdleRegistrationScreenProps) {
  return (
    <main className="event-screen event-screen--idle wedding-editorial-surface">
      <div className="event-screen__ambient event-screen__ambient--left" />
      <div className="event-screen__ambient event-screen__ambient--right" />

      <section className="idle-ticket" aria-label="Свадебный железнодорожный билет">
        <picture className="generated-artwork-picture">
          <source
            type="image/avif"
            srcSet="/images/ticket/paper-texture-512.avif 512w, /images/ticket/paper-texture-1024.avif 1024w"
            sizes="(max-width: 900px) calc(100vw - 2rem), min(94vw, 112rem)"
          />
          <source
            type="image/webp"
            srcSet="/images/ticket/paper-texture-512.webp 512w, /images/ticket/paper-texture-1024.webp 1024w"
            sizes="(max-width: 900px) calc(100vw - 2rem), min(94vw, 112rem)"
          />
          <img
            className="idle-ticket__paper-texture"
            data-testid="idle-ticket-paper-texture"
            src="/images/ticket/paper-texture.png"
            sizes="(max-width: 900px) calc(100vw - 2rem), min(94vw, 112rem)"
            alt=""
            aria-hidden="true"
          />
        </picture>

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

            <div className="idle-ticket__title-lockup" aria-hidden="true">
              <picture className="generated-artwork-picture">
                <source
                  type="image/avif"
                  srcSet="/images/ticket/railway-seal-128.avif 128w, /images/ticket/railway-seal-256.avif 256w"
                  sizes="(max-width: 900px) 82px, 109px"
                />
                <source
                  type="image/webp"
                  srcSet="/images/ticket/railway-seal-128.webp 128w, /images/ticket/railway-seal-256.webp 256w"
                  sizes="(max-width: 900px) 82px, 109px"
                />
                <img
                  className="idle-ticket__seal"
                  data-testid="idle-ticket-railway-seal"
                  src="/images/ticket/railway-seal.png"
                  sizes="(max-width: 900px) 82px, 109px"
                  alt=""
                  aria-hidden="true"
                />
              </picture>
              <span>THE LOVE</span>
              <strong>RAILWAY</strong>
              <i>TYUMEN · SPECIAL SERVICE</i>
              <picture className="generated-artwork-picture">
                <source
                  type="image/avif"
                  srcSet="/images/ticket/locomotive-engraving-480.avif 480w, /images/ticket/locomotive-engraving-960.avif 960w"
                  sizes="(max-width: 900px) 288px, 304px"
                />
                <source
                  type="image/webp"
                  srcSet="/images/ticket/locomotive-engraving-480.webp 480w, /images/ticket/locomotive-engraving-960.webp 960w"
                  sizes="(max-width: 900px) 288px, 304px"
                />
                <img
                  className="idle-ticket__locomotive"
                  data-testid="idle-ticket-locomotive-art"
                  src="/images/ticket/locomotive-engraving.png"
                  sizes="(max-width: 900px) 288px, 304px"
                  alt=""
                  aria-hidden="true"
                />
              </picture>
            </div>
          </div>

          <picture className="generated-artwork-picture">
            <source
              type="image/avif"
              srcSet="/images/ticket/tyumen-skyline-engraving-960.avif 960w, /images/ticket/tyumen-skyline-engraving-1600.avif 1600w"
              sizes="(max-width: 900px) calc(100vw - 6rem), 1120px"
            />
            <source
              type="image/webp"
              srcSet="/images/ticket/tyumen-skyline-engraving-960.webp 960w, /images/ticket/tyumen-skyline-engraving-1600.webp 1600w"
              sizes="(max-width: 900px) calc(100vw - 6rem), 1120px"
            />
            <img
              className="idle-ticket__skyline"
              data-testid="idle-ticket-skyline-art"
              src="/images/ticket/tyumen-skyline-engraving.png"
              sizes="(max-width: 900px) calc(100vw - 6rem), 1120px"
              alt=""
              aria-hidden="true"
            />
          </picture>

          <div className="idle-ticket__serial" aria-hidden="true">
            <span>TYUMEN · SPECIAL SERVICE</span>
            <span>✦</span>
            <span>ONE TRAIN · ONE STORY</span>
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
          <p className="idle-screen__join-url">{joinUrl}</p>

          <div className="idle-ticket__stub-meta" aria-hidden="true">
            <span>DATE</span><strong>30 AUG 2026</strong>
            <span>ROUTE</span><strong>LIZA ✦ VIKTOR</strong>
            <span>CLASS</span><strong>LOVE / LIVE</strong>
          </div>
        </aside>
      </section>

      <footer className="idle-screen__footer">
        <span>ЛИЗА × ВИКТОР · ТЮМЕНЬ</span>
        <span>ОДИН СОСТАВ · ОДНА ИСТОРИЯ</span>
      </footer>
    </main>
  );
}
