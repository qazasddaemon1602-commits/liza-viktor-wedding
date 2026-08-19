import { useEffect, useRef, useState } from 'react';
import { needsPremiereMediaResolution, resolvePremiereMediaUrl } from './premiereMedia';

type PremierePlayerProps = {
  src: string;
  shouldPlay: boolean;
  positionSeconds?: number;
  onReady?: () => void;
  onEnded?: () => void;
};

export function PremierePlayer({
  src,
  shouldPlay,
  positionSeconds,
  onReady,
  onEnded,
}: PremierePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playedSourceRef = useRef<string | null>(null);
  const wasPlayingRef = useRef(false);
  const [playableSrc, setPlayableSrc] = useState(() => (
    needsPremiereMediaResolution(src) ? '' : src
  ));

  useEffect(() => {
    let active = true;
    playedSourceRef.current = null;
    wasPlayingRef.current = false;

    if (!needsPremiereMediaResolution(src)) {
      setPlayableSrc(src);
      return () => {
        active = false;
      };
    }

    setPlayableSrc('');
    void resolvePremiereMediaUrl(src)
      .then((resolved) => {
        if (active) setPlayableSrc(resolved);
      })
      .catch(() => {
        // Preserve the previous behavior as a last-resort fallback. A later
        // remount/reconnect will request a fresh direct URL again.
        if (active) setPlayableSrc(src);
      });

    return () => {
      active = false;
    };
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (
      !video
      || !playableSrc
      || positionSeconds === undefined
      || !Number.isFinite(positionSeconds)
      || positionSeconds < 0
    ) {
      return;
    }

    if (Math.abs(video.currentTime - positionSeconds) > 0.75) {
      video.currentTime = positionSeconds;
    }
  }, [positionSeconds, playableSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playableSrc) return;

    if (!shouldPlay) {
      if (wasPlayingRef.current) {
        video.pause();
        wasPlayingRef.current = false;
      }
      playedSourceRef.current = null;
      return;
    }

    if (playedSourceRef.current === playableSrc) return;

    playedSourceRef.current = playableSrc;
    wasPlayingRef.current = true;
    void video.play().catch(() => {
      if (playedSourceRef.current === playableSrc) playedSourceRef.current = null;
      wasPlayingRef.current = false;
    });
  }, [shouldPlay, playableSrc]);

  return (
    <video
      ref={videoRef}
      className="premiere-player"
      src={playableSrc || undefined}
      preload="auto"
      playsInline
      controls={false}
      onCanPlay={onReady}
      onEnded={onEnded}
    />
  );
}
