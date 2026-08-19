export type MediaPlaybackMode = 'audible' | 'muted';

export async function playWithMutedFallback(
  media: HTMLMediaElement,
  onMutedFallback?: () => void,
): Promise<MediaPlaybackMode> {
  try {
    await media.play();
    return media.muted ? 'muted' : 'audible';
  } catch (error) {
    if (media.muted) throw error;

    media.muted = true;
    onMutedFallback?.();
    await media.play();
    return 'muted';
  }
}
