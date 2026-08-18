let protectedMode = false;
const listeners = new Set<(active: boolean) => void>();

export function getBunkerPresentationProtected(): boolean {
  return protectedMode;
}

export function setBunkerPresentationProtected(active: boolean): void {
  if (protectedMode === active) return;
  protectedMode = active;
  for (const listener of listeners) listener(active);
}

export function subscribeToBunkerPresentationProtection(
  listener: (active: boolean) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
