# Bunker V2 Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать безопасный authoritative-фундамент V2: канонический пул, frozen plan, state machine, mission instances, команды, receipts, events и совместимость с legacy-run.

**Architecture:** V2 определяется `contract_version=2` в `bunker_game_runs`; новые нормализованные проекции обслуживаются только узкими RPC. Старые runs продолжают использовать legacy read path, без dual-write. TypeScript получает отдельный `src/features/bunker/v2` boundary и строгие parsers.

**Tech Stack:** PostgreSQL/Supabase migrations + pgTAP, React 19, TypeScript 7, Supabase JS 2.111, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-08-21-bunker-connected-game-v2-design.md`

## Global Constraints

- Поддержка ровно 15–40 гостей и 2–5 вагонов.
- Реальное имя приходит только из `guests`; каталог персонажей не содержит имени.
- До 36 профили уникальны; для 37–40 частота profile key не выше двух и дубли разводятся по вагонам.
- `STORY_BUNKER` допустим только V1, `UNKNOWN_PASSENGER` — V2; transitional DB constraint допускает оба.
- Любая команда идемпотентна по `(run_nonce, actor_kind, actor_id, command_id)`.
- Прямой доступ к игровым таблицам отозван; RLS включён; `SECURITY DEFINER` использует `search_path=''`.
- Новую миграцию создавать только командой `supabase migration new`, затем редактировать напечатанный CLI путь.
- Никакого deploy/push до полного release gate.

---

### Task 1: Канонический каталог и controlled random

**Files:**
- Create: `src/features/bunker/v2/characterCatalog.ts`
- Create: `src/features/bunker/v2/characterCatalog.test.ts`
- Create: `src/features/bunker/v2/characterCatalog.expected.ts`
- Modify: `src/features/bunker/characterPool.ts`
- Modify: `src/features/bunker/characterAssignment.ts`
- Modify: `src/features/bunker/characterAssignment.test.ts`

**Interfaces:**
- Consumes: утверждённые 36 профилей из spec §5.
- Produces: `CHARACTER_CATALOG_VERSION`, `BUNKER_CHARACTER_CATALOG`, `assignV2Characters(guestIds, wagonByGuest, runNonce)`.

- [ ] **Step 1: Write the failing full-fixture test**

```ts
import { EXPECTED_CHARACTER_CATALOG } from './characterCatalog.expected';

expect(BUNKER_CHARACTER_CATALOG).toEqual(EXPECTED_CHARACTER_CATALOG);
expect(new Set(BUNKER_CHARACTER_CATALOG.map((profile) => profile.key)).size).toBe(36);
expect(BUNKER_CHARACTER_CATALOG.every((profile) => !('name' in profile))).toBe(true);
```

`characterCatalog.expected.ts` is an independent literal fixture, not an import/re-export from production. Transcribe all existing profile fields, then apply the approved corrections: remove extra tags from diplomat/logistician/chemist/biologist/builder; preserve «между вагонами» for `trade_bonus`, «есть возможность сохранить» for `resource_save`, «сюжетное препятствие» for `physical_task`, and the `+1 сообщение` meaning for `extra_message`.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/features/bunker/v2/characterCatalog.test.ts`  
Expected: FAIL because `characterCatalog.ts` does not exist.

- [ ] **Step 3: Implement the immutable catalog and explicit categories**

```ts
export const CHARACTER_CATALOG_VERSION = 2 as const;
export const CHARACTER_CATEGORY_KEYS = {
  technical: ['power_engineer', 'electrician', 'mechanic', 'military_engineer'],
  medical: ['surgeon', 'paramedic'],
  information: ['cybersecurity_specialist', 'programmer', 'student'],
  communication: ['signal_operator', 'radio_amateur', 'diplomat', 'psychologist'],
  bunker: ['unemployed', 'architect', 'security_guard', 'journalist', 'military_engineer'],
  navigation: ['geologist', 'cartographer', 'train_driver', 'driver'],
  analytical: ['cartographer', 'cybersecurity_specialist', 'lawyer', 'journalist', 'teacher', 'astronomer'],
} as const;
```

- [ ] **Step 4: Add N=15…40 deterministic assignment tests**

```ts
for (let count = 15; count <= 40; count += 1) {
  const result = assignV2Characters(guestIds(count), balancedWagons(count), 'run-seed');
  expect(result).toHaveLength(count);
  expect(new Set(result.slice(0, Math.min(count, 36)).map((x) => x.profileKey)).size)
    .toBe(Math.min(count, 36));
  expect(Math.max(...frequencies(result))).toBeLessThanOrEqual(2);
}
```

- [ ] **Step 5: Implement quota tiers and wagon-separated repeats**

Implement exact tier table from spec §5.1. Use a seeded Fisher–Yates shuffle. For N>36, choose N−36 different repeat keys and reject a placement that puts both copies in one wagon when another repeat candidate can satisfy the category coverage.

- [ ] **Step 6: Run GREEN and commit**

Run: `npm test -- src/features/bunker/v2/characterCatalog.test.ts src/features/bunker/characterAssignment.test.ts src/features/bunker/characterPool.test.ts`  
Expected: PASS.  
Commit: `git commit -m "feat: canonize bunker v2 characters"`

### Task 2: V2 schema, frozen plan and state machine

**Files:**
- Create via CLI: migration printed by `npx supabase migration new bunker_v2_contracts`
- Create: `supabase/tests/bunker_v2_contracts.sql`
- Modify: `supabase/tests/release_function_privilege_hardening.sql`

**Interfaces:**
- Consumes: existing `bunker_state`, `bunker_game_runs`, guest/profile/inventory/archive tables.
- Produces: `contract_version`, V2 tables, `_bunker_v2_plan`, owner prepare/transition RPCs.

- [ ] **Step 1: Write failing pgTAP contracts**

```sql
select has_table('public', 'bunker_mission_instances');
select has_table('public', 'bunker_command_receipts');
select function_returns('public', 'owner_prepare_bunker_v2', array['uuid','uuid'], 'jsonb');
select throws_ok(
  $$ select public.owner_transition_bunker_v2(:'event_id', 'MISSION_03', gen_random_uuid()) $$,
  '55000'
);
```

Include assertions that both `STORY_BUNKER` and `UNKNOWN_PASSENGER` satisfy the transitional constraint, but V2 transition rejects `STORY_BUNKER`.

- [ ] **Step 2: Run RED**

Run: `npx supabase test db supabase/tests/bunker_v2_contracts.sql`  
Expected: FAIL on missing tables/functions. If local Docker is unavailable, preserve RED evidence and run the static SQL contract test used by the repo.

- [ ] **Step 3: Generate migration and create normalized tables**

Run: `npx supabase migration new bunker_v2_contracts`.

The migration creates:

```sql
alter table public.bunker_game_runs
  add column if not exists contract_version integer not null default 1,
  add column if not exists plan_version integer;

create table public.bunker_mission_instances (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  run_nonce uuid not null,
  mission_code text not null,
  scope_kind text not null check (scope_kind in ('wagon','group','global')),
  scope_key text not null,
  status text not null,
  instance_version integer not null default 1,
  definition jsonb not null,
  outcome jsonb,
  started_at timestamptz,
  deadline_at timestamptz,
  completed_at timestamptz,
  unique (run_nonce, mission_code, scope_key)
);
```

Create the six remaining projection tables exactly as spec §7, with FKs to `(event_id, run_nonce)`, checks, indexes, RLS and revoke-all.

- [ ] **Step 4: Implement frozen V2 plan and prepare**

`owner_prepare_bunker_v2(event_id, command_id)` locks the event/state, validates owner and 15–40 guests/2–5 enabled wagons, creates the immutable V2 plan, assignments and mission instances, then writes receipt/event. It never calls `_refresh_bunker_run_guest_plan`.

- [ ] **Step 5: Implement V2 transition**

```sql
case v_current
  when 'LOBBY' then v_expected := 'CHARACTERS_READY';
  when 'MISSION_06' then v_expected := 'UNKNOWN_PASSENGER';
  when 'UNKNOWN_PASSENGER' then v_expected := 'BREAK_BEFORE_FINAL';
  when 'BUNKER_OPEN' then v_expected := 'FINISHED';
  else -- exhaustive mapping from spec §6
end case;
```

The RPC returns the stored receipt on exact retry and raises `idempotency_conflict` when the hash differs.

- [ ] **Step 6: Harden and verify SQL**

Every V2 table: RLS enabled, direct grants revoked. Every definer function: `set search_path = ''`, owner/device authorization, explicit grants. Extend the hardening pgTAP test with every new signature.

- [ ] **Step 7: Run GREEN and commit**

Run: `npx supabase test db supabase/tests/bunker_v2_contracts.sql supabase/tests/release_function_privilege_hardening.sql`  
Expected: PASS.  
Commit: `git commit -m "feat: add bunker v2 runtime contracts"`

### Task 3: Strict TypeScript V2 boundary

**Files:**
- Create: `src/features/bunker/v2/contracts.ts`
- Create: `src/features/bunker/v2/contracts.test.ts`
- Create: `src/features/bunker/v2/command.service.ts`
- Create: `src/features/bunker/v2/command.service.test.ts`
- Create: `src/features/bunker/v2/runtime.service.ts`
- Create: `src/features/bunker/v2/runtime.service.test.ts`
- Modify: `src/features/bunker/bunkerSession.service.ts`

**Interfaces:**
- Consumes: V2 RPC JSON.
- Produces: `BunkerV2State`, `BunkerV2Runtime`, `submitBunkerCommand`, `getGuestBunkerV2Runtime`, `getOwnerBunkerV2Runtime`.

- [ ] **Step 1: Write parser RED tests**

```ts
expect(parseBunkerV2State({ contractVersion: 2, state: 'UNKNOWN_PASSENGER' }).state)
  .toBe('UNKNOWN_PASSENGER');
expect(() => parseBunkerV2State({ contractVersion: 2, state: 'STORY_BUNKER' })).toThrow();
expect(() => parseBunkerV2Runtime({ hiddenTrait: 'leak' })).toThrow();
```

- [ ] **Step 2: Implement exact unions and parsers**

```ts
export type BunkerV2GlobalState =
  | 'LOBBY' | 'CHARACTERS_READY' | 'MISSION_01' | 'BREAK'
  | 'MISSION_02' | 'MISSION_03' | 'MISSION_04' | 'MISSION_05'
  | 'MISSION_06' | 'UNKNOWN_PASSENGER' | 'BREAK_BEFORE_FINAL'
  | 'FINAL_30' | 'BUNKER_OPEN' | 'FINISHED';

export type BunkerCommand =
  | { type: 'mission_confirm'; payload: { instanceId: string; instanceVersion: number; selection: string[] } }
  | { type: 'use_ability'; payload: { instanceId: string; problemKey: string } }
  | { type: 'request_access'; payload: { coordinates: string; sector: string; accessCode: string; gateTime: string; password: string } };
```

Define every command variant from spec §8; reject unknown and extra keys.

- [ ] **Step 3: Implement command transport and receipt behavior**

```ts
export async function submitBunkerCommand(
  client: BunkerV2RpcClient,
  eventSlug: string,
  deviceKey: string,
  commandId: string,
  command: BunkerCommand,
): Promise<BunkerCommandReceipt>;
```

Map only to `submit_bunker_command`; do not send guest/carriage/run IDs.

- [ ] **Step 4: Implement contract-version read branching**

`getGuestBunkerV2Runtime` parses V2 only. Existing orchestration first reads `contractVersion`: 1 goes to legacy parser, 2 goes to V2 parser. No shared `any` or raw JSON escapes.

- [ ] **Step 5: Run GREEN, typecheck and commit**

Run: `npm test -- src/features/bunker/v2 src/features/bunker/bunkerSession.service.test.ts && npm run typecheck`  
Expected: PASS.  
Commit: `git commit -m "feat: add strict bunker v2 client contracts"`

### Task 4: Late guests, reset and security regression

**Files:**
- Create via CLI: migration printed by `npx supabase migration new bunker_v2_late_reset`
- Create: `supabase/tests/bunker_v2_late_reset.sql`
- Modify: `supabase/tests/reset.sql`
- Modify: `src/features/bunker/useGuestBunkerLiveState.test.ts`

**Interfaces:**
- Consumes: V2 plan, existing registration and reset RPC.
- Produces: idempotent late-profile creation and V2-only reset cleanup.

- [ ] **Step 1: Write RED tests for guest registered before/during/after M01**

```sql
select is((runtime->'character'->>'m01Eligibility'), 'late_joiner');
select is((runtime->'character'->>'status'), 'saved');
select is((run_plan->>'guestCount')::int, :original_guest_count);
select is((select count(*) from public.bunker_mission_members where run_nonce=:'run_nonce'), :original_member_count);
```

- [ ] **Step 2: Implement late guest policy without plan refresh**

Lock event/run and create one saved profile snapshot. Do not change M01 members/quota, M04 operators, M06 voters or bonus plan. Permit abilities only in incomplete future/current instances.

- [ ] **Step 3: Extend reset**

Delete V2 projections by run in FK-safe order, preserve guests, bindings, carriages, couple preanswers and all non-Bunker wedding configuration.

- [ ] **Step 4: Verify RLS/reset/reconnect and commit**

Run: `npx supabase test db supabase/tests/bunker_v2_late_reset.sql supabase/tests/reset.sql`  
Run: `npm test -- src/features/bunker/useGuestBunkerLiveState.test.ts`  
Expected: PASS.  
Commit: `git commit -m "feat: support bunker v2 late guests and reset"`

### Task 5: Package gate

**Files:**
- Modify: `docs/superpowers/plans/2026-08-21-bunker-v2-contracts.md` only to check completed boxes during execution.

- [x] **Step 1: Run focused gates**

Run: `npm test -- src/features/bunker/v2 src/features/bunker/characterAssignment.test.ts src/features/bunker/characterPool.test.ts src/features/bunker/bunkerSession.service.test.ts src/features/bunker/useGuestBunkerLiveState.test.ts`  
Expected: PASS.

- [x] **Step 2: Run global static gates**

Run: `npm run typecheck && npm run build && git diff --check`  
Expected: PASS; only existing Vite chunk advisory is allowed.

- [x] **Step 3: Request two-stage review and commit plan progress**

First reviewer checks spec compliance; second reviewer checks code quality/security. Fix findings through the original implementer, rerun gates, then commit: `chore: verify bunker v2 contracts`.

Execution note: all JavaScript/TypeScript/build/static-security gates and both review stages passed. PostgreSQL/pgTAP runtime remains an explicit pre-release gate because the local Supabase database was unavailable at `127.0.0.1:54322`.
