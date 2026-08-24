import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PROJECTOR_AUDIO_REARM_EVENT } from '../../lib/siteAudio';
import { BunkerScreenGuard, type BunkerScreenGuardDependencies } from './BunkerScreenGuard';
import type {
  BunkerNarrationMission,
  BunkerNarrationSessionController,
} from './bunkerNarration';

async function flushLoadedState() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function activeState(globalGameState: 'MISSION_01' | 'MISSION_02', startedAt = '2026-08-30T18:00:00.000Z') {
  return {
    contractVersion: 2 as const,
    status: 'active' as const,
    startedAt,
    durationSeconds: 1800,
    remainingSeconds: 1200,
    soundEnabled: true,
    phase: 'mission_a' as const,
    unlocked: false,
    teams: [],
    characterCounts: { active: 20, saved: 0, excluded: 0 },
    globalGameState,
    currentMission: { id: globalGameState.toLocaleLowerCase(), state: globalGameState, plan: null },
    serverNow: globalGameState === 'MISSION_01'
      ? '2026-08-30T18:10:00.000Z'
      : '2026-08-30T18:11:00.000Z',
  };
}

function narrationRecorder() {
  let mission: BunkerNarrationMission | null = null;
  let runIdentity: string | null = null;
  const spokenIds = new Set<string>();
  const spokenTexts: string[] = [];
  const narration: BunkerNarrationSessionController = {
    setRun: (nextRunIdentity) => {
      if (nextRunIdentity && nextRunIdentity !== runIdentity) spokenIds.clear();
      runIdentity = nextRunIdentity;
    },
    setMission: (nextMission) => { mission = nextMission; },
    setArmed: (armed) => {
      if (!armed || !mission || spokenIds.has(mission.id)) return;
      spokenIds.add(mission.id);
      spokenTexts.push(mission.text);
    },
    stop: vi.fn(),
  };
  return { narration, spokenTexts };
}

function audioController(arm = vi.fn().mockResolvedValue(true)) {
  return {
    arm,
    startAlarm: vi.fn(),
    stopAlarm: vi.fn(),
    startAmbience: vi.fn(),
    stopAmbience: vi.fn(),
    playDoorUnlock: vi.fn(),
    playReveal: vi.fn(),
    dispose: vi.fn(),
  };
}

describe('BunkerScreenGuard audio lifecycle', () => {
  it('automatically narrates the Bunker introduction once per run, not after every mission transition', async () => {
    let refresh: (() => void) | undefined;
    const load = vi.fn()
      .mockResolvedValueOnce(activeState('MISSION_01'))
      .mockResolvedValueOnce(activeState('MISSION_02'));
    const { narration, spokenTexts } = narrationRecorder();

    render(
      <BunkerScreenGuard dependencies={{
        load,
        subscribe: (callback) => { refresh = callback; return () => undefined; },
        audio: audioController(),
        narration,
      }}>
        <div>ОБЫЧНЫЙ ЭКРАН</div>
      </BunkerScreenGuard>,
    );
    await flushLoadedState();
    expect(spokenTexts).toHaveLength(1);

    await act(async () => {
      refresh?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(spokenTexts).toHaveLength(1);
  });

  it('starts the existing mission ambience only after browser audio is armed, retrying on the projector gesture', async () => {
    const arm = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const audio = audioController(arm);
    const dependencies: BunkerScreenGuardDependencies = {
      load: vi.fn().mockResolvedValue(activeState('MISSION_01')),
      audio,
    };

    render(
      <BunkerScreenGuard dependencies={dependencies}>
        <div>ОБЫЧНЫЙ ЭКРАН</div>
      </BunkerScreenGuard>,
    );
    await flushLoadedState();

    expect(audio.startAmbience).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new Event(PROJECTOR_AUDIO_REARM_EVENT));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(audio.startAmbience).toHaveBeenCalledTimes(1);
  });
});
