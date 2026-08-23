import { BUNKER_NARRATION_PROFILE } from '../../lib/audioManifest';

export type BunkerNarrationSynth = {
  speak: (utterance: SpeechSynthesisUtterance) => void;
  cancel: () => void;
};

export type BunkerNarrationController = {
  speak: (missionId: string, text: string) => boolean;
  replay: () => boolean;
  stop: () => void;
  setEnabled: (enabled: boolean) => void;
};

type BunkerNarrationOptions = {
  synth: BunkerNarrationSynth;
  getVoices: () => readonly SpeechSynthesisVoice[];
};

export type BunkerNarrationMission = {
  id: string;
  text: string;
};

export type BunkerNarrationState = {
  active: boolean;
  armed: boolean;
  enabled: boolean;
  missionId: string | null;
};

export type BunkerNarrationSessionController = {
  setMission: (mission: BunkerNarrationMission | null) => void;
  setArmed: (armed: boolean) => void;
  stop: () => void;
};

function createUtterance(text: string): SpeechSynthesisUtterance {
  if (typeof SpeechSynthesisUtterance === 'function') {
    return new SpeechSynthesisUtterance(text);
  }

  return {
    text,
    lang: '',
    voice: null,
    volume: 1,
    rate: 1,
    pitch: 1,
  } as SpeechSynthesisUtterance;
}

function preferredRussianVoice(
  voices: readonly SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  return voices.find((voice) => voice.lang.toLocaleLowerCase() === 'ru-ru')
    ?? voices.find((voice) => voice.lang.toLocaleLowerCase().startsWith('ru'))
    ?? null;
}

export function createBunkerNarrationController({
  synth,
  getVoices,
}: BunkerNarrationOptions): BunkerNarrationController {
  let enabled = true;
  let current: BunkerNarrationMission | null = null;
  let lastAttemptedMissionId: string | null = null;

  const performSpeech = (mission: BunkerNarrationMission, force: boolean): boolean => {
    if (!enabled || (!force && lastAttemptedMissionId === mission.id)) return false;

    if (current && current.id !== mission.id) {
      try {
        synth.cancel();
      } catch {
        // Native speech engines can disappear when the output device changes.
      }
    }
    current = mission;
    lastAttemptedMissionId = mission.id;

    try {
      const utterance = createUtterance(mission.text);
      utterance.lang = BUNKER_NARRATION_PROFILE.lang;
      utterance.rate = BUNKER_NARRATION_PROFILE.rate;
      utterance.pitch = BUNKER_NARRATION_PROFILE.pitch;
      utterance.volume = BUNKER_NARRATION_PROFILE.volume;
      utterance.voice = preferredRussianVoice(getVoices());
      synth.speak(utterance);
      return true;
    } catch {
      return false;
    }
  };

  return {
    speak: (missionId, text) => performSpeech({ id: missionId, text }, false),
    replay: () => {
      if (!enabled || !current) return false;
      try {
        synth.cancel();
      } catch {
        // Replay remains optional if the browser speech engine is unavailable.
      }
      return performSpeech(current, true);
    },
    stop: () => {
      try {
        synth.cancel();
      } catch {
        // Stopping narration must never affect the game state.
      }
    },
    setEnabled: (nextEnabled) => {
      enabled = nextEnabled;
      if (!enabled) {
        try {
          synth.cancel();
        } catch {
          // The visible mission text remains the fallback.
        }
      }
    },
  };
}

const browserSynth: BunkerNarrationSynth = {
  cancel: () => window.speechSynthesis?.cancel(),
  speak: (utterance) => {
    if (!window.speechSynthesis) throw new Error('Speech synthesis is unavailable');
    window.speechSynthesis.speak(utterance);
  },
};

const bunkerNarration = createBunkerNarrationController({
  synth: browserSynth,
  getVoices: () => window.speechSynthesis?.getVoices() ?? [],
});

let activeMission: BunkerNarrationMission | null = null;
let narrationState: BunkerNarrationState = {
  active: false,
  armed: false,
  enabled: true,
  missionId: null,
};
const listeners = new Set<(state: BunkerNarrationState) => void>();

function publish(next: BunkerNarrationState): void {
  narrationState = next;
  for (const listener of listeners) listener(next);
}

export function getBunkerNarrationState(): BunkerNarrationState {
  return narrationState;
}

export function subscribeToBunkerNarrationState(
  listener: (state: BunkerNarrationState) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setActiveBunkerNarrationMission(
  mission: BunkerNarrationMission | null,
): void {
  const changed = activeMission?.id !== mission?.id;
  if (changed) bunkerNarration.stop();
  activeMission = mission;
  publish({
    ...narrationState,
    active: mission !== null,
    armed: changed || mission === null ? false : narrationState.armed,
    missionId: mission?.id ?? null,
  });
}

export function setBunkerNarrationArmed(armed: boolean): void {
  publish({ ...narrationState, armed: activeMission !== null && armed });
  if (activeMission && armed && narrationState.enabled) {
    bunkerNarration.speak(activeMission.id, activeMission.text);
  }
}

export function setBunkerNarrationEnabled(enabled: boolean): void {
  bunkerNarration.setEnabled(enabled);
  publish({ ...narrationState, enabled });
  if (enabled && activeMission && narrationState.armed) {
    bunkerNarration.speak(activeMission.id, activeMission.text);
  }
}

export function replayBunkerNarration(): boolean {
  if (!activeMission || !narrationState.armed || !narrationState.enabled) return false;
  return bunkerNarration.replay();
}

export function stopBunkerNarration(): void {
  bunkerNarration.stop();
}

export const bunkerNarrationSession: BunkerNarrationSessionController = {
  setMission: setActiveBunkerNarrationMission,
  setArmed: setBunkerNarrationArmed,
  stop: stopBunkerNarration,
};
