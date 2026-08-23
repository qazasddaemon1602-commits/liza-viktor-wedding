import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BunkerEmergencyScene } from './BunkerEmergencyScene';

describe('BunkerEmergencyScene', () => {
  it('keeps the Russian scenario copy and timer', () => {
    render(<BunkerEmergencyScene remainingSeconds={1800} />);

    expect(screen.getByTestId('bunker-emergency-scene')).toBeInTheDocument();
    expect(screen.getByText('ПОЕЗД ИЗМЕНИЛ МАРШРУТ.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'БУНКЕР' })).toBeInTheDocument();
    expect(screen.getByText('ЕДИНСТВЕННАЯ БЕЗОПАСНАЯ ТОЧКА')).toBeInTheDocument();
    expect(screen.getByTestId('bunker-timer')).toHaveTextContent('30:00');
    expect(screen.queryByRole('button', { name: /ВКЛЮЧИТЬ ТРЕВОГУ/i })).not.toBeInTheDocument();
  });

  it('uses the generated tunnel map instead of an inline SVG schematic', () => {
    render(<BunkerEmergencyScene remainingSeconds={600} />);

    const schematic = screen.getByTestId('bunker-route-schematic');
    expect(schematic).toBeInTheDocument();
    expect(schematic.tagName).toBe('PICTURE');
    expect(schematic).toHaveAttribute('aria-hidden', 'true');
    expect(schematic.querySelector('img')).toHaveAttribute(
      'src',
      '/images/bunker/tunnel-map-master.png',
    );
    expect(document.querySelector('.bunker-emergency svg')).not.toBeInTheDocument();
  });

  it('adds Viktor in the driver cab as a story-only route insert', () => {
    render(<BunkerEmergencyScene remainingSeconds={600} />);

    const route = screen.getByRole('img', { name: 'Виктор ведёт поезд по ночному маршруту к Бункеру' });
    expect(route).toHaveAttribute('src', '/images/bunker/story/viktor-route.webp');
    expect(route).toHaveAttribute('width', '1536');
    expect(route).toHaveAttribute('height', '1024');
    expect(route.closest('picture')?.querySelector('source[type="image/avif"]')).toHaveAttribute(
      'srcset',
      '/images/bunker/story/viktor-route.avif',
    );
    fireEvent.error(route);
    expect(screen.queryByRole('img', { name: /Виктор ведёт поезд/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('bunker-timer')).toHaveTextContent('10:00');
  });

  it('renders the archival index marks as aria-hidden', () => {
    render(<BunkerEmergencyScene remainingSeconds={600} />);

    const index = screen.getByTestId('bunker-archive-index');
    expect(index).toBeInTheDocument();
    expect(index).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses the text-free train-tunnel plate as responsive decorative TV imagery', () => {
    render(<BunkerEmergencyScene remainingSeconds={900} />);

    const artwork = screen.getByTestId('bunker-emergency-artwork');
    expect(artwork.tagName).toBe('PICTURE');
    expect(artwork).toHaveAttribute('aria-hidden', 'true');
    expect(artwork.querySelector('source[type="image/avif"]')).toHaveAttribute(
      'srcset',
      '/images/bunker/train-tunnel-960.avif 960w, /images/bunker/train-tunnel-1920.avif 1920w',
    );
    expect(artwork.querySelector('source[type="image/webp"]')).toHaveAttribute(
      'srcset',
      '/images/bunker/train-tunnel-960.webp 960w, /images/bunker/train-tunnel-1920.webp 1920w',
    );
    const image = artwork.querySelector('img');
    expect(image).toHaveAttribute('src', '/images/bunker/train-tunnel.png');
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('width', '1920');
    expect(image).toHaveAttribute('height', '1080');
  });

  it('holds the arrival state at 00:00', () => {
    render(<BunkerEmergencyScene remainingSeconds={0} />);

    expect(screen.getByTestId('bunker-timer')).toHaveTextContent('00:00');
    expect(screen.getByText('ПРИБЫТИЕ · БУНКЕР')).toBeInTheDocument();
    expect(screen.getByText('ТОЧКА ДОСТИГНУТА')).toBeInTheDocument();
  });

  it('runs one blackout and sync tear before the masked title reveal', () => {
    render(<BunkerEmergencyScene remainingSeconds={1800} motionPreference="full" />);

    expect(screen.getByTestId('bunker-blackout')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('bunker-sync-tear')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('БУНКЕР')).toHaveClass('bunker-emergency__title-reveal');
  });

  it('omits decorative transition layers when reduced motion is preferred', () => {
    render(<BunkerEmergencyScene remainingSeconds={1800} motionPreference="reduced" />);

    expect(screen.getByTestId('bunker-emergency-scene')).toHaveAttribute('data-motion', 'reduced');
    expect(screen.queryByTestId('bunker-blackout')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bunker-sync-tear')).not.toBeInTheDocument();
  });
});
