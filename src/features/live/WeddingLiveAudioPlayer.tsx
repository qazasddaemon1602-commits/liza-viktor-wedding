import { useEffect, useRef } from 'react';
import { PROJECTOR_AUDIO_REARM_EVENT, siteAudio } from '../../lib/siteAudio';

type Props = {
  src: string;
  eventKey: string;
  onEnded?: () => void;
};

function safePause(audio: HTMLAudioElement) {
  try {
    audio.pause();
  } catch {
    // Some embedded/test browsers do not implement media playback controls.
  }
}

function safePlay(audio: HTMLAudioElement) {
  try {
    const result = audio.play();
    if (result && typeof result.catch === 'function') {
      void result.catch(() => undefined);
    }
  } catch {
    // Autoplay may be blocked until the projector sound control is armed.
  }
}

export function WeddingLiveAudioPlayer({ src, eventKey, onEnded }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const applySettings = (settings = siteAudio.getSettings()) => {
      audio.volume = Math.min(1, Math.max(0, settings.volume));
      audio.muted = !settings.enabled || settings.volume <= 0;
      if (audio.muted) {
        safePause(audio);
        return;
      }
      if (!audio.ended) safePlay(audio);
    };

    try {
      audio.currentTime = 0;
    } catch {
      // Metadata can still be loading; a fresh source starts from zero anyway.
    }
    applySettings();
    const unsubscribe = siteAudio.subscribe(applySettings);
    const rearm = () => applySettings();
    window.addEventListener(PROJECTOR_AUDIO_REARM_EVENT, rearm);

    return () => {
      unsubscribe();
      window.removeEventListener(PROJECTOR_AUDIO_REARM_EVENT, rearm);
      safePause(audio);
    };
  }, [eventKey, src]);

  return (
    <audio
      ref={audioRef}
      src={src}
      preload="auto"
      playsInline
      onEnded={onEnded}
      aria-hidden="true"
      data-wedding-live-audio={eventKey}
    />
  );
}
