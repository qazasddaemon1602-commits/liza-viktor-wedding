import Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';
import { siteAudio } from '../../lib/siteAudio';
import { needsPremiereMediaResolution, resolvePremiereMediaUrl } from './premiereMedia';

type PremierePlayerProps = {
  src: string;
  shouldPlay: boolean;
  positionSeconds?: number;
  muted?: boolean;
  onReady?: () => void;
  onEnded?: () => void;
};

function isHlsSource(value: string) {
  try {
    return new URL(value, window.location.origin).pathname.toLowerCase().endsWith('.m3u8');
  } catch {
    return /\.m3u8(?:$|[?#])/i.test(value);
  }
}

export function PremierePlayer({
  src,
  shouldPlay,
  positionSeconds,
  muted = false,
  onReady,
  onEnded,
}: PremierePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playedSourceRef = useRef<string | null>(null);
  const wasPlayingRef = useRef(false);
  const [sourceReadyVersion, setSourceReadyVersion] = useState(0);
  const [audioSettings, setAudioSettings] = useState(() => siteAudio.getSettings());
  const [playableSrc, setPlayableSrc] = useState(() => (
    needsPremiereMediaResolution(src) ? '' : src
  ));

  useEffect(() => siteAudio.subscribe(setAudioSettings), []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = audioSettings.volume;
  }, [audioSettings.volume]);

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
    if (!video) return;

    hlsRef.current?.destroy();
    hlsRef.current = null;
    playedSourceRef.current = null;
    wasPlayingRef.current = false;
    video.pause();
    video.removeAttribute('src');
    video.load();

    if (!playableSrc) return;

    if (isHlsSource(playableSrc)) {
      const nativeManagedHls = (
        video.canPlayType('application/vnd.apple.mpegurl')
        && 'ManagedMediaSource' in window
      );

      if (!nativeManagedHls && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          startLevel: -1,
        });
        hlsRef.current = hls;
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          hls.loadSource(playableSrc);
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setSourceReadyVersion((version) => version + 1);
        });
        hls.attachMedia(video);

        return () => {
          hls.destroy();
          if (hlsRef.current === hls) hlsRef.current = null;
        };
      }
    }

    video.src = playableSrc;
    video.load();
    setSourceReadyVersion((version) => version + 1);
  }, [playableSrc]);

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
      try {
        video.currentTime = positionSeconds;
      } catch {
        // Some media engines reject seeking until metadata is ready. The same
        // effect runs again after the HLS manifest/source becomes ready.
      }
    }
  }, [positionSeconds, playableSrc, sourceReadyVersion]);

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

    if (playedSourceRef.current === playableSrc && !video.paused) return;

    playedSourceRef.current = playableSrc;
    wasPlayingRef.current = true;
    void video.play().catch(() => {
      if (playedSourceRef.current === playableSrc) playedSourceRef.current = null;
      wasPlayingRef.current = false;
    });
  }, [shouldPlay, playableSrc, sourceReadyVersion]);

  const deviceMuted = muted || !audioSettings.enabled || audioSettings.volume <= 0;

  return (
    <video
      ref={videoRef}
      className="premiere-player"
      preload="auto"
      playsInline
      muted={deviceMuted}
      controls={false}
      onCanPlay={onReady}
      onEnded={onEnded}
    />
  );
}
