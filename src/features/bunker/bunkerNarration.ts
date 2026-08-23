import { BUNKER_NARRATION_PROFILE } from '../../lib/audioManifest';
import { siteAudio } from '../../lib/siteAudio';

export type BunkerNarrationSynth = {
  speak: (utterance: SpeechSynthesisUtterance) => void;
  cancel: () => void;
};

export type BunkerNarrationController = {
  speak: (missionId: string, text: string) => boolean;
  replay: () => boolean;
  stop: () => void;
  setEnabled: (enabled: boolean) => void;
  reset: () => void;
};

type BunkerNarrationOptions = {
  synth: BunkerNarrationSynth;
  getVoices: () => readonly SpeechSynthesisVoice[];
  getVolume?: () => number;
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
  setRun: (runIdentity: string | null) => void;
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
  getVolume = () => BUNKER_NARRATION_PROFILE.volume,
}: BunkerNarrationOptions): BunkerNarrationController {
  let enabled = true;
  let current: BunkerNarrationMission | null = null;
  const spokenMissionIds = new Set<string>();

  const performSpeech = (mission: BunkerNarrationMission, force: boolean): boolean => {
    if (current && current.id !== mission.id) {
      try {
        synth.cancel();
      } catch {
        // Native speech engines can disappear when the output device changes.
      }
    }
    current = mission;
    if (!enabled || (!force && spokenMissionIds.has(mission.id))) return false;

    try {
      const utterance = createUtterance(mission.text);
      utterance.lang = BUNKER_NARRATION_PROFILE.lang;
      utterance.rate = BUNKER_NARRATION_PROFILE.rate;
      utterance.pitch = BUNKER_NARRATION_PROFILE.pitch;
      utterance.volume = Math.min(1, Math.max(0, getVolume()));
      utterance.voice = preferredRussianVoice(getVoices());
      synth.speak(utterance);
      spokenMissionIds.add(mission.id);
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
    reset: () => {
      try {
        synth.cancel();
      } catch {
        // Reset must remain safe when the native voice service is missing.
      }
      current = null;
      spokenMissionIds.clear();
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
  getVolume: () => siteAudio.getVolume(),
});

let activeRunIdentity: string | null = null;
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

export function setBunkerNarrationRun(runIdentity: string | null): void {
  if (runIdentity !== null && activeRunIdentity === runIdentity) return;
  activeRunIdentity = runIdentity;
  activeMission = null;
  bunkerNarration.reset();
  publish({
    ...narrationState,
    active: false,
    armed: false,
    missionId: null,
  });
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
  if (activeMission && armed) {
    bunkerNarration.speak(activeMission.id, activeMission.text);
  }
}

export function setBunkerNarrationEnabled(enabled: boolean): void {
  bunkerNarration.setEnabled(enabled);
  publish({ ...narrationState, enabled });
  if (enabled && activeMission && narrationState.armed) {
    bunkerNarration.replay();
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
  setRun: setBunkerNarrationRun,
  setMission: setActiveBunkerNarrationMission,
  setArmed: setBunkerNarrationArmed,
  stop: stopBunkerNarration,
};
