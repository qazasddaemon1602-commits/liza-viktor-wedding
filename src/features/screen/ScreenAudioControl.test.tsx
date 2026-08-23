import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROJECTOR_AUDIO_REARM_EVENT, siteAudio } from '../../lib/siteAudio';
import {
  setActiveBunkerNarrationMission,
  setBunkerNarrationArmed,
  setBunkerNarrationEnabled,
} from '../bunker/bunkerNarration';
import { PREMIERE_MEDIA_AUTOPLAY_MUTED_EVENT } from '../premiere/mediaPlayback';
import { ScreenAudioControl } from './ScreenAudioControl';

function renderControl(path = '/screen') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ScreenAudioControl />
    </MemoryRouter>,
  );
}

describe('ScreenAudioControl', () => {
  beforeEach(() => {
    window.localStorage.removeItem('love-story-live:sound-last-volume');
    siteAudio.setVolume(0.75);
    siteAudio.setEnabled(true);
    setActiveBunkerNarrationMission(null);
    setBunkerNarrationEnabled(true);
  });

  afterEach(() => {
    siteAudio.setVolume(0.75);
    siteAudio.setEnabled(true);
    setActiveBunkerNarrationMission(null);
    setBunkerNarrationEnabled(true);
  });

  it('shows a minimal speaker button and 75% slider only on projector routes', () => {
    const { unmount } = renderControl('/screen');
    expect(screen.getByRole('button', { name: 'Выключить звук' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Громкость' })).toHaveValue('75');
    unmount();

    renderControl('/join');
    expect(screen.queryByRole('slider', { name: 'Громкость' })).not.toBeInTheDocument();
  });

  it('mutes from the icon and unmutes when the slider is raised', () => {
    renderControl();

    fireEvent.click(screen.getByRole('button', { name: 'Выключить звук' }));
    expect(siteAudio.isEnabled()).toBe(false);
    expect(screen.getByRole('button', { name: 'Включить звук' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('slider', { name: 'Громкость' }), {
      target: { value: '30' },
    });
    expect(siteAudio.isEnabled()).toBe(true);
    expect(siteAudio.getVolume()).toBeCloseTo(0.3);
    expect(screen.getByRole('button', { name: 'Выключить звук' })).toBeInTheDocument();
  });

  it('treats zero volume as mute, restores the last audible volume and rearms projector contexts', () => {
    const rearm = vi.fn();
    window.addEventListener(PROJECTOR_AUDIO_REARM_EVENT, rearm);
    renderControl();
    const slider = screen.getByRole('slider', { name: 'Громкость' });

    fireEvent.change(slider, { target: { value: '42' } });
    fireEvent.change(slider, { target: { value: '0' } });
    expect(siteAudio.isEnabled()).toBe(false);
    expect(siteAudio.getVolume()).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Включить звук' }));
    expect(siteAudio.isEnabled()).toBe(true);
    expect(siteAudio.getVolume()).toBeCloseTo(0.42);
    expect(rearm).toHaveBeenCalled();
    window.removeEventListener(PROJECTOR_AUDIO_REARM_EVENT, rearm);
  });

  it('shows a transient mute when Chrome blocks premiere audio without persisting sound off', () => {
    const rearm = vi.fn();
    window.addEventListener(PROJECTOR_AUDIO_REARM_EVENT, rearm);
    renderControl();

    act(() => {
      window.dispatchEvent(new CustomEvent(PREMIERE_MEDIA_AUTOPLAY_MUTED_EVENT, {
        detail: { muted: true },
      }));
    });

    expect(siteAudio.isEnabled()).toBe(true);
    expect(screen.getByRole('button', { name: 'Включить звук' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Включить звук' }));

    expect(siteAudio.isEnabled()).toBe(true);
    expect(rearm).toHaveBeenCalled();
    window.removeEventListener(PROJECTOR_AUDIO_REARM_EVENT, rearm);
  });

  it('shows narration controls only for an armed Bunker mission and keeps replay disabled when narration is off', () => {
    renderControl();
    expect(screen.queryByRole('button', { name: 'Отключить озвучку' })).not.toBeInTheDocument();

    act(() => {
      setActiveBunkerNarrationMission({
        id: 'mission_03',
        text: 'Проверьте аварийный запас.',
      });
    });
    expect(screen.queryByRole('button', { name: 'Отключить озвучку' })).not.toBeInTheDocument();

    act(() => setBunkerNarrationArmed(true));
    expect(screen.getByRole('button', { name: 'Отключить озвучку' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить вступление' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Отключить озвучку' }));
    expect(screen.getByRole('button', { name: 'Включить озвучку' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить вступление' })).toBeDisabled();
  });

  it('stops and hides narration when the projector master sound is muted', () => {
    renderControl();
    act(() => {
      setActiveBunkerNarrationMission({
        id: 'mission_05',
        text: 'Выберите маршрут.',
      });
      setBunkerNarrationArmed(true);
    });
    expect(screen.getByRole('button', { name: 'Повторить вступление' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Выключить звук' }));

    expect(screen.queryByRole('button', { name: 'Повторить вступление' })).not.toBeInTheDocument();
  });
});

