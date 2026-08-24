import { useEffect, useRef } from 'react';
import { PROJECTOR_AUDIO_REARM_EVENT, siteAudio } from '../../lib/siteAudio';

type Props = {
  src: string;
  eventKey: string;
  onEnded?: () => void;
};

export function WeddingLiveAudioPlayer({ src, eventKey, onEnded }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const applySettings = (settings = siteAudio.getSettings()) => {
      audio.volume = Math.min(1, Math.max(0, settings.volume));
      audio.muted = !settings.enabled || settings.volume <= 0;
      if (audio.muted) {
        audio.pause();
        return;
      }
      if (!audio.ended) void audio.play().catch(() => undefined);
    };

    audio.currentTime = 0;
    applySettings();
    const unsubscribe = siteAudio.subscribe(applySettings);
    const rearm = () => applySettings();
    window.addEventListener(PROJECTOR_AUDIO_REARM_EVENT, rearm);

    return () => {
      unsubscribe();
      window.removeEventListener(PROJECTOR_AUDIO_REARM_EVENT, rearm);
      audio.pause();
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
