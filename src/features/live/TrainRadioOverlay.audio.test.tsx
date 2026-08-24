import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrainRadioOverlay } from './TrainRadioOverlay';

const transmission = {
  id: 'radio-1',
  kind: 'radio_transmission' as const,
  createdAt: '2026-08-24T06:00:00Z',
  preset: 'dance' as const,
  label: 'ТАНЦПОЛ',
  message: 'Танцевальная платформа свободна.',
  durationMs: 12000,
};

describe('TrainRadioOverlay audio', () => {
  it('plays the voice file mapped to the active preset', () => {
    const { container } = render(<TrainRadioOverlay transmission={transmission} />);
    const audio = container.querySelector('audio');
    expect(audio).not.toBeNull();
    expect(audio?.getAttribute('src')).toBe('/audio/radio/0824(5).MP3');
  });
});
