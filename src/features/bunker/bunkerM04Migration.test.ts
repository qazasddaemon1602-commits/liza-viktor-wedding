// @ts-expect-error Vitest runs this contract test in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const testRuntime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const migration = readFileSync(
  `${testRuntime.process.cwd()}/supabase/migrations/20260823034000_bunker_m04_item_transfer.sql`,
  'utf8',
);
const compatibilityMigrationName = '20260823034500_bunker_m04_transfer_compat.sql';
let compatibilityMigration = '';
try {
  compatibilityMigration = readFileSync(
    `${testRuntime.process.cwd()}/supabase/migrations/${compatibilityMigrationName}`,
    'utf8',
  );
} catch {
  // Kept empty so the missing forward migration is reported as a contract failure.
}
const abilityMigration = readFileSync(
  `${testRuntime.process.cwd()}/supabase/migrations/20260823035000_bunker_character_ability_action.sql`,
  'utf8',
);

describe('Bunker Mission 04 lot transfer migration', () => {
  it('publishes every available lot with a stable server id and its own quantity', () => {
    expect(migration).toMatch(/'lotId'\s*,\s*available\.id/i);
    expect(migration).toMatch(/order by available\.item_key,\s*available\.acquired_at,\s*available\.id/i);
    expect(migration).not.toMatch(/sum\s*\(\s*item\.quantity\s*\)/i);
  });

  it('selects the source by the submitted lot id and derives item metadata on the server', () => {
    expect(migration).toMatch(/p_payload->>'transferLotId'/i);
    expect(migration).toMatch(/item\.id\s*=\s*v_transfer_lot_id/i);
    expect(migration).not.toMatch(/item\.item_key\s*=\s*v_transfer_item_key/i);
    expect(migration).toMatch(/'transferItemKey'\s*,\s*v_source\.item_key/i);
    expect(migration).toMatch(/'transferQuantity'\s*,\s*v_source\.quantity/i);
  });

  it('ships a rerunnable forward compatibility migration in rollout order', () => {
    expect('20260823034000_bunker_m04_item_transfer.sql' < compatibilityMigrationName).toBe(true);
    expect(compatibilityMigrationName < '20260823035000_bunker_character_ability_action.sql').toBe(true);
    expect(compatibilityMigration).toMatch(
      /create\s+or\s+replace\s+function\s+public\.submit_guest_bunker_global_mission/i,
    );
    expect(compatibilityMigration).toMatch(
      /create\s+or\s+replace\s+function\s+public\._bunker_global_mission_action/i,
    );
    expect(compatibilityMigration).not.toMatch(/alter\s+function[\s\S]+rename\s+to/i);
    expect(abilityMigration).toMatch(
      /rename\s+to\s+_submit_guest_bunker_global_mission_before_ability_modifiers/i,
    );
    expect(abilityMigration).toMatch(
      /public\._submit_guest_bunker_global_mission_before_ability_modifiers\s*\(/i,
    );
  });

  it('prefers an exact lot id while safely resolving legacy item-key submissions', () => {
    expect(compatibilityMigration).toMatch(/p_payload->>'transferLotId'/i);
    expect(compatibilityMigration).toMatch(/p_payload->>'transferItemKey'/i);
    expect(compatibilityMigration).toMatch(/item\.id\s*=\s*v_transfer_lot_id/i);
    expect(compatibilityMigration).toMatch(
      /item\.item_key\s*=\s*v_transfer_item_key[\s\S]+order by item\.acquired_at,\s*item\.id[\s\S]+limit 1[\s\S]+for update/i,
    );
    expect(compatibilityMigration).toMatch(/invalid Mission 04 transfer item mismatch/i);
    expect(compatibilityMigration).toMatch(/'transferItemKey'\s*,\s*v_source\.item_key/i);
    expect(compatibilityMigration).toMatch(/'transferQuantity'\s*,\s*v_source\.quantity/i);
    expect(compatibilityMigration).not.toMatch(/p_payload->>'transferQuantity'/i);
    expect(compatibilityMigration).not.toMatch(/p_payload->>'transferItemLabel'/i);
  });
});
