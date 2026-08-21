type BunkerAudioArmer = () => Promise<boolean>;

let armer: BunkerAudioArmer | null = null;

export function registerBunkerPresentationAudioArmer(next: BunkerAudioArmer | null): void {
  armer = next;
}

export async function armBunkerPresentationAudio(): Promise<boolean> {
  if (!armer) return false;
  try {
    return await armer();
  } catch {
    return false;
  }
}
