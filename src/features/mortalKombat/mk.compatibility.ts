import { MK_MAX_PLAYERS } from './mk.types';

const LEGACY_MK_MAX_PLAYERS = 40;

export function isCompatibleMkPlayerLimit(value: unknown, activeCount: number): boolean {
  return value === MK_MAX_PLAYERS
    || (value === LEGACY_MK_MAX_PLAYERS && activeCount <= MK_MAX_PLAYERS);
}
