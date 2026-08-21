# Лиза × Виктор — покрытие исходного сценария

Этот файл отвечает на один вопрос: **что из исходного плана второго дня уже реализовано в live-платформе, что проверено автоматикой, а что сознательно остаётся отдельным контентным этапом.**

## Основная live-платформа

| Исходная идея | Реализация | Статус |
|---|---|---|
| Регистрация гостя с телефона | `/join`, device binding, ticket `LV-xxx` | ГОТОВО |
| Автоматическое распределение по 5 вагонам | server RPC + event-row serialization | ГОТОВО |
| Фиксация текущего состава без закрытия регистрации | owner `ЗАФИКСИРОВАТЬ СОСТАВ` | ГОТОВО |
| Опоздавшие гости продолжают участвовать | регистрация открыта после lock/Premiere | ГОТОВО + E2E |
| Новый пассажир появляется на ТВ | projector screen event + cinematic train scene | ГОТОВО + E2E |
| Поезд должен быть именно поездом | locomotive/coaches/track/steam DOM/CSS scene | ГОТОВО |
| Несколько ТВ работают синхронно | Realtime + authoritative server state + heartbeat; 1 ТВ тоже валидно | ГОТОВО |
| Readiness ТВ/видео/звука | live telemetry, advisory only, не блокирует owner-команды | ГОТОВО |
| Вызвать конкретный вагон | carriage calls на телефоны + optional TV scene (~12 сек) | ГОТОВО |
| Квиз гостей | `/play`, owner activation/reveal, TV results | ГОТОВО |
| Приватные ответы Лизы/Виктора | tokenized couple preanswers + owner status | ГОТОВО ПО КОДУ; CONTENT PENDING |
| Final Five | отдельные role tokens `/liza`, `/viktor` + reveal | ГОТОВО |
| Mortal Kombat 16 игроков | 16 active + waitlist, draw, 15 matches | ГОТОВО |
| MK no-show / запасной | remove/promote/reseed | ГОТОВО |
| MK исправление результата | impact preview + explicit downstream clear/undo | ГОТОВО |
| MK на ТВ | shared `/screen` по owner-команде + dedicated `/mortal-kombat/screen` | ГОТОВО |
| Вернуть общий ТВ без остановки MK | `ВЕРНУТЬ ГЛАВНЫЙ ЭКРАН` | ГОТОВО |
| Премьера трека | owner control + advisory preflight + `/screen` protected mode | ГОТОВО ПО КОДУ; REAL VIDEO PENDING |
| Отсчёт перед премьерой | строго `10 → 1`, без 0, sound cues | ГОТОВО |
| Не ждать всех опоздавших перед премьерой | guest count advisory, manual owner start | ГОТОВО |
| Не ждать технический readiness перед ручным стартом | TV/video/audio status не входит в disabled/guard owner-команды | ГОТОВО |
| Поздний ТВ подхватывает текущую позицию | authoritative server position | ГОТОВО |
| Device-local звук ТВ | icon mute + slider 0–100, default 75%, localStorage | ГОТОВО |
| Единый mute/volume | UI cues + train/call + countdown + media + bunker alarm | ГОТОВО ПО КОДУ |
| Сюжетный поворот Бункер | emergency takeover + `30:00` | ГОТОВО |
| `00:00` Бункера не возвращает QR сам | hold until explicit STOP | ГОТОВО |
| Bunker выше Premiere/MK/quiz/train | protected hierarchy + underlying unmount | ГОТОВО + E2E |
| Репетиционный полный reset | owner-only `СБРОСИТЬ` | ГОТОВО + pgTAP |
| Не удалять ответы пары при reset | preserved couple preanswers | ГОТОВО ПО КОДУ |
| Удобно открыть все тестовые окна | `/admin` → `РЕПЕТИЦИЯ` panel | ГОТОВО |
| Админка с телефона | responsive 390px contract + touch layout | ГОТОВО АВТОМАТИЧЕСКИ; REAL PHONE PENDING |
| Главный экран на Full HD TV | 1920×1080 layout E2E | ГОТОВО АВТОМАТИЧЕСКИ; REAL TV PENDING |
| Пережить короткий обрыв сети | last-valid state + reconnect + polling fallbacks | ГОТОВО ПО КОДУ |
| Production-домен | `liza-viktor.site`, относительные routes, `/` → `/join` | ГОТОВО |

## Приоритет экранных сцен

Приоритет фиксирован и не должен меняться декоративным редизайном:

1. **Бункер**
2. **Premiere**
3. **Mortal Kombat**, только когда owner явно отдал ему общий TV
4. **Quiz / reveal**
5. **Carriage call / train arrival**
6. **Idle QR**

Новые визуальные эффекты должны жить **внутри своей сцены** и не создавать ещё один независимый fixed-overlay/state machine поверх этой иерархии.

## Что было в исходном «Последнем вагоне», но сознательно отложено

Этот слой обсуждался отдельно и был отмечен как **цифровой, но после основных функций**:

- случайная цифровая карточка/персонаж каждому гостю;
- скрытая часть карточки и поэтапное раскрытие;
- профессия/возраст/здоровье/хобби/фобия/особые свойства/инвентарь и т. п.;
- 100+ карточек с контролем повторов и баланса;
- командные задания каждого вагона;
- QR-точки и цепочка миссий;
- обмен ресурсами между вагонами;
- очки/рейтинг/штрафы/бонусы;
- общий финальный код/сборка результата;
- дополнительные сюжетные события/модификаторы.

### Почему это вынесено в следующий этап

Это отдельная игровая система с контентом и балансом. База live-события должна оставаться технически стабильной; карточки, новые задания и scoring подключаются следующим этапом поверх уже готовых гостей/вагонов, не смешиваясь с техническим hardening текущей версии.

## Что ещё требует EVENT-DAY проверки, но не является программным блокером

1. Заполнить реальные ответы Лизы и Виктора в production-базе, если они ещё не заполнены.
2. Проверить реальный production URL видео `КОЛЬЦО`, его `canplay` и аудиовыход на каждом фактически используемом ТВ.
3. Провести hardware rehearsal: owner phone + guest phone + фактическое количество TV/projector + venue Wi‑Fi + HDMI/audio output. Один ТВ является валидной конфигурацией; если используется несколько, отдельно проверить синхронизацию.
4. Проверить `https://liza-viktor.site` и QR из сети/устройств, которые реально будут использовать гости.
5. После завтрашних визуальных правок и добавления новых квестов повторить CI/pgTAP/E2E и короткий hardware rehearsal.

