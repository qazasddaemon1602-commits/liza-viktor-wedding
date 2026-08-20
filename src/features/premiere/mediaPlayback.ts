export type MediaPlaybackMode = 'audible' | 'muted';

function isAutoplayBlocked(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotAllowedError';
}

export async function playWithMutedFallback(
  media: HTMLMediaElement,
  onMutedFallback?: () => void,
): Promise<MediaPlaybackMode> {
  try {
    await media.play();
    return media.muted ? 'muted' : 'audible';
  } catch (error) {
    if (media.muted || !isAutoplayBlocked(error)) throw error;

    media.muted = true;
    onMutedFallback?.();
    await media.play();
    return 'muted';
  }
}
