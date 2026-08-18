import type { PremiereScreenPresence } from './premierePresence.realtime';

export const PREMIERE_SCREEN_PRESENCE_TTL_MS = 15_000;

export type PremiereScreenPresenceRecord = PremiereScreenPresence & {
  receivedAt: number;
};

export type PremierePresenceSummary = {
  connectedCount: number;
  videoReadyCount: number;
  audioArmedCount: number;
  projectorConnected: boolean;
  videoReady: boolean;
  audioArmed: boolean;
};

export function recordPremiereScreenPresence(
  records: PremiereScreenPresenceRecord[],
  presence: PremiereScreenPresence,
  receivedAt: number,
): PremiereScreenPresenceRecord[] {
  const next: PremiereScreenPresenceRecord = {
    ...presence,
    receivedAt,
  };
  const index = records.findIndex((record) => record.screenId === presence.screenId);
  if (index < 0) return [...records, next];

  return records.map((record, recordIndex) => recordIndex === index ? next : record);
}

export function getPremierePresenceSummary(
  records: PremiereScreenPresenceRecord[],
  nowMs: number,
  ttlMs = PREMIERE_SCREEN_PRESENCE_TTL_MS,
): PremierePresenceSummary {
  const active = records.filter((record) => {
    const age = nowMs - record.receivedAt;
    return age >= 0 && age <= ttlMs;
  });
  const connectedCount = active.length;
  const videoReadyCount = active.filter((record) => record.videoReady).length;
  const audioArmedCount = active.filter((record) => record.audioArmed).length;

  return {
    connectedCount,
    videoReadyCount,
    audioArmedCount,
    projectorConnected: connectedCount > 0,
    videoReady: connectedCount > 0 && videoReadyCount === connectedCount,
    audioArmed: connectedCount > 0 && audioArmedCount === connectedCount,
  };
}
