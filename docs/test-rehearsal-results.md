# Лиза × Виктор — результаты автоматической репетиции

Статус: **АВТОМАТИКА GREEN · РЕАЛЬНОЕ ЖЕЛЕЗО ЕЩЁ НЕ ПРОГНАНО**

Дата автоматического прогона: **19.08.2026**  
Проверенный code snapshot: **`3e379f8f66e182c9d5ac0b75427412b2f0199efb`**  
Репозиторий: `qazasddaemon1602-commits/love-story-live`

> PASS ниже означает только реально выполненную проверку. Два физических ТВ, телефоны, venue Wi‑Fi и реальный файл Premiere всё ещё требуют отдельной ручной репетиции.

## Полный hosted-прогон

| Проверка | Результат | Фактическое подтверждение |
|---|---|---|
| Dependency install | PASS | GitHub Actions, Node 22, `npm install --legacy-peer-deps`. |
| `npm run typecheck` | PASS | Полный TypeScript check. |
| `npm test` | PASS | Полный Vitest unit-suite; **324 / 324 tests PASS** на проверенном code snapshot. |
| `npm run build` | PASS | Production Vite build. |
| Clean Supabase migrations | PASS | Локальная чистая база успешно применяет миграции `001 → 027`. |
| `supabase test db` | PASS | Весь pgTAP database suite на чистой базе. |
| `npm run e2e` | PASS | Playwright Chromium + полный локальный Supabase stack + multi-client flows. |

## Что реально проверяет Playwright

- owner login через Supabase Auth;
- `/admin` закрыт от anonymous пользователя;
- anon не может вызывать owner reset/Bunker/MK mutations;
- приватные `guests` и `couple_preanswers` не перечисляются anon-клиентом;
- гостевая регистрация обновляет owner dashboard;
- регистрация создаёт projector train moment с **реальным визуальным локомотивом**;
- composition lock оставляет регистрацию открытой для позднего гостя;
- регистрация во время Premiere не перебивает защищённый projector;
- поздний гость после Premiere получает следующий билет, раннее назначение не меняется;
- Bunker захватывает два независимых `/screen`, таймеры синхронизированы примерно до 1 сек;
- ordinary train events не пробиваются через Bunker;
- Bunker поверх активной Premiere размонтирует video и после STOP возвращает authoritative state;
- `/admin` проверяется в viewport **390×844** без горизонтального overflow;
- `/screen` проверяется в **1920×1080**, QR остаётся внутри TV viewport;
- `/screen` не содержит owner mutation controls.

## Database / realtime contracts

- registration ticket sequence сериализован на event row;
- reset сохраняет couple preanswers и Premiere media configuration;
- reset очищает guests/runtime/quiz/MK/Bunker и возвращает ticket sequence к 1;
- `guests` опубликована в `supabase_realtime` через migration `026`;
- MK owner mutations закрыты от anon;
- migration `027` вводит explicit MK presentation ownership для общего `/screen`;
- MK main-screen takeover запрещён, пока общий projector принадлежит Premiere или Bunker;
- dedicated `/mortal-kombat/screen` остаётся независимым от общего main screen;
- Bunker `00:00` остаётся emergency до explicit owner STOP;
- Bunker owner RPC authoritative даже при временной потере broadcast;
- projector connection health хранится по источникам, поэтому восстановление одного канала не скрывает другой обрыв.

## Cloud sync после автоматического GREEN

Lovable Cloud вручную синхронизирован с новыми schema changes:

- migration `026`: `guests` присутствует в `supabase_realtime` — PASS;
- migration `027`: `owner_set_mk_main_screen(uuid, boolean)` существует — PASS;
- authenticated имеет EXECUTE — PASS;
- anon EXECUTE запрещён — PASS;
- runtime после DDL остался чистым: guests `0`, MK registrations `0`, Bunker `idle`, event module `idle` — PASS.

**Важно:** в новой Cloud-базе `couple_preanswers = 0`. Это не ошибка reset — старые ответы Лизы/Виктора не переносились из предыдущей базы. Их надо перенести/заполнить до финального GO.

## Визуальные изменения этого цикла

- registration arrival теперь выглядит как боковой пассажирский поезд: локомотив, кабина/нос, пантограф, фары, вагоны, колёса, рельсы и пар;
- имя пассажира и назначенный вагон остаются главным текстовым фокусом;
- движение сделано в основном через `transform`/`opacity` и имеет `prefers-reduced-motion` fallback;
- `/admin` получил компактную верхнюю панель `РЕПЕТИЦИЯ` с прямыми ссылками на TV/guest/quiz/MK/MK TV;
- админка получила background polling fallback и nonblocking reconnect status;
- MK больше не обязан держать общий `/screen` весь турнир: owner может `ВЕРНУТЬ ГЛАВНЫЙ ЭКРАН`, не останавливая tournament state.

## Что ещё обязательно проверить вручную

| Сценарий | Статус |
|---|---|
| Owner login на реальном телефоне владельца | NOT RUN |
| Два физических ТВ одновременно | NOT RUN |
| QR читается с реальной дистанции комнаты | NOT RUN |
| Звук train / countdown / Bunker на конкретных ТВ-браузерах | NOT RUN |
| Autoplay policies конкретных ТВ | NOT RUN |
| Реальный `КОЛЬЦО.mp4` canplay 2/2 | NOT RUN |
| Реальная синхронизация 623-секундного видео на двух ТВ | NOT RUN |
| HDMI / саундбар / системная громкость | NOT RUN |
| Venue Wi‑Fi disconnect/reconnect | NOT RUN |
| Production `.ru` из России без VPN | NOT RUN |
| Couple preanswers реально заполнены в production Cloud | NOT RUN |

## Отдельно от основной платформы

В исходном плане «Последнего вагона» был более крупный игровой слой: случайные цифровые персонажи/характеристики, скрытое раскрытие, задания вагонов, обмены, очки/рейтинг, QR-цепочки и финальный код. Он **не потерян**, но ранее был сознательно отложен до завершения основной live-платформы. Нынешний GREEN относится к платформе мероприятия; этот контентный игровой слой лучше проектировать отдельным этапом с заранее сбалансированным набором карточек и заданий, а не добавлять в последний момент.

## Решение

**AUTOMATED GO: PASS.**  
**EVENT-DAY GO: PENDING** — нужны реальные два ТВ/телефоны, production video/domain и заполненные ответы пары.

