import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BunkerEmergencyScene } from './BunkerEmergencyScene';

describe('BunkerEmergencyScene', () => {
  it('keeps the Russian scenario copy and timer', () => {
    render(<BunkerEmergencyScene remainingSeconds={1800} soundEnabled={false} soundArmed />);

    expect(screen.getByTestId('bunker-emergency-scene')).toBeInTheDocument();
    expect(screen.getByText('ПОЕЗД ИЗМЕНИЛ МАРШРУТ.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'БУНКЕР' })).toBeInTheDocument();
    expect(screen.getByText('ЕДИНСТВЕННАЯ БЕЗОПАСНАЯ ТОЧКА')).toBeInTheDocument();
    expect(screen.getByTestId('bunker-timer')).toHaveTextContent('30:00');
  });

  it('renders the decorative route schematic as aria-hidden', () => {
    render(<BunkerEmergencyScene remainingSeconds={600} soundEnabled={false} soundArmed />);

    const schematic = screen.getByTestId('bunker-route-schematic');
    expect(schematic).toBeInTheDocument();
    expect(schematic).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders the archival index marks as aria-hidden', () => {
    render(<BunkerEmergencyScene remainingSeconds={600} soundEnabled={false} soundArmed />);

    const index = screen.getByTestId('bunker-archive-index');
    expect(index).toBeInTheDocument();
    expect(index).toHaveAttribute('aria-hidden', 'true');
  });

  it('holds the arrival state at 00:00', () => {
    render(<BunkerEmergencyScene remainingSeconds={0} soundEnabled={false} soundArmed />);

    expect(screen.getByTestId('bunker-timer')).toHaveTextContent('00:00');
    expect(screen.getByText('ПРИБЫТИЕ · БУНКЕР')).toBeInTheDocument();
    expect(screen.getByText('ТОЧКА ДОСТИГНУТА')).toBeInTheDocument();
  });
});
