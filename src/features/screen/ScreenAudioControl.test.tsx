import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { siteAudio } from '../../lib/siteAudio';
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
  });

  afterEach(() => {
    siteAudio.setVolume(0.75);
    siteAudio.setEnabled(true);
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

  it('treats zero volume as mute and restores the last audible volume from the icon', () => {
    renderControl();
    const slider = screen.getByRole('slider', { name: 'Громкость' });

    fireEvent.change(slider, { target: { value: '42' } });
    fireEvent.change(slider, { target: { value: '0' } });
    expect(siteAudio.isEnabled()).toBe(false);
    expect(siteAudio.getVolume()).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Включить звук' }));
    expect(siteAudio.isEnabled()).toBe(true);
    expect(siteAudio.getVolume()).toBeCloseTo(0.42);
  });
});
