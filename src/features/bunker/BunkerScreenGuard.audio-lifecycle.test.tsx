import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROJECTOR_AUDIO_REARM_EVENT, siteAudio } from '../../lib/siteAudio';
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

type GameState = 'MISSION_01' | 'MISSION_02' | 'FINAL_30' | 'BUNKER_OPEN' | 'FINISHED';

function activeState(globalGameState: GameState, startedAt = '2026-08-30T18:00:00.000Z') {
  const finalState = globalGameState === 'FINAL_30';
  const completed = globalGameState === 'BUNKER_OPEN' || globalGameState === 'FINISHED';
  return {
    contractVersion: 2 as const,
    status: 'active' as const,
    startedAt,
    durationSeconds: 1800,
    remainingSeconds: 1200,
    soundEnabled: true,
    phase: completed ? 'completed' as const : finalState ? 'final' as const : 'mission_a' as const,
    unlocked: completed,
    teams: [],
    characterCounts: { active: 20, saved: 0, excluded: 0 },
    globalGameState,
    currentMission: completed
      ? null
      : { id: globalGameState.toLocaleLowerCase(), state: globalGameState, plan: null },
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
    playFinale: vi.fn(),
    stopFinale: vi.fn(),
    dispose: vi.fn(),
  };
}

describe('BunkerScreenGuard audio lifecycle', () => {
  beforeEach(() => {
    siteAudio.setEnabled(true);
    siteAudio.setVolume(0.75);
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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

  it('starts mission ambience once after browser audio is re-armed and not again for a mission render', async () => {
    let refresh: (() => void) | undefined;
    const arm = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const audio = audioController(arm);
    const dependencies: BunkerScreenGuardDependencies = {
      load: vi.fn()
        .mockResolvedValueOnce(activeState('MISSION_01'))
        .mockResolvedValueOnce(activeState('MISSION_02')),
      subscribe: (callback) => { refresh = callback; return () => undefined; },
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

    await act(async () => {
      refresh?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    window.dispatchEvent(new Event(PROJECTOR_AUDIO_REARM_EVENT));
    await flushLoadedState();

    expect(audio.startAmbience).toHaveBeenCalledTimes(1);
  });

  it('pauses mission ambience while the alarm owns the emergency scene', async () => {
    const audio = audioController();
    render(
      <BunkerScreenGuard dependencies={{
        load: vi.fn().mockResolvedValue({
          ...activeState('MISSION_01'),
          phase: 'emergency',
          globalGameState: undefined,
          currentMission: null,
        }),
        audio,
      }}>
        <div>ОБЫЧНЫЙ ЭКРАН</div>
      </BunkerScreenGuard>,
    );
    await flushLoadedState();

    expect(audio.startAlarm).toHaveBeenCalledTimes(1);
    expect(audio.startAmbience).not.toHaveBeenCalled();
    expect(audio.stopAmbience).toHaveBeenCalled();
  });

  it('uses one door owner and starts the finale once after the reveal transition', async () => {
    vi.useFakeTimers();
    let refresh: (() => void) | undefined;
    const order: string[] = [];
    const audio = audioController();
    audio.playDoorUnlock.mockImplementation(() => { order.push('door'); });
    audio.playReveal.mockImplementation(() => { order.push('reveal'); });
    audio.playFinale.mockImplementation(() => { order.push('finale'); });
    const load = vi.fn()
      .mockResolvedValueOnce(activeState('FINAL_30'))
      .mockResolvedValueOnce({ ...activeState('FINAL_30'), unlocked: true })
      .mockResolvedValue(activeState('BUNKER_OPEN'));

    render(
      <BunkerScreenGuard dependencies={{
        load,
        subscribe: (callback) => { refresh = callback; return () => undefined; },
        audio,
      }}>
        <div>ОБЫЧНЫЙ ЭКРАН</div>
      </BunkerScreenGuard>,
    );
    await flushLoadedState();

    await act(async () => {
      refresh?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(order).toEqual([]);

    await act(async () => {
      refresh?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(order).toEqual(['door']);

    await act(async () => { await vi.advanceTimersByTimeAsync(1_600); });
    expect(order).toEqual(['door', 'reveal', 'finale']);

    window.dispatchEvent(new Event(PROJECTOR_AUDIO_REARM_EVENT));
    await flushLoadedState();
    await act(async () => { await vi.advanceTimersByTimeAsync(1_600); });
    expect(order).toEqual(['door', 'reveal', 'finale']);
  });

  it('retries a blocked reveal sequence only after explicit audio re-arm', async () => {
    vi.useFakeTimers();
    let refresh: (() => void) | undefined;
    const arm = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const audio = audioController(arm);
    render(
      <BunkerScreenGuard dependencies={{
        load: vi.fn().mockResolvedValue(activeState('BUNKER_OPEN', '2026-08-30T19:00:00.000Z')),
        subscribe: (callback) => { refresh = callback; return () => undefined; },
        audio,
      }}>
        <div>ОБЫЧНЫЙ ЭКРАН</div>
      </BunkerScreenGuard>,
    );
    await flushLoadedState();
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });

    expect(audio.playDoorUnlock).not.toHaveBeenCalled();
    expect(audio.playFinale).not.toHaveBeenCalled();

    await act(async () => {
      refresh?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(arm).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event(PROJECTOR_AUDIO_REARM_EVENT));
    await flushLoadedState();
    expect(audio.playDoorUnlock).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(1_600); });
    expect(audio.playReveal).toHaveBeenCalledTimes(1);
    expect(audio.playFinale).toHaveBeenCalledTimes(1);
  });

  it('keeps stale pending play tokens from starting after restart', async () => {
    let refresh: (() => void) | undefined;
    let resolveArm: ((armed: boolean) => void) | undefined;
    const audio = audioController(vi.fn().mockImplementation(() => (
      new Promise<boolean>((resolve) => { resolveArm = resolve; })
    )));
    const load = vi.fn()
      .mockResolvedValueOnce(activeState('BUNKER_OPEN', '2026-08-30T20:00:00.000Z'))
      .mockResolvedValueOnce(activeState('FINISHED', '2026-08-30T20:00:00.000Z'))
      .mockResolvedValueOnce(activeState('MISSION_01', '2026-08-30T21:00:00.000Z'));
    render(
      <BunkerScreenGuard dependencies={{
        load,
        subscribe: (callback) => { refresh = callback; return () => undefined; },
        audio,
      }}>
        <div>ОБЫЧНЫЙ ЭКРАН</div>
      </BunkerScreenGuard>,
    );
    await flushLoadedState();

    await act(async () => {
      refresh?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      refresh?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      resolveArm?.(true);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(audio.playDoorUnlock).not.toHaveBeenCalled();
    expect(audio.playFinale).not.toHaveBeenCalled();
  });

  it('stops a playing finale when the projector leaves the reveal for results or a restarted run', async () => {
    vi.useFakeTimers();
    let refresh: (() => void) | undefined;
    const audio = audioController();
    const load = vi.fn()
      .mockResolvedValueOnce(activeState('BUNKER_OPEN', '2026-08-30T22:00:00.000Z'))
      .mockResolvedValueOnce(activeState('FINISHED', '2026-08-30T22:00:00.000Z'))
      .mockResolvedValue({
        ...activeState('MISSION_01', '2026-08-30T23:00:00.000Z'),
        serverNow: '2026-08-30T23:00:01.000Z',
      });
    render(
      <BunkerScreenGuard dependencies={{
        load,
        subscribe: (callback) => { refresh = callback; return () => undefined; },
        audio,
      }}>
        <div>ОБЫЧНЫЙ ЭКРАН</div>
      </BunkerScreenGuard>,
    );
    await flushLoadedState();
    await act(async () => { await vi.advanceTimersByTimeAsync(1_600); });
    expect(audio.playFinale).toHaveBeenCalledTimes(1);

    audio.stopFinale.mockClear();
    await act(async () => {
      refresh?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(audio.stopFinale).toHaveBeenCalled();
    expect(audio.playFinale).toHaveBeenCalledTimes(1);

    audio.stopFinale.mockClear();
    await act(async () => {
      refresh?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(audio.stopFinale).toHaveBeenCalled();
    expect(audio.playFinale).toHaveBeenCalledTimes(1);
  });
});
