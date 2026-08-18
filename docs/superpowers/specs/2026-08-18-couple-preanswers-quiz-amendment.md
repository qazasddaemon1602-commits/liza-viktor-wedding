# Amendment — joint pre-answers for quiz questions

Date: 2026-08-18
Applies to: `2026-08-18-wedding-celebration-hub-design.md`

## Goal

For quiz-style questions, Liza and Viktor jointly choose the official couple answer in advance. Guests then vote during the event without seeing that answer. After guest voting is closed, the projector reveals the guests' result first and then the couple's pre-recorded official answer.

This is separate from the special final-five live couple-reveal round, which may still use its own live mechanic.

## Couple pre-answer flow

1. Before the event, Liza and Viktor open one dedicated one-time private couple-answer link from either their Liza or Viktor access flow.
2. They complete the quiz together on one device/account/session.
3. They may move backward and change answers while the pre-answer form is still in draft state.
4. At the end they press a prominent confirmation action: `ЗАФИКСИРОВАТЬ ОТВЕТЫ`.
5. Show a hard confirmation warning that after submission answers cannot be changed and the private form cannot be reopened.
6. On confirmation, all quiz answers are written atomically and the answer set receives `locked_at` plus a permanent `locked` status.
7. The one-time couple-answer capability/token is marked consumed and disabled immediately.
8. Any later attempt to reopen the pre-answer route returns only a neutral locked screen such as `Ответы уже зафиксированы` with no answer values and no editing UI.

## Immutability rules

- Liza and Viktor cannot edit, replace, or resubmit any locked quiz answer.
- The browser UI is not the security boundary; database policies and/or RPC logic must reject updates after `locked_at` is set.
- The consumed one-time access token cannot be reused.
- Normal admin controls do not expose an `unlock` or `edit couple answers` action.
- If catastrophic recovery is ever required during development, it must be a direct owner-only maintenance action outside the normal event UI, not a production button.

## Admin visibility

The owner/admin sees only completion state before the event, for example:

- `Лиза и Виктор: ответы не заполнены`
- `Лиза и Виктор: 12 / 20`
- `Лиза и Виктор: ответы зафиксированы ✓`

The owner/admin should not need to see the actual locked answers in the normal admin interface before reveal. This preserves the surprise and avoids accidental disclosure.

## Live quiz reveal flow

For each quiz question:

1. Host activates the question.
2. Guests vote.
3. Projector shows participation only while voting is open.
4. Host closes voting / presses `ПОКАЗАТЬ РЕЗУЛЬТАТ`.
5. Projector first reveals guest distribution / selected answer.
6. After a short staged delay or a second host tap, projector reveals `ОТВЕТ ЛИЗЫ И ВИКТОРА`.
7. The system may then show a short verdict such as `Гости угадали` or `А вот и нет` when the question type supports a correct/incorrect comparison.

The couple's locked answer is never readable by guests before the reveal state for that question.

## Data model additions

### `couple_answer_sets`
- id
- event_id
- status (`draft`, `locked`)
- created_at
- locked_at
- submitted_via_role (`liza`, `viktor`)
- access_token_id / capability reference

One active answer set per event/quiz version.

### `couple_quiz_answers`
- id
- answer_set_id
- question_id
- answer_value
- created_at

Unique constraint: one answer per question per answer set.

### access state

The role/capability used for pre-answering needs a one-time purpose flag, for example `couple_preanswer`, with:
- consumed_at
- enabled

After locking the answer set, `consumed_at` is set and `enabled = false` in the same protected transaction/RPC.

## Security requirements

- Only Liza/Viktor private access may create or edit the draft pre-answer set.
- Only while status is `draft` may answers be changed.
- Lock operation must be atomic: validate completeness -> persist final answers -> set `locked_at` -> consume one-time capability.
- Locked answer rows cannot be updated or deleted by Liza, Viktor, guests, projector, or ordinary admin UI.
- Guest/projector read policies expose the official answer only when the current question reveal state explicitly allows it.
- Do not rely on obfuscated client payloads; hidden answers must not be selected from Supabase before reveal.

## UX notes

The pre-answer flow should feel intentional and private, not like an admin form. Suggested heading:

`ВАША ВЕРСИЯ`

Subcopy:

`Ответьте вместе. Эти ответы увидят гости только во время игры.`

Final confirmation:

`Зафиксировать ответы? После этого изменить их будет нельзя.`

Locked screen:

`ГОТОВО. ОТВЕТЫ ЗАФИКСИРОВАНЫ.`
`Увидимся на игре.`

## Testing additions

- draft answers can be edited before lock
- incomplete answer set cannot be locked when all required quiz questions are mandatory
- lock operation is atomic
- after lock, Liza cannot modify answers
- after lock, Viktor cannot modify answers
- consumed pre-answer token cannot reopen the form
- admin normal UI has no unlock/edit path
- guest/projector cannot read official answer before reveal
- official answer becomes readable only for the currently revealed question
- refresh/reconnect does not expose unrevealed answers
