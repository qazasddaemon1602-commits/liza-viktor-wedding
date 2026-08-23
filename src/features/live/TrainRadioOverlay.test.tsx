import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrainRadioOverlay } from './TrainRadioOverlay';

describe('TrainRadioOverlay', () => {
  it('renders the dispatch label and full radio message', () => {
    render(<TrainRadioOverlay transmission={{
      id: 'r1',
      kind: 'radio_transmission',
      createdAt: '2026-08-24T00:00:00Z',
      preset: 'dance',
      label: 'ТАНЦПОЛ',
      message: 'По внутренней связи: танцевальная платформа свободна.',
      durationMs: 12000,
    }} />);

    expect(screen.getByText('РАДИО СОСТАВА')).toBeInTheDocument();
    expect(screen.getByText('ТАНЦПОЛ')).toBeInTheDocument();
    expect(screen.getByText('По внутренней связи: танцевальная платформа свободна.')).toBeInTheDocument();
  });
});
