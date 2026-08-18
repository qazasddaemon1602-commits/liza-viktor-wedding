import { useEffect, useRef } from 'react';

type PremierePlayerProps = {
  src: string;
  shouldPlay: boolean;
  onEnded?: () => void;
};

export function PremierePlayer({ src, shouldPlay, onEnded }: PremierePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playedSourceRef = useRef<string | null>(null);
  const wasPlayingRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!shouldPlay) {
      if (wasPlayingRef.current) {
        video.pause();
        wasPlayingRef.current = false;
      }
      playedSourceRef.current = null;
      return;
    }

    if (playedSourceRef.current === src) return;

    playedSourceRef.current = src;
    wasPlayingRef.current = true;
    void video.play().catch(() => {
      if (playedSourceRef.current === src) playedSourceRef.current = null;
      wasPlayingRef.current = false;
    });
  }, [shouldPlay, src]);

  return (
    <video
      ref={videoRef}
      className="premiere-player"
      src={src}
      preload="auto"
      playsInline
      controls={false}
      onEnded={onEnded}
    />
  );
}
