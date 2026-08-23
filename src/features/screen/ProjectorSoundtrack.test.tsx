import { describe, expect, it } from 'vitest';
import { resolveProjectorMusicTheme } from './ProjectorSoundtrack';
import type { ProjectorSoundtrackState } from './projectorSoundtrack.service';

function state(overrides: Partial<ProjectorSoundtrackState> = {}): ProjectorSoundtrackState {
  return {
    status: 'ok',
    currentModule: 'idle',
    screenMode: 'idle',
    screenPinned: false,
    globalGameState: null,
    soundEnabled: true,
    updatedAt: '2026-08-24T00:00:00.000Z',
    ...overrides,
  };
}

describe('resolveProjectorMusicTheme', () => {
  it('keeps arrival and registration festive', () => {
    expect(resolveProjectorMusicTheme(state())).toBe('celebration');
    expect(resolveProjectorMusicTheme(state({ currentModule: 'registration' }))).toBe('celebration');
  });

  it('uses a playful groove for quiz and final-five stages', () => {
    expect(resolveProjectorMusicTheme(state({ currentModule: 'quiz', screenMode: 'quiz_voting' }))).toBe('game');
    expect(resolveProjectorMusicTheme(state({ currentModule: 'final_five', screenMode: 'final_five_reveal' }))).toBe('game');
  });

  it('uses the energetic tournament theme for Mortal Kombat', () => {
    expect(resolveProjectorMusicTheme(state({ currentModule: 'mortal_kombat', screenMode: 'tournament' }))).toBe('tournament');
  });

  it('keeps Bunker missions in a funky heist mood and celebrates the opening', () => {
    expect(resolveProjectorMusicTheme(state({
      currentModule: 'bunker',
      screenMode: 'bunker_mission',
      globalGameState: 'MISSION_04',
    }))).toBe('heist');
    expect(resolveProjectorMusicTheme(state({
      currentModule: 'bunker',
      screenMode: 'bunker_open',
      globalGameState: 'BUNKER_OPEN',
    }))).toBe('finale');
    expect(resolveProjectorMusicTheme(state({
      currentModule: 'bunker',
      screenMode: 'bunker_results',
      globalGameState: 'FINISHED',
    }))).toBe('finale');
  });

  it('gets out of the way for the premiere and explicit mute', () => {
    expect(resolveProjectorMusicTheme(state({ currentModule: 'premiere', screenMode: 'premiere_playback' }))).toBeNull();
    expect(resolveProjectorMusicTheme(state({ soundEnabled: false }))).toBeNull();
  });
});
