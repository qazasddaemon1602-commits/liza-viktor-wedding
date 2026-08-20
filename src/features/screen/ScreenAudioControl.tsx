import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { requestProjectorAudioRearm, siteAudio } from '../../lib/siteAudio';
import { PREMIERE_MEDIA_AUTOPLAY_MUTED_EVENT } from '../premiere/mediaPlayback';

const LAST_VOLUME_KEY = 'love-story-live:sound-last-volume';
const DEFAULT_VOLUME = 0.75;

function readLastVolume(): number {
  try {
    const value = Number(window.localStorage.getItem(LAST_VOLUME_KEY));
    if (Number.isFinite(value) && value > 0 && value <= 1) return value;
  } catch {
    // Device storage is optional.
  }
  return DEFAULT_VOLUME;
}

function rememberVolume(volume: number) {
  if (volume <= 0) return;
  try {
    window.localStorage.setItem(LAST_VOLUME_KEY, String(volume));
  } catch {
    // Device storage is optional.
  }
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4.5 9.2v5.6h3.7l4.6 3.6V5.6L8.2 9.2H4.5Z" />
      {muted ? (
        <>
          <path d="m16.2 9 4 6" />
          <path d="m20.2 9-4 6" />
        </>
      ) : (
        <>
          <path d="M16 9.1c1.5 1.5 1.5 4.3 0 5.8" />
          <path d="M18.7 6.7c3 3 3 7.6 0 10.6" />
        </>
      )}
    </svg>
  );
}

export function ScreenAudioControl() {
  const { pathname } = useLocation();
  const [settings, setSettings] = useState(() => siteAudio.getSettings());
  const [premiereAutoplayMuted, setPremiereAutoplayMuted] = useState(false);
  const visible = pathname === '/screen' || pathname === '/mortal-kombat/screen';
  const userMuted = !settings.enabled || settings.volume <= 0;
  const muted = userMuted || premiereAutoplayMuted;

  useEffect(() => siteAudio.subscribe(setSettings), []);

  useEffect(() => {
    const updatePremiereMediaMute = (event: Event) => {
      const detail = (event as CustomEvent<{ muted?: boolean }>).detail;
      setPremiereAutoplayMuted(Boolean(detail?.muted));
    };
    window.addEventListener(PREMIERE_MEDIA_AUTOPLAY_MUTED_EVENT, updatePremiereMediaMute);
    return () => window.removeEventListener(PREMIERE_MEDIA_AUTOPLAY_MUTED_EVENT, updatePremiereMediaMute);
  }, []);

  useEffect(() => {
    if (settings.volume > 0) rememberVolume(settings.volume);
  }, [settings.volume]);

  if (!visible) return null;

  const armAllProjectorAudio = () => {
    void siteAudio.arm();
    requestProjectorAudioRearm();
  };

  const toggleMuted = () => {
    if (premiereAutoplayMuted && !userMuted) {
      armAllProjectorAudio();
      return;
    }

    if (!userMuted) {
      siteAudio.setEnabled(false);
      return;
    }

    if (siteAudio.getVolume() <= 0) siteAudio.setVolume(readLastVolume());
    siteAudio.setEnabled(true);
    armAllProjectorAudio();
  };

  const changeVolume = (value: number) => {
    const next = Math.min(1, Math.max(0, value / 100));
    if (next <= 0) {
      siteAudio.setVolume(0);
      siteAudio.setEnabled(false);
      return;
    }

    rememberVolume(next);
    siteAudio.setVolume(next);
    siteAudio.setEnabled(true);
    armAllProjectorAudio();
  };

  return (
    <div className="screen-audio-control" aria-label="Управление звуком">
      <button
        type="button"
        className="screen-audio-control__toggle"
        data-audio-disabled
        aria-label={muted ? 'Включить звук' : 'Выключить звук'}
        title={muted ? 'Включить звук' : 'Выключить звук'}
        aria-pressed={muted}
        onClick={toggleMuted}
      >
        <SpeakerIcon muted={muted} />
      </button>
      <input
        className="screen-audio-control__range"
        data-audio-disabled
        type="range"
        min="0"
        max="100"
        step="1"
        value={Math.round(settings.volume * 100)}
        aria-label="Громкость"
        aria-valuetext={`${Math.round(settings.volume * 100)}%`}
        onChange={(event) => changeVolume(Number(event.target.value))}
      />
    </div>
  );
}
