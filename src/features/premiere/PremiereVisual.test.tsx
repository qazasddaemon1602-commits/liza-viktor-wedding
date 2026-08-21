import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PremiereCountdown } from './PremiereCountdown';
import { PremiereStandbyScreen } from '../screen/premiere/PremiereStandbyScreen';

describe('Premiere editorial visual layer', () => {
  it('renders cinematic Russian standby copy with a decorative editorial frame', () => {
    render(<PremiereStandbyScreen />);

    expect(screen.getByTestId('premiere-standby')).toBeInTheDocument();
    expect(screen.getByText('ЛИЗА × ВИКТОР · 30.08.2026')).toBeInTheDocument();
    expect(screen.getByText('ПРЕМЬЕРА')).toBeInTheDocument();
    expect(screen.getByText('СКОРО НА ЭКРАНЕ')).toBeInTheDocument();
    expect(screen.queryByText('PREMIERE COMING SOON')).not.toBeInTheDocument();

    const frame = screen.getByTestId('premiere-editorial-frame');
    expect(frame).toBeInTheDocument();
    expect(frame).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps the countdown copy and adds an aria-hidden film-leader structure', () => {
    render(<PremiereCountdown number={7} />);

    expect(screen.getByText('ПРЕМЬЕРА ЧЕРЕЗ')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('FILM 01')).toBeInTheDocument();

    const leader = screen.getByTestId('premiere-film-leader');
    expect(leader).toBeInTheDocument();
    expect(leader).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('premiere-editorial-frame')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders no zero frame', () => {
    const { container } = render(<PremiereCountdown number={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

