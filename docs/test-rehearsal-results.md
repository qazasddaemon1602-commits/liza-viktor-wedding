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
| `npm run typecheck` | NOT RUN | Hosted GitHub Actions run не наблюдается через доступный connector; локальное окружение не имеет npm network install. |
| `npm test` | NOT RUN | Не подменять targeted harness полным Vitest suite. |
| `supabase test db` | NOT RUN | Локальный Supabase/Postgres CLI отсутствует в текущем execution container. |
| `npm run build` | NOT RUN | Требует полного dependency install. |
| `npm run e2e` | NOT RUN | Playwright CI workflow подготовлен, но hosted run не наблюдается. |

## Выполненные targeted-проверки свежего кода

| Проверка | Результат | Примечание |
|---|---|---|
| Bunker isolated strict TypeScript compile | PASS | Текущие Bunker service/realtime/audio/screen/admin/dock модули собраны `tsc --strict` в изолированном harness. |
| `/admin` + `/screen` + MK screen route integration compile | PASS | Проверена типовая интеграция Bunker dock/guard в маршруты. |
| Bunker service RPC/parser executable suite | PASS | 5/5: public state, owner state, exact start/sound/stop RPC, invalid timestamp rejection. |
| Bunker realtime executable suite | PASS | 6/6: channel, refresh callback, subscribe/send/unsubscribe. |
| Bunker audio executable suite | PASS | 6/6: arm/resume, single alarm loop, pulse, stop, dispose. |
| Bunker server-clock timer executable suite | PASS | 4/4: 30:00, 29:59, skewed TV clock + server offset, clamp at zero. |
| Frontend reset-service contract | PASS | 6/6: explicit `СБРОСИТЬ`, MK/Bunker acknowledgements, couple-preservation acknowledgement, malformed response rejection. |
| MK bracket + milestone pure suite | PASS | 15/15: 15 матчей, 8→4→2→1, downstream, invalid pools, 8/12/16, semifinalists/finalists/winner priority. |
| MK public service + realtime suite | PASS | 9/9: guest/screen projection, waitlist join, privacy device key, invalid-state rejection, realtime refresh. |
| PWA cache policy | PASS | 11/11: app shell, static cache, video bypass, external/API bypass. |
| PWA service-worker registration | PASS | 5/5: `/sw.js`, scope `/`, unsupported/failure-safe behavior. |

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
| MK no-show + promote | NOT RUN | Component code/test добавлены; full Vitest/browser run ещё не подтверждён. |
| MK draw 15 матчей | NOT RUN | Pure bracket 15/15 targeted suite PASS; DB/browser execution ещё не подтверждён. |
| MK current fight на 2 ТВ | NOT RUN | |
| MK показать сетку | NOT RUN | |
| MK winner advancement | NOT RUN | Pure downstream logic PASS; pgTAP/browser flow ещё не прогнан. |
| MK correction warning | NOT RUN | |
| MK champion | NOT RUN | |
| Premiere video canplay 2/2 | NOT RUN | |
| Premiere audio ready 2/2 | NOT RUN | |
| Countdown 10→1, без 0 | NOT RUN | |
| Countdown audio | NOT RUN | |
| Video simultaneous start | NOT RUN | |
| Late-joined TV seeks current position | NOT RUN | |
| Pause/resume | NOT RUN | |
| ±5 sec | NOT RUN | |
| Restart | NOT RUN | |
| Black screen | NOT RUN | |
| Natural end → black | NOT RUN | |
| Return main screen | NOT RUN | |
| Late guest after premiere | NOT RUN | |
| Bunker two-step owner launch | NOT RUN | Targeted component/service contract PASS, реальный owner session ещё не проверен. |
| Bunker 30:00 synchronized on 2 TVs | NOT RUN | Таймерная формула 4/4 PASS; реальное железо ещё не проверено. |
| Bunker alarm/autoplay fallback | NOT RUN | Audio controller 6/6 PASS; браузерная политика autoplay ещё не проверена на ТВ. |
| Bunker stop returns both screens | NOT RUN | Poll/realtime logic targeted PASS; реальный multi-TV прогон ещё не проведён. |
| Wi‑Fi disconnect 10–20 sec | NOT RUN | |
| Automatic reconnect | NOT RUN | |
| Heartbeat TTL | NOT RUN | |
| Reset clears runtime test data | NOT RUN | Frontend contract PASS; pgTAP/full DB execution ещё не проведён. |
| Reset preserves couple preanswers | NOT RUN | Миграция и pgTAP контракт это требуют; полный DB execution ещё не проведён. |

## Найденные проблемы

- Во время targeted-проверки найден потенциальный строгий TypeScript-стык в `AdminBunkerDock`: raw Supabase client был приведён к явному `AdminRpcClient`. Исправлено.
- Найден флейк-risk в Bunker fake-timer test (`findBy*` при fake timers). Переведён на детерминированный `act + advanceTimersByTimeAsync`.
- Frontend reset parser не сохранял `mortalKombatReset` / `bunkerReset` из серверного ответа. Контракт обновлён и targeted test 6/6 PASS.
- GitHub Actions runs/check statuses не возвращаются доступным connector даже для ранее известных CI commit SHA, поэтому hosted GREEN пока не подтверждён.

## Решения перед мероприятием

- Получить один полный автоматический прогон `typecheck + Vitest + build + pgTAP + Playwright` в окружении с работающим runner/dependency install.
- После автоматического GREEN провести реальную репетицию минимум на двух ТВ/экранах и двух телефонах по `docs/event-day-checklist.md`.

## Финальное решение

**GO / NO-GO: НЕ ОПРЕДЕЛЕНО — targeted fresh-code verification PASS, полный suite и real-hardware rehearsal ещё обязательны.**
