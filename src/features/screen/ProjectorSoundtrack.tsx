import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import { createScreenAudioController, type ProjectorSoundtrackTheme, type ScreenAudioController } from './screenAudio';
import {
  getProjectorSoundtrackState,
  type ProjectorSoundtrackRpcClient,
  type ProjectorSoundtrackState,
} from './projectorSoundtrack.service';

export type ProjectorSoundtrackDependencies = {
  load: () => Promise<ProjectorSoundtrackState | null>;
  audio: Pick<ScreenAudioController, 'setSoundtrackTheme' | 'stopSoundtrack' | 'dispose'>;
  pollIntervalMs?: number;
};

type Props = {
  eventSlug?: string;
  dependencies?: ProjectorSoundtrackDependencies;
  children: ReactNode;
};

function normalize(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase().replaceAll('-', '_');
}

export function resolveProjectorMusicTheme(
  state: ProjectorSoundtrackState | null,
): ProjectorSoundtrackTheme | null {
  if (!state || !state.soundEnabled) return null;

  const module = normalize(state.currentModule);
  const mode = normalize(state.screenMode);
  const bunkerState = normalize(state.globalGameState);

  if (module === 'premiere' || mode === 'black' || mode.startsWith('premiere_')) return null;

  if (module === 'bunker' || mode.startsWith('bunker_')) {
    if (bunkerState === 'bunker_open' || bunkerState === 'finished' || mode === 'bunker_results') {
      return 'finale';
    }
    return 'heist';
  }

  if (
    module.includes('mortal')
    || module.includes('kombat')
    || mode.includes('mortal')
    || mode.includes('kombat')
    || mode.includes('tournament')
  ) {
    return 'tournament';
  }

  if (
    module.includes('quiz')
    || module.includes('final_five')
    || mode.includes('quiz')
    || mode.includes('final_five')
    || mode.includes('couple_reveal')
  ) {
    return 'game';
  }

  return 'celebration';
}

function browserDependencies(eventSlug: string): ProjectorSoundtrackDependencies {
  const client = getSupabaseClient() as unknown as ProjectorSoundtrackRpcClient;
  const audio = createScreenAudioController();
  return {
    load: () => getProjectorSoundtrackState(client, eventSlug),
    audio,
    pollIntervalMs: 1_200,
  };
}

export function ProjectorSoundtrack({
  eventSlug = 'liza-viktor',
  dependencies,
  children,
}: Props) {
  const deps = useMemo(
    () => dependencies ?? browserDependencies(eventSlug),
    [dependencies, eventSlug],
  );
  const [state, setState] = useState<ProjectorSoundtrackState | null>(null);
  const pollIntervalMs = Math.max(600, deps.pollIntervalMs ?? 1_200);

  useEffect(() => {
    let active = true;
    let inFlight = false;

    const reload = () => {
      if (!active || inFlight) return;
      inFlight = true;
      void deps.load()
        .then((next) => {
          if (active) setState(next);
        })
        .catch(() => {
          // Keep the last valid soundtrack stage during a brief network interruption.
        })
        .finally(() => {
          inFlight = false;
        });
    };

    reload();
    const interval = window.setInterval(reload, pollIntervalMs);
    window.addEventListener('focus', reload);
    window.addEventListener('online', reload);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', reload);
      window.removeEventListener('online', reload);
    };
  }, [deps, pollIntervalMs]);

  const theme = resolveProjectorMusicTheme(state);

  useEffect(() => {
    if (theme) deps.audio.setSoundtrackTheme(theme);
    else deps.audio.stopSoundtrack();
  }, [deps.audio, theme]);

  useEffect(() => () => deps.audio.dispose(), [deps.audio]);

  return <>{children}</>;
}
