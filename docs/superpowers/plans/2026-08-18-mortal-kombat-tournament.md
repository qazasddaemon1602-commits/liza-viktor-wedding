# Mortal Kombat Tournament Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 16-player Mortal Kombat tournament module using registered wedding guests, with guest signup/waitlist, owner-editable bracket, safe winner advancement/corrections, realtime public views and a readable projector champion flow.

**Architecture:** Tournament registration references the canonical `guests.id`; no duplicate player identity entry is required. Bracket structure is server-authoritative, while pure bracket calculations are implemented as tested TypeScript utilities mirrored by protected owner RPCs/transactions. Any correction to an upstream result computes and surfaces downstream impact before destructive clearing.

**Tech Stack:** React, TypeScript, Supabase PostgreSQL/Realtime, Vitest, Testing Library.

## Global Constraints

- Maximum active bracket size: 16 players.
- Tournament format: Round of 16 (8) -> Quarterfinals (4) -> Semifinals (2) -> Final (1) -> Champion.
- Only registered event guests can self-register for MK; each guest can occupy at most one active slot.
- After 16 active registrations, new signups go to a waitlist rather than silently failing.
- Late guests can join while registration is open; an already-started bracket never auto-inserts late guests.
- Only the single owner/admin can randomize, reorder, replace, edit, mark current match, record/undo/correct winners or reset bracket state.
- Guests/players can only view tournament state and their own signup status.
- Owner corrections must never silently corrupt completed downstream results.
- Projector uses focused current-round/match layouts when full bracket text would be too small.
- Mortal Kombat styling is a darker interpretation of the wedding palette, not unrelated neon arcade styling.

---

## File Structure

- `supabase/migrations/004_mortal_kombat.sql` — tournament, registrations, matches, RPCs/RLS.
- `supabase/tests/mortal_kombat.sql` — capacity/security/progression/correction tests.
- `src/features/mortalKombat/mk.types.ts` — tournament/player/match types.
- `src/features/mortalKombat/bracket.ts` — pure bracket generation/impact calculation.
- `src/features/mortalKombat/bracket.test.ts` — deterministic bracket tests.
- `src/features/mortalKombat/mk.service.ts` — guest/public tournament API.
- `src/features/mortalKombat/MortalKombatPage.tsx` — guest/public tournament page.
- `src/features/mortalKombat/MkSignupCard.tsx` — participate/waitlist UI.
- `src/features/mortalKombat/PublicBracket.tsx` — read-only bracket.
- `src/features/admin/mortalKombat/AdminMkControl.tsx` — owner tournament control.
- `src/features/admin/mortalKombat/PlayerPoolEditor.tsx` — reorder/swap/replace.
- `src/features/admin/mortalKombat/MatchEditor.tsx` — current match/winner/undo/correction.
- `src/features/admin/mortalKombat/CorrectionImpactDialog.tsx` — affected downstream warning.
- `src/features/screen/mortalKombat/MkRegistrationScreen.tsx` — `N / 16` state.
- `src/features/screen/mortalKombat/MkBracketScreen.tsx` — bracket/round view.
- `src/features/screen/mortalKombat/MkMatchScreen.tsx` — current fight spotlight.
- `src/features/screen/mortalKombat/MkChampionScreen.tsx` — champion reveal.

---

### Task 1: Define tournament schema and guest-linked registration/waitlist

**Files:**
- Create: `supabase/migrations/004_mortal_kombat.sql`
- Create: `supabase/tests/mortal_kombat.sql`
- Create: `src/features/mortalKombat/mk.types.ts`

**Interfaces:**
- Tables: `mk_tournaments`, `mk_registrations`, `mk_matches`.
- Registration states: `active`, `waitlist`, `withdrawn`.
- Tournament states: `registration`, `draw_ready`, `active`, `complete`.

- [ ] **Step 1: Write capacity and identity tests**

```sql
begin;
select plan(4);
select has_table('public', 'mk_registrations', 'registration table exists');
select has_table('public', 'mk_matches', 'matches table exists');
select col_is_unique('public', 'mk_registrations', ARRAY['tournament_id','guest_id'], 'guest enters tournament once');
select function_returns('public', 'join_mk_tournament', ARRAY['uuid','uuid'], 'jsonb', 'guest signup rpc exists');
select * from finish();
rollback;
```

Add behavioral tests that registrations 1–16 become `active`, number 17 becomes `waitlist`, and a duplicate guest cannot claim a second active slot.

- [ ] **Step 2: Run DB tests and verify failure**

Run: `supabase db reset && supabase test db`
Expected: FAIL.

- [ ] **Step 3: Implement schema/RPCs/RLS**

`mk_registrations` stores `guest_id`, a display-name snapshot for public bracket stability, `status`, `seed`, `registered_at`. Guest self-registration verifies the `guest_id` is bound to the requesting anonymous guest/session before allowing join.

Owner-only RPCs include `owner_open_mk_registration`, `owner_close_mk_registration`, `owner_promote_waitlist`, `owner_remove_mk_player`.

- [ ] **Step 4: Run DB tests**

Run: `supabase test db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase src/features/mortalKombat/mk.types.ts
git commit -m "feat: add guest-linked MK registration"
```

---

### Task 2: Implement deterministic 16-player bracket utilities

**Files:**
- Create: `src/features/mortalKombat/bracket.ts`
- Create: `src/features/mortalKombat/bracket.test.ts`

**Interfaces:**
- `buildBracket(playerIds: string[]): BracketMatch[]` requires exactly 16 players.
- `nextMatchSlot(match): { matchKey: string; slot: 'player1' | 'player2' } | null`.
- `affectedDownstreamMatches(matches, changedMatchKey): string[]`.

- [ ] **Step 1: Write bracket-generation tests**

```ts
it('builds 8 R16, 4 QF, 2 SF and 1 final matches', () => {
  const bracket = buildBracket(Array.from({ length: 16 }, (_, i) => `p${i + 1}`));
  expect(bracket.filter(m => m.round === 'r16')).toHaveLength(8);
  expect(bracket.filter(m => m.round === 'qf')).toHaveLength(4);
  expect(bracket.filter(m => m.round === 'sf')).toHaveLength(2);
  expect(bracket.filter(m => m.round === 'final')).toHaveLength(1);
});
```

```ts
it('maps r16 match 1 winner to qf match 1 player1', () => {
  expect(nextMatchSlot({ round: 'r16', position: 1 })).toEqual({ matchKey: 'qf-1', slot: 'player1' });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/mortalKombat/bracket.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement pure bracket functions**

Use fixed match keys `r16-1..8`, `qf-1..4`, `sf-1..2`, `final-1`. Map adjacent upstream matches to the same downstream match and alternating slots.

- [ ] **Step 4: Add impact-chain tests**

A change in `r16-1` affects `qf-1`, `sf-1`, `final-1`; a change in `qf-4` affects `sf-2`, `final-1`; unrelated branches are not returned.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/features/mortalKombat/bracket.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/mortalKombat/bracket*
git commit -m "feat: add deterministic MK bracket model"
```

---

### Task 3: Build guest tournament signup/status and public bracket page

**Files:**
- Create: `src/features/mortalKombat/mk.service.ts`
- Create: `src/features/mortalKombat/MortalKombatPage.tsx`
- Create: `src/features/mortalKombat/MortalKombatPage.test.tsx`
- Create: `src/features/mortalKombat/MkSignupCard.tsx`
- Create: `src/features/mortalKombat/PublicBracket.tsx`
- Modify: `src/features/guest/GuestHubPage.tsx`
- Modify: `src/app/routes.tsx`

**Interfaces:**
- Registered guest action: `УЧАСТВОВАТЬ В MORTAL KOMBAT`.
- Public tournament view exposes display names, bracket and current match; never exposes private affiliation metadata.

- [ ] **Step 1: Write signup UI tests**

```tsx
it('does not ask a registered guest to enter their name again', () => {
  render(<MkSignupCard guest={guest} status="open" />);
  expect(screen.getByRole('button', { name: /участвовать в mortal kombat/i })).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/mortalKombat/MortalKombatPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement signup/waitlist status**

Show active slot as `ВЫ В ТУРНИРЕ · 9 / 16`, waitlist as `ЛИСТ ОЖИДАНИЯ`, closed/started as read-only status. Guest hub reflects the same state.

- [ ] **Step 4: Implement realtime public bracket**

Subscribe to safe tournament/match projection and render current/next fight, round and bracket progress. Late registration after tournament start cannot mutate bracket automatically.

- [ ] **Step 5: Run tests/typecheck**

Run: `npm run typecheck && npm test -- src/features/mortalKombat`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/mortalKombat src/features/guest src/app/routes.tsx
git commit -m "feat: add guest MK tournament experience"
```

---

### Task 4: Create owner draw/reorder/swap/replace controls

**Files:**
- Create: `src/features/admin/mortalKombat/AdminMkControl.tsx`
- Create: `src/features/admin/mortalKombat/AdminMkControl.test.tsx`
- Create: `src/features/admin/mortalKombat/PlayerPoolEditor.tsx`
- Modify: `supabase/migrations/004_mortal_kombat.sql`
- Modify: `supabase/tests/mortal_kombat.sql`

**Interfaces:**
- Owner actions: randomize initial 16, manually reorder seeds, swap two R16 players, replace no-show, edit display snapshot, lock/start bracket.

- [ ] **Step 1: Write owner/non-owner mutation tests**

DB tests must assert owner swap succeeds and anonymous/Liza/Viktor calls to the same RPC are rejected.

```tsx
it('shows all 16 seed positions before bracket start', () => {
  render(<PlayerPoolEditor registrations={sixteenPlayers} />);
  expect(screen.getAllByTestId('seed-slot')).toHaveLength(16);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/admin/mortalKombat && supabase test db`
Expected: FAIL.

- [ ] **Step 3: Implement owner draw transaction**

`owner_finalize_mk_draw` requires exactly 16 active registrations, writes all 15 match rows in one transaction using tested bracket mapping, sets tournament `active`, and records owner action log.

- [ ] **Step 4: Implement reorder/swap/replace UI before start**

Provide explicit swap/select interactions optimized for phone use rather than drag-only behavior. Replacing a guest preserves the bracket position but updates `guest_id` and display snapshot.

- [ ] **Step 5: Run tests**

Run: `npm run typecheck && npm test -- src/features/admin/mortalKombat && supabase test db`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/admin/mortalKombat supabase
git commit -m "feat: add owner MK bracket setup"
```

---

### Task 5: Implement match winner advancement, undo and safe upstream corrections

**Files:**
- Create: `src/features/admin/mortalKombat/MatchEditor.tsx`
- Create: `src/features/admin/mortalKombat/MatchEditor.test.tsx`
- Create: `src/features/admin/mortalKombat/CorrectionImpactDialog.tsx`
- Create: `src/features/admin/mortalKombat/CorrectionImpactDialog.test.tsx`
- Modify: `supabase/migrations/004_mortal_kombat.sql`
- Modify: `supabase/tests/mortal_kombat.sql`

**Interfaces:**
- `owner_set_current_match(matchId)`.
- `owner_record_mk_winner(matchId, winnerGuestId, clearCompletedDownstream boolean)`.
- `owner_undo_mk_result(matchId, clearCompletedDownstream boolean)`.
- Server returns `affected_matches` before destructive correction when downstream results exist.

- [ ] **Step 1: Write progression tests**

DB tests: selecting R16 winner advances to the correct QF slot; loser becomes eliminated only when appropriate; winner of final becomes champion; champion cannot exist before valid final result.

- [ ] **Step 2: Write correction-impact UI test**

```tsx
it('names completed downstream matches before destructive correction', () => {
  render(<CorrectionImpactDialog affected={['1/4 №1', '1/2 №1']} completed={['1/4 №1']} />);
  expect(screen.getByText(/изменение затронет/i)).toBeInTheDocument();
  expect(screen.getByText('1/4 №1')).toBeInTheDocument();
});
```

- [ ] **Step 3: Run and verify failure**

Run: `npm test -- src/features/admin/mortalKombat && supabase test db`
Expected: FAIL.

- [ ] **Step 4: Implement transactional result mutation**

For unplayed downstream slots, recompute automatically. If a downstream match has a recorded winner, return impact information without mutating until owner explicitly confirms clearing/rebuilding. Never alter an unrelated bracket branch.

- [ ] **Step 5: Implement owner match UI**

Current match card has two large player buttons; tapping winner requires concise confirmation, then realtime updates. Provide `ОТМЕНИТЬ РЕЗУЛЬТАТ` and correction path with affected-match warning.

- [ ] **Step 6: Run tests**

Run: `npm run typecheck && npm test -- src/features/admin/mortalKombat && supabase test db`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/admin/mortalKombat supabase
git commit -m "feat: add safe MK result progression and correction"
```

---

### Task 6: Build projector registration/bracket/fight/champion scenes and event moments

**Files:**
- Create: `src/features/screen/mortalKombat/MkRegistrationScreen.tsx`
- Create: `src/features/screen/mortalKombat/MkBracketScreen.tsx`
- Create: `src/features/screen/mortalKombat/MkMatchScreen.tsx`
- Create: `src/features/screen/mortalKombat/MkChampionScreen.tsx`
- Create: `src/features/screen/mortalKombat/mkScreen.test.tsx`
- Modify: `src/features/screen/ScreenPage.tsx`
- Modify: `src/features/screen/screen.types.ts`

**Interfaces:**
- Screen modes consume safe tournament projection.
- Owner actions include `ВЫВЕСТИ СЕТКУ`, `ВЫВЕСТИ БОЙ`; champion state can be triggered automatically after final or manually replayed.

- [ ] **Step 1: Write projector readability/state tests**

```tsx
it('shows current fight as the dominant content', () => {
  render(<MkMatchScreen match={fixtureMatch} round="1/4 ФИНАЛА" />);
  expect(screen.getByRole('heading', { name: /сергей.*максим/i })).toBeInTheDocument();
  expect(screen.getByText('1/4 ФИНАЛА')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/screen/mortalKombat`
Expected: FAIL.

- [ ] **Step 3: Implement focused projector layouts**

Registration: `12 / 16 ИГРОКОВ`. Bracket reveal: legible round columns/focused round. Match spotlight: both names, carriage badges optional, current round. Champion: distinct full-screen `ЧЕМПИОН` moment using restrained wine accent.

- [ ] **Step 4: Emit screen-event moments**

Queue events for 8/12/16 registrations, draw complete, match winner, semifinalists, finalists and champion. Major champion scene may hold 6–10 seconds; do not interrupt premiere protected states.

- [ ] **Step 5: Run complete MK suite**

Run: `npm run typecheck && npm test -- src/features/mortalKombat src/features/admin/mortalKombat src/features/screen/mortalKombat && supabase test db`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/screen/mortalKombat src/features/screen
git commit -m "feat: add MK projector presentation"
```

---

## Self-Review

- Spec coverage: registered-guest signup, 16-player limit, waitlist, random/manual setup, full owner correction authority, winner advancement, downstream impact warning, current match, public bracket, late-arrival rules and champion reveal all map to tasks.
- Placeholder scan: no undefined bracket logic or generic correction instruction remains.
- Type consistency: fixed match keys and round names are used by both pure utilities and server records.
- Security: all bracket mutations are owner RPCs; public clients receive read-only projections only.
