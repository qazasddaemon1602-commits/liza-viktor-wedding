import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PremiereCountdown } from './PremiereCountdown';

describe('PremiereCountdown', () => {
  it('renders the cinematic countdown caption and current number', () => {
    render(<PremiereCountdown number={7} />);

    expect(screen.getByText('ПРЕМЬЕРА ЧЕРЕЗ')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('marks the final three seconds for restrained visual intensification', () => {
    const { container } = render(<PremiereCountdown number={3} />);

    expect(container.firstElementChild).toHaveClass('premiere-countdown-final');
  });

  it('never renders a zero frame after the countdown finishes', () => {
    const { container } = render(<PremiereCountdown number={null} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
