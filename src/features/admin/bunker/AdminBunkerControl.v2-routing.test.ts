import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./AdminBunkerControl.tsx', import.meta.url)),
  'utf8',
);

describe('AdminBunkerControl V2 routing release guard', () => {
  it('labels the Unknown Passenger stage explicitly', () => {
    expect(source).toContain("UNKNOWN_PASSENGER: 'НЕИЗВЕСТНЫЙ ПАССАЖИР'");
  });

  it('does not expose a generic FINAL_30 to BUNKER_OPEN transition in V2 controls', () => {
    const v2Map = source.slice(
      source.indexOf('const V2_GLOBAL_STATE_NEXT'),
      source.indexOf('class BunkerCommandFailure'),
    );
    expect(v2Map).not.toMatch(/FINAL_30\s*:\s*\{\s*state:\s*'BUNKER_OPEN'/);
    expect(v2Map).not.toContain('ОТКРЫТЬ БУНКЕР');
  });

  it('keeps the legacy V1 final transition available', () => {
    const legacyMap = source.slice(
      source.indexOf('const GLOBAL_STATE_NEXT'),
      source.indexOf('const V2_GLOBAL_STATE_NEXT'),
    );
    expect(legacyMap).toMatch(/FINAL_30\s*:\s*\{\s*state:\s*'BUNKER_OPEN'/);
  });
});
