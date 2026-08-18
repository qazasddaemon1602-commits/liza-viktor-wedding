# Лиза × Виктор — результаты генеральной репетиции

Статус: **НЕ ПРОВЕДЕНА НА РЕАЛЬНОМ ЖЕЛЕЗЕ**

> Заполнять только фактическими результатами. Не ставить PASS, пока проверка реально не выполнена на соответствующем устройстве/сценарии.

## Окружение

- Дата/время репетиции: —
- Production URL: —
- Ноутбук владельца: —
- ТВ/экран №1: —
- ТВ/экран №2: —
- Аудиовыход: —
- Телефон гостя A: —
- Телефон позднего гостя B: —
- Телефон/ссылка Лизы: —
- Телефон/ссылка Виктора: —
- Сеть/Wi‑Fi: —

## Полный автоматический прогон

| Проверка | Результат | Примечание |
|---|---|---|
| `npm run typecheck` | NOT RUN | Hosted GitHub Actions run не наблюдается через доступный connector; локальное окружение не имеет npm dependency cache/network install. |
| `npm test` | NOT RUN | Не подменять targeted harness полным Vitest suite. |
| `supabase test db` | NOT RUN | Локальный Supabase/Postgres/Docker отсутствует в текущем execution container. |
| `npm run build` | NOT RUN | Требует полного dependency install. |
| `npm run e2e` | NOT RUN | Playwright workflow и multi-client tests подготовлены, но hosted run не наблюдается. |

## Выполненные targeted-проверки свежего кода

Всего исполняемых targeted assertions: **103 / 103 PASS**, отдельно выполнены строгие TypeScript compile-checks Bunker-блока и route integration.

| Проверка | Результат | Примечание |
|---|---|---|
| Bunker isolated strict TypeScript compile | PASS | Текущие Bunker service/realtime/audio/screen/admin/dock/zero-state модули собраны `tsc --strict` в изолированном harness. |
| `/admin` + `/screen` + MK screen route integration compile | PASS | Проверена типовая интеграция Bunker dock/guard в маршруты. |
| Bunker service RPC/parser executable suite | PASS | 5/5: public state, owner state, exact start/sound/stop RPC, invalid timestamp rejection. |
| Bunker realtime executable suite | PASS | 6/6: channel, refresh callback, subscribe/send/unsubscribe. |
| Bunker audio executable suite | PASS | 6/6: arm/resume, single alarm loop, pulse, stop, dispose. |
| Bunker server-clock timer executable suite | PASS | 4/4: 30:00, 29:59, skewed TV clock + server offset, clamp at zero. |
| Bunker presentation protection executable suite | PASS | 5/5: false→true→false, no duplicate emit, unsubscribe isolation. |
| Frontend reset-service contract | PASS | 6/6: explicit `СБРОСИТЬ`, MK/Bunker acknowledgements, couple-preservation acknowledgement, malformed response rejection. |
| MK bracket + milestone pure suite | PASS | 15/15: 15 матчей, 8→4→2→1, downstream, invalid pools, 8/12/16, semifinalists/finalists/winner priority. |
| MK public service + realtime suite | PASS | 9/9: guest/screen projection, waitlist join, privacy device key, invalid-state rejection, realtime refresh. |
| MK owner service suite | PASS | 10/10: owner projection, open/close/randomize/swap/replace/remove/promote/finalize/current/bracket, impact/champion/undo contracts. |
| Premiere synchronization/control targeted suite | PASS | 21/21: countdown 10→1, no 0, presence TTL/readiness, realtime, authoritative position, owner pause/resume/seek/restart/black/main/sound. |
| PWA cache policy | PASS | 11/11: app shell, static cache, video bypass, external/API bypass. |
| PWA service-worker registration | PASS | 5/5: `/sw.js`, scope `/`, unsupported/failure-safe behavior. |

## Подготовленные regression tests, ожидающие полный Vitest / Playwright runner

- `ScreenPage.bunker-protection.test.tsx`: Bunker отбрасывает ordinary screen events/audio; underlying premiere `<video>` размонтируется; после STOP authoritative state читается заново.
- `BunkerScreenGuard.test.tsx`: emergency остаётся на `00:00` до explicit owner STOP, alarm loop на нуле не продолжается.
- `AdminPage.reset-factory.test.ts`: reset рассылает refresh в `premiere`, `quiz`, `mk` и `bunker`.
- `e2e/event-flow.spec.ts`: два независимых `/screen`, синхронизация Бункера ≤1 сек, регистрация во время emergency не вызывает train-scene, STOP возвращает оба экрана без stale event.

## Статический DB-аудит

- `reset.sql`: pgTAP plan совпадает с числом assertions; reset удаляет runtime-гостей/голоса/MK-данные, сохраняет couple preanswers и premiere media, сбрасывает ticket sequence и Bunker runtime.
- `bunker.sql`: проверены table/function signatures/privileges/default 1800 sec; добавлен контракт, что `00:00` остаётся `active` до explicit STOP.
- `mortal_kombat.sql`, `mortal_kombat_admin.sql`, `mortal_kombat_results.sql`, `mortal_kombat_screen_control.sql`: plan counts и RPC signatures/privileges сопоставлены с финальными миграциями.
- `202608180018_mortal_kombat_core_fixes.sql` перекрывает ранний rowtype SELECT из core migration и заменяет seed uniqueness на partial unique index.
- `.github/workflows/db-tests.yml` действительно вызывает `supabase db start` → `supabase test db`; команда соответствует официальному Supabase CLI CI-паттерну. Полный DB PASS всё равно не ставится до реального запуска.

## Ручная репетиция

| Сценарий | PASS/FAIL | Примечание |
|---|---|---|
| Owner login | NOT RUN | |
| 2 экрана одновременно online | NOT RUN | |
| Активация звука на обоих экранах | NOT RUN | |
| QR сканируется с дистанции | NOT RUN | |
| Регистрация нового гостя | NOT RUN | |
| Realtime toast в админке | NOT RUN | |
| Train arrival на экранах | NOT RUN | |
| Duplicate delete | NOT RUN | |
| Recovery code на новом телефоне | NOT RUN | |
| Composition lock + late guest | NOT RUN | |
| Carriage call на телефон | NOT RUN | |
| Carriage call на ТВ | NOT RUN | |
| Quiz voting/results | NOT RUN | |
| Couple answer reveal | NOT RUN | |
| Final Five isolation | NOT RUN | |
| MK 16 игроков + waitlist | NOT RUN | Targeted MK logic/service tests PASS, реальный браузерный поток ещё не прогнан. |
| MK no-show + promote | NOT RUN | Component/SQL contract подготовлен; full browser/DB run ещё не подтверждён. |
| MK draw 15 матчей | NOT RUN | Pure bracket targeted suite PASS; DB/browser execution ещё не подтверждён. |
| MK current fight на 2 ТВ | NOT RUN | |
| MK показать сетку | NOT RUN | RPC и fallback wiring проверены статически/targeted; реальное ТВ ещё не проверено. |
| MK winner advancement | NOT RUN | Pure downstream + owner service PASS; pgTAP/browser flow ещё не прогнан. |
| MK correction warning | NOT RUN | Owner impact/undo contracts PASS; UI browser flow ещё не прогнан. |
| MK champion | NOT RUN | Owner champion contract PASS; реальный projector flow ещё не прогнан. |
| Premiere video canplay 2/2 | NOT RUN | |
| Premiere audio ready 2/2 | NOT RUN | |
| Countdown 10→1, без 0 | NOT RUN | Targeted countdown PASS; реальный browser timing ещё не проверен. |
| Countdown audio | NOT RUN | |
| Video simultaneous start | NOT RUN | |
| Late-joined TV seeks current position | NOT RUN | Authoritative-position targeted PASS; реальное ТВ ещё не проверено. |
| Pause/resume | NOT RUN | Targeted RPC/player logic PASS. |
| ±5 sec | NOT RUN | Targeted RPC PASS. |
| Restart | NOT RUN | Targeted RPC PASS. |
| Black screen | NOT RUN | Targeted RPC PASS. |
| Natural end → black | NOT RUN | |
| Return main screen | NOT RUN | Targeted RPC PASS. |
| Late guest after premiere | NOT RUN | |
| Bunker two-step owner launch | NOT RUN | Targeted component/service contract PASS, реальный owner session ещё не проверен. |
| Bunker 30:00 synchronized on 2 TVs | NOT RUN | Таймерная формула PASS; двухэкранный Playwright test подготовлен, но не выполнен. |
| Bunker alarm/autoplay fallback | NOT RUN | Audio controller PASS; браузерная autoplay policy ещё не проверена на ТВ. |
| Bunker suppresses premiere/MK/ordinary events | NOT RUN | Regression test подготовлен; код теперь размонтирует underlying presentation state во время takeover. |
| Bunker 00:00 hold | NOT RUN | Code/DB contract: остаётся emergency на `00:00` до explicit STOP; browser/DB runner ещё не выполнен. |
| Bunker stop returns both screens | NOT RUN | Poll/realtime + authoritative reload реализованы; реальный multi-TV прогон ещё не проведён. |
| Wi‑Fi disconnect 10–20 sec | NOT RUN | |
| Automatic reconnect | NOT RUN | |
| Heartbeat TTL | NOT RUN | Targeted presence TTL PASS; реальная сеть ещё не проверена. |
| Reset clears runtime test data | NOT RUN | Frontend contract PASS; pgTAP/full DB execution ещё не проведён. |
| Reset preserves couple preanswers | NOT RUN | Миграция и pgTAP контракт это требуют; полный DB execution ещё не проведён. |

## Найденные проблемы и исправления

- `AdminBunkerDock`: raw Supabase client мог конфликтовать со строгим RPC type → приведён к `AdminRpcClient`.
- Bunker fake-timer test: `findBy*` при fake timers имел flake-risk → детерминированный `act + advanceTimersByTimeAsync`.
- Frontend reset parser терял `mortalKombatReset` / `bunkerReset` → контракт обновлён.
- Старые reset React fixtures использовали прежнюю форму результата → обновлены.
- Global reset очищал Bunker в DB, но не делал немедленный realtime refresh → добавлен `bunker:liza-viktor` broadcast.
- Bunker визуально перекрывал обычные события, но очередь/train audio могла жить под emergency → добавлен presentation-protection contract, ordinary events теперь отбрасываются.
- Underlying premiere video мог продолжать играть под Bunker → при takeover cached presentation states очищаются и media scene размонтируется; после STOP идёт authoritative reload.
- На естественном `00:00` экран мог выйти из emergency, а `event_state` остаться Bunker → добавлена migration `202608180025_bunker_arrival_hold.sql`; теперь `00:00` держится до explicit owner STOP, alarm прекращается.
- GitHub Actions runs/check statuses не возвращаются доступным connector даже для ранее известных CI commit SHA; публичная Actions page также не удалось получить через доступный web fetch. Hosted GREEN пока не подтверждён.

## Решения перед мероприятием

- Получить один полный автоматический прогон `typecheck + Vitest + build + pgTAP + Playwright` в окружении с работающим runner/dependency install.
- После автоматического GREEN провести реальную репетицию минимум на двух ТВ/экранах и двух телефонах по `docs/event-day-checklist.md`.

## Финальное решение

**GO / NO-GO: НЕ ОПРЕДЕЛЕНО — targeted fresh-code verification 103/103 PASS, полный suite и real-hardware rehearsal ещё обязательны.**
