import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TrainArrivalScene } from './TrainArrivalScene';

const event = {
  id: 'screen-event-1',
  kind: 'guest_registered' as const,
  createdAt: '2026-08-30T12:06:00+05:00',
  payload: {
    displayName: 'Анна Смирнова',
    carriage: {
      id: 'c4',
      number: 4,
      label: 'ВАГОН №4',
      accentHex: '#78806A',
      visualMark: '04',
    },
  },
};

describe('TrainArrivalScene', () => {
  it('announces who arrived and exactly which carriage they joined', () => {
    const onSignal = vi.fn();

    render(<TrainArrivalScene event={event} onSignal={onSignal} />);

    expect(screen.getByText('НОВЫЙ ПАССАЖИР')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Анна Смирнова' })).toBeInTheDocument();
    expect(screen.getAllByText('ВАГОН №4')).toHaveLength(2);
    expect(screen.getByTestId('train-arrival-scene')).toHaveStyle({ '--arrival-accent': '#78806A' });
    expect(onSignal).toHaveBeenCalledTimes(1);
  });

  it('renders the generated cinematic train plate as decoration behind the live announcement', () => {
    render(<TrainArrivalScene event={event} />);

    const plate = screen.getByTestId('arrival-train-plate');
    expect(plate).toHaveAttribute('src', '/images/wedding/train-arrival-wide.png');
    expect(plate).toHaveAttribute('alt', '');
    expect(plate).toHaveAttribute('aria-hidden', 'true');

    const paper = screen.getByTestId('arrival-paper-texture');
    expect(paper).toHaveAttribute('src', '/images/ticket/paper-texture.png');
    expect(paper).toHaveAttribute('alt', '');
    expect(paper).toHaveAttribute('aria-hidden', 'true');
  });

  it('offers crop-sized AVIF and WebP sources for the arrival plate and paper layer', () => {
    render(<TrainArrivalScene event={event} />);

    const plate = screen.getByTestId('arrival-train-plate');
    const platePicture = plate.closest('picture');
    expect(platePicture).not.toBeNull();
    expect(platePicture?.querySelector('source[type="image/avif"]')).toHaveAttribute(
      'srcset',
      '/images/wedding/train-arrival-wide-960.avif 960w, /images/wedding/train-arrival-wide-1920.avif 1920w',
    );
    expect(platePicture?.querySelector('source[type="image/webp"]')).toHaveAttribute(
      'srcset',
      '/images/wedding/train-arrival-wide-960.webp 960w, /images/wedding/train-arrival-wide-1920.webp 1920w',
    );
    expect(plate).toHaveAttribute('sizes', '(max-width: 900px) 96vw, min(67vw, 88rem)');

    for (const testId of ['arrival-paper-texture', 'arrival-railway-seal']) {
      const image = screen.getByTestId(testId);
      expect(image.closest('picture')?.querySelector('source[type="image/avif"]')).toHaveAttribute('srcset');
      expect(image.closest('picture')?.querySelector('source[type="image/webp"]')).toHaveAttribute('srcset');
    }
  });

  it('frames the arrival as an editorial platform ticket without changing the announcement data', () => {
    render(<TrainArrivalScene event={event} />);

    expect(screen.getByTestId('arrival-platform-ticket')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Посадка Анна Смирнова, ВАГОН №4' })).toBeInTheDocument();
    expect(screen.getByTestId('arrival-editorial-seal')).toBeInTheDocument();
    const seal = screen.getByTestId('arrival-railway-seal');
    expect(seal).toHaveAttribute('src', '/images/ticket/railway-seal.png');
    expect(seal).toHaveAttribute('alt', '');
    expect(seal).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('PLATFORM ANNOUNCEMENT')).toBeInTheDocument();
    expect(screen.getByText('PASSENGER ACCEPTED')).toBeInTheDocument();
  });
});
