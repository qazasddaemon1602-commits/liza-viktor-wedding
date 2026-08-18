import { describe, expect, it } from 'vitest';
import {
  getPremierePresenceSummary,
  recordPremiereScreenPresence,
  type PremiereScreenPresenceRecord,
} from './premierePresence';

const now = 1_000_000;

function record(
  screenId: string,
  patch: Partial<PremiereScreenPresenceRecord> = {},
): PremiereScreenPresenceRecord {
  return {
    screenId,
    videoReady: true,
    audioArmed: true,
    receivedAt: now,
    ...patch,
  };
}

describe('premiere screen presence summary', () => {
  it('counts two live TVs and reports both technical checks green', () => {
    const summary = getPremierePresenceSummary(
      [record('tv-1'), record('tv-2')],
      now + 5_000,
    );

    expect(summary).toEqual({
      connectedCount: 2,
      videoReadyCount: 2,
      audioArmedCount: 2,
      projectorConnected: true,
      videoReady: true,
      audioArmed: true,
    });
  });

  it('drops a screen automatically when its heartbeat is older than 15 seconds', () => {
    const summary = getPremierePresenceSummary(
      [
        record('tv-live', { receivedAt: now + 14_000 }),
        record('tv-stale', { receivedAt: now }),
      ],
      now + 15_001,
    );

    expect(summary.connectedCount).toBe(1);
    expect(summary.videoReadyCount).toBe(1);
  });

  it('requires every live display to have video and audio ready', () => {
    const summary = getPremierePresenceSummary(
      [
        record('tv-1'),
        record('tv-2', { videoReady: false, audioArmed: false }),
      ],
      now + 2_000,
    );

    expect(summary.connectedCount).toBe(2);
    expect(summary.videoReadyCount).toBe(1);
    expect(summary.audioArmedCount).toBe(1);
    expect(summary.videoReady).toBe(false);
    expect(summary.audioArmed).toBe(false);
  });

  it('is not technically green when there are no live displays', () => {
    const summary = getPremierePresenceSummary([], now);

    expect(summary.projectorConnected).toBe(false);
    expect(summary.videoReady).toBe(false);
    expect(summary.audioArmed).toBe(false);
  });

  it('upserts the latest heartbeat for one screen without duplicating it', () => {
    const first = recordPremiereScreenPresence([], {
      screenId: 'tv-1',
      videoReady: false,
      audioArmed: false,
    }, now);
    const second = recordPremiereScreenPresence(first, {
      screenId: 'tv-1',
      videoReady: true,
      audioArmed: true,
    }, now + 5_000);

    expect(second).toEqual([
      record('tv-1', { receivedAt: now + 5_000 }),
    ]);
  });
});
