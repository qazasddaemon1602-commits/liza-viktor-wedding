import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeddingRailwayEmblem } from './WeddingRailwayEmblem';

describe('WeddingRailwayEmblem', () => {
  it('renders an original decorative railway mark without exposing interactive UI', () => {
    render(<WeddingRailwayEmblem className="test-emblem" />);

    const emblem = screen.getByTestId('wedding-railway-emblem');
    expect(emblem).toHaveClass('test-emblem');
    expect(emblem).toHaveAttribute('aria-hidden', 'true');
  });
});
