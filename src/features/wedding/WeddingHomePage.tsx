import { useEffect, useState } from 'react';
import { EVENT_DATE, WEDDING_DATE } from '../../lib/eventConfig';

type EditorialAsset = 'editorial-hero' | 'editorial-story' | 'editorial-venue' | 'editorial-ticket-still';

const EDITORIAL_ASSETS: Record<EditorialAsset, { width: number; height: number; responsiveWidths: readonly number[] }> = {
  'editorial-hero': { width: 1122, height: 1402, responsiveWidths: [720, 1122] },
  'editorial-story': { width: 1122, height: 1402, responsiveWidths: [720, 1122] },
  'editorial-venue': { width: 1122, height: 1402, responsiveWidths: [720, 1122] },
  'editorial-ticket-still': { width: 1672, height: 941, responsiveWidths: [960, 1672] },
};

function editorialSourceSet(asset: EditorialAsset, format: 'avif' | 'webp') {
  return EDITORIAL_ASSETS[asset].responsiveWidths
    .map((width) => `/images/wedding/${asset}-${width}.${format} ${width}w`)
    .join(', ');
}

function WeddingEditorialPicture({
  asset,
  alt,
  loading,
  fetchPriority,
  sizes,
}: {
  asset: EditorialAsset;
  alt: string;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
  sizes: string;
}) {
  const spec = EDITORIAL_ASSETS[asset];
  return (
    <picture>
      <source type="image/avif" srcSet={editorialSourceSet(asset, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={editorialSourceSet(asset, 'webp')} sizes={sizes} />
      <img
        src={`/images/wedding/${asset}.png`}
        alt={alt}
        width={spec.width}
        height={spec.height}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
      />
    </picture>
  );
}

const TYUMEN_UTC_OFFSET = '+05:00';
const RUSSIAN_MONTHS = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

function dateDisplay(isoDate: string) {
  const [year, month, day] = isoDate.split('-');
  const monthNumber = Number(month);

  return {
    dayMonth: `${day}·${month}`,
    dotted: `${day}.${month}.${year}`,
    long: `${Number(day)} ${RUSSIAN_MONTHS[monthNumber - 1]} ${year}`,
    year,
  };
}

const EVENT_DATE_DISPLAY = dateDisplay(EVENT_DATE);
const WEDDING_DATE_DISPLAY = dateDisplay(WEDDING_DATE);
const CELEBRATION_DATE_START_MS = Date.parse(
  `${EVENT_DATE}T00:00:00${TYUMEN_UTC_OFFSET}`,
);

function countdownParts(nowMs: number) {
  const remainingSeconds = Math.ceil(Math.max(0, CELEBRATION_DATE_START_MS - nowMs) / 1_000);

  return {
    days: Math.floor(remainingSeconds / 86_400),
    hours: Math.floor((remainingSeconds % 86_400) / 3_600),
    minutes: Math.floor((remainingSeconds % 3_600) / 60),
    seconds: remainingSeconds % 60,
  };
}

function WeddingCountdown() {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const countdown = countdownParts(nowMs);

  useEffect(() => {
    if (nowMs >= CELEBRATION_DATE_START_MS) return;

    const interval = window.setInterval(() => {
      const nextNow = Date.now();
      setNowMs(nextNow);
      if (nextNow >= CELEBRATION_DATE_START_MS) window.clearInterval(interval);
    }, 1_000);

    return () => window.clearInterval(interval);
  }, []);

  const twoDigits = (value: number) => String(value).padStart(2, '0');

  return (
    <aside className="wedding-home__countdown" role="timer" aria-label="До начала праздника">
      <div className="wedding-home__countdown-heading">
        <span>До встречи</span>
        <strong>Осталось</strong>
      </div>
      <div aria-label="Дни">
        <strong>{twoDigits(countdown.days)}</strong>
        <span>дней</span>
      </div>
      <div aria-label="Часы">
        <strong>{twoDigits(countdown.hours)}</strong>
        <span>часов</span>
      </div>
      <div aria-label="Минуты">
        <strong>{twoDigits(countdown.minutes)}</strong>
        <span>минут</span>
      </div>
      <div aria-label="Секунды">
        <strong>{twoDigits(countdown.seconds)}</strong>
        <span>секунд</span>
      </div>
    </aside>
  );
}

export function WeddingHomePage() {
  return (
    <main className="theme-wedding wedding-home">
      <header className="wedding-home__masthead">
        <a
          className="wedding-home__monogram wedding-home__monogram-link"
          href="#top"
          aria-label="Лиза и Виктор — в начало страницы"
          style={{ minWidth: '44px', minHeight: '44px' }}
        >
          Л <span aria-hidden="true">×</span> В
        </a>
        <nav className="wedding-home__nav" aria-label="Основная навигация">
          <a href="#story">Наша история</a>
          <a href="#schedule">Программа</a>
          <a href="#venue">Место</a>
          <a href="#gallery">Галерея</a>
          <a href="#rsvp">Регистрация</a>
        </nav>
      </header>

      <section className="wedding-home__hero" id="top" aria-labelledby="wedding-home-title">
        <div className="wedding-home__hero-copy">
          <p className="wedding-home__eyebrow">Приглашение на свадьбу</p>
          <h1 id="wedding-home-title" aria-label="Лиза и Виктор">
            <span>Лиза</span>
            <small aria-hidden="true">и</small>
            <span>Виктор</span>
          </h1>
          <time className="wedding-home__date" dateTime={WEDDING_DATE}>
            {WEDDING_DATE_DISPLAY.long}
          </time>
          <p className="wedding-home__intro">
            Будем счастливы разделить с вами день, наполненный встречами,
            теплом и большой семейной историей.
          </p>
        </div>
        <figure className="wedding-home__media wedding-home__hero-media">
          <WeddingEditorialPicture
            asset="editorial-hero"
            alt="Свадебная пара у поезда"
            fetchPriority="high"
            sizes="(max-width: 760px) 100vw, 46vw"
          />
          <figcaption>Дорога начинается здесь</figcaption>
        </figure>
        <div className="wedding-home__hero-facts" aria-label="Сведения о празднике">
          <p aria-hidden="true">{WEDDING_DATE_DISPLAY.dayMonth}</p>
          <dl>
            <div>
              <dt>Год</dt>
              <dd>{WEDDING_DATE_DISPLAY.year}</dd>
            </div>
            <div>
              <dt>Город</dt>
              <dd>Тюмень</dd>
            </div>
            <div>
              <dt>Событие</dt>
              <dd>Лиза × Виктор</dd>
            </div>
          </dl>
        </div>
      </section>

      <WeddingCountdown />

      <section className="wedding-home__story" id="story" aria-labelledby="story-title">
        <figure className="wedding-home__media wedding-home__story-media">
          <WeddingEditorialPicture
            asset="editorial-story"
            alt="Руки молодожёнов в купе поезда"
            loading="lazy"
            sizes="(max-width: 760px) 100vw, 44vw"
          />
          <figcaption>В пути · глава первая</figcaption>
        </figure>
        <div className="wedding-home__section-copy">
          <p className="wedding-home__eyebrow">Наша история</p>
          <h2 id="story-title">Любовь, которую мы выбрали</h2>
          <p>
            Однажды наши маршруты совпали. С тех пор мы учимся замечать
            важное, смеяться громче и всегда выбирать дорогу друг к другу.
          </p>
          <a className="wedding-home__text-link" href="#gallery">Смотреть моменты</a>
        </div>
      </section>

      <section className="wedding-home__schedule" id="schedule" aria-labelledby="schedule-title">
        <div className="wedding-home__section-heading wedding-home__section-heading--light">
          <p>Программа дня</p>
          <h2 id="schedule-title">Празднуем вместе</h2>
        </div>
        <ol className="wedding-home__schedule-list">
          <li>
            <span>01</span>
            <div>
              <h3>Встречаемся</h3>
              <p>Обнимаемся и настраиваемся на праздник.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Празднуем</h3>
              <p>Поднимаем бокалы, слушаем истории и смеёмся.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Танцуем</h3>
              <p>Оставляем формальности и выходим на танцпол.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="wedding-home__venue" id="venue" aria-labelledby="venue-title">
        <div className="wedding-home__venue-copy">
          <p className="wedding-home__eyebrow">Место</p>
          <h2 id="venue-title">Встречаемся в Тюмени</h2>
          <p>
            Подробности площадки и персональный маршрут будут доступны
            зарегистрированным гостям.
          </p>
          <a className="wedding-home__text-link" href="#rsvp">Открыть приглашение</a>
        </div>
        <figure className="wedding-home__media wedding-home__venue-media">
          <WeddingEditorialPicture
            asset="editorial-venue"
            alt="Зал для свадебного ужина в здании вокзала"
            loading="lazy"
            sizes="(max-width: 760px) 100vw, 44vw"
          />
          <figcaption>Тюмень · вечерняя сервировка</figcaption>
        </figure>
        <div className="wedding-home__venue-details">
          <dl className="wedding-home__venue-facts" aria-label="Сведения о месте и маршруте">
            <div>
              <dt>Город</dt>
              <dd>Тюмень</dd>
            </div>
            <div>
              <dt>Дата второго дня</dt>
              <dd><time dateTime={EVENT_DATE}>{EVENT_DATE_DISPLAY.long}</time></dd>
            </div>
            <div>
              <dt>Маршрут гостя</dt>
              <dd>После регистрации</dd>
            </div>
          </dl>
          <aside className="wedding-home__dress-code" aria-label="Рекомендации по образу">
            <p className="wedding-home__eyebrow">Dress code</p>
            <h3>Вечерний, но лёгкий</h3>
            <p>Выбирайте то, в чём хочется праздновать, танцевать и быть собой.</p>
            <div className="wedding-home__palette" role="img" aria-label="Палитра: графит, латунь, кремовый и корица">
              <span className="wedding-home__swatch wedding-home__swatch--graphite" aria-hidden="true" />
              <span className="wedding-home__swatch wedding-home__swatch--brass" aria-hidden="true" />
              <span className="wedding-home__swatch wedding-home__swatch--cream" aria-hidden="true" />
              <span className="wedding-home__swatch wedding-home__swatch--cinnamon" aria-hidden="true" />
            </div>
          </aside>
        </div>
      </section>

      <section className="wedding-home__gallery" id="gallery" aria-labelledby="gallery-title">
        <div className="wedding-home__section-heading">
          <p>Наши моменты</p>
          <h2 id="gallery-title">То, что хочется запомнить</h2>
        </div>
        <figure className="wedding-home__media wedding-home__ticket-still">
          <WeddingEditorialPicture
            asset="editorial-ticket-still"
            alt="Железнодорожный билет, кольца и цветы у окна поезда"
            loading="lazy"
            sizes="(max-width: 760px) 100vw, 88vw"
          />
          <figcaption>Билет на второй день · маршрут откроется после регистрации</figcaption>
        </figure>
        <ol className="wedding-home__archive" aria-label="Архив события">
          <li>
            <span>01</span>
            <time dateTime={WEDDING_DATE}>{WEDDING_DATE_DISPLAY.long}</time>
            <p>День свадьбы</p>
          </li>
          <li>
            <span>02</span>
            <time dateTime={EVENT_DATE}>{EVENT_DATE_DISPLAY.long}</time>
            <p>Второй день праздника</p>
          </li>
          <li>
            <span>03</span>
            <strong>Тюмень</strong>
            <p>Город встречи</p>
          </li>
          <li>
            <span>04</span>
            <strong>Поезд Виктора</strong>
            <p>Маршрут гостей</p>
          </li>
          <li>
            <span>05</span>
            <strong>Лиза × Виктор</strong>
            <p>Свадебная история</p>
          </li>
        </ol>
      </section>

      <section className="wedding-home__rsvp" id="rsvp" aria-labelledby="rsvp-title">
        <div className="wedding-home__rsvp-mark" aria-hidden="true">
          <span>Лиза</span>
          <span>×</span>
          <span>Виктор</span>
          <small>Тюмень · {EVENT_DATE_DISPLAY.dotted}</small>
        </div>
        <div className="wedding-home__rsvp-copy">
          <p className="wedding-home__eyebrow">До встречи</p>
          <h2 id="rsvp-title">Нам не терпится праздновать вместе с вами</h2>
          <p>Подтвердите участие и получите персональный маршрут гостя.</p>
          <a className="wedding-home__button" href="/join">Зарегистрироваться</a>
        </div>
      </section>

      <footer className="wedding-home__footer">
        <p className="wedding-home__monogram" aria-label="Лиза и Виктор">Л <span aria-hidden="true">×</span> В</p>
        <p>{WEDDING_DATE_DISPLAY.long} · Тюмень</p>
      </footer>
    </main>
  );
}
