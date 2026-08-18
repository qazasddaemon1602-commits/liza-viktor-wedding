import { QRCodeSVG } from 'qrcode.react';

type IdleRegistrationScreenProps = {
  joinUrl: string;
};

export function IdleRegistrationScreen({ joinUrl }: IdleRegistrationScreenProps) {
  return (
    <main className="event-screen event-screen--idle">
      <div className="event-screen__ambient event-screen__ambient--left" aria-hidden="true" />
      <div className="event-screen__ambient event-screen__ambient--right" aria-hidden="true" />

      <header className="idle-screen__masthead">
        <p className="idle-screen__brand">ЛИЗА × ВИКТОР</p>
        <p className="idle-screen__date">30 АВГУСТА 2026</p>
      </header>

      <section className="idle-screen__content">
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

        <div className="idle-screen__qr-column">
          <div
            className="idle-screen__qr-frame"
            data-testid="registration-qr"
            data-join-url={joinUrl}
          >
            <QRCodeSVG
              value={joinUrl}
              size={420}
              level="M"
              bgColor="#F2E8D8"
              fgColor="#263B31"
              title="QR-код регистрации гостей"
              className="idle-screen__qr"
            />
          </div>
          <p className="idle-screen__scan-label">НАВЕДИТЕ КАМЕРУ → ПОЛУЧИТЕ БИЛЕТ</p>
        </div>
      </section>

      <footer className="idle-screen__footer">
        <span>ПОЕЗД ВИКТОРА</span>
        <span>ОДИН СОСТАВ · ПЯТЬ ВАГОНОВ</span>
      </footer>
    </main>
  );
}
