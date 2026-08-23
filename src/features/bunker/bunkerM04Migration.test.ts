// @ts-expect-error Vitest runs this contract test in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const testRuntime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const migration = readFileSync(
  `${testRuntime.process.cwd()}/supabase/migrations/20260823034000_bunker_m04_item_transfer.sql`,
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
});
