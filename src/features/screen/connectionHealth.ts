export type ConnectionSource =
  | 'browser'
  | 'quiz'
  | 'couple'
  | 'finalFive'
  | 'premiere'
  | 'mortalKombat'
  | 'presence';

export function updateConnectionHealth(
  current: ReadonlySet<ConnectionSource>,
  source: ConnectionSource,
  healthy: boolean,
): ReadonlySet<ConnectionSource> {
  const isFailed = current.has(source);
  if ((healthy && !isFailed) || (!healthy && isFailed)) return current;

  const next = new Set(current);
  if (healthy) next.delete(source);
  else next.add(source);
  return next;
}

export function hasConnectionFailures(failures: ReadonlySet<ConnectionSource>): boolean {
  return failures.size > 0;
}
