import { useEffect, useRef } from 'react';

type PremierePlayerProps = {
  src: string;
  shouldPlay: boolean;
  onEnded?: () => void;
};

export function PremierePlayer({ src, shouldPlay, onEnded }: PremierePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playedSourceRef = useRef<string | null>(null);

  useEffect(() => {
    if (!shouldPlay) {
      playedSourceRef.current = null;
      return;
    }

    const video = videoRef.current;
    if (!video || playedSourceRef.current === src) return;

    playedSourceRef.current = src;
    void video.play().catch(() => {
      if (playedSourceRef.current === src) playedSourceRef.current = null;
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
