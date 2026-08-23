import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectorSoundtrack } from './ProjectorSoundtrack';
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

describe('ProjectorSoundtrack', () => {
  it('starts the theme resolved from the real server stage and disposes cleanly', async () => {
    const audio = {
      setSoundtrackTheme: vi.fn(),
      stopSoundtrack: vi.fn(),
      dispose: vi.fn(),
    };
    const view = render(
      <ProjectorSoundtrack
        dependencies={{
          load: async () => state({ currentModule: 'quiz', screenMode: 'quiz_voting' }),
          audio,
          pollIntervalMs: 60_000,
        }}
      >
        <div>PROJECTOR</div>
      </ProjectorSoundtrack>,
    );

    await waitFor(() => expect(audio.setSoundtrackTheme).toHaveBeenCalledWith('game'));
    expect(view.getByText('PROJECTOR')).toBeTruthy();

    view.unmount();
    expect(audio.dispose).toHaveBeenCalledTimes(1);
  });

  it('stops background music while the premiere owns the projector', async () => {
    const audio = {
      setSoundtrackTheme: vi.fn(),
      stopSoundtrack: vi.fn(),
      dispose: vi.fn(),
    };
    render(
      <ProjectorSoundtrack
        dependencies={{
          load: async () => state({ currentModule: 'premiere', screenMode: 'premiere_playback' }),
          audio,
          pollIntervalMs: 60_000,
        }}
      >
        <div>PREMIERE</div>
      </ProjectorSoundtrack>,
    );

    await waitFor(() => expect(audio.stopSoundtrack).toHaveBeenCalled());
    expect(audio.setSoundtrackTheme).not.toHaveBeenCalled();
  });
});
