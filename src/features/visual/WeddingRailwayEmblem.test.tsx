import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeddingRailwayEmblem } from './WeddingRailwayEmblem';

describe('WeddingRailwayEmblem', () => {
  it('renders an original decorative railway emblem', () => {
    render(<WeddingRailwayEmblem />);

    expect(screen.getByTestId('wedding-railway-emblem')).toBeInTheDocument();
  });

  it('accepts a custom class name', () => {
    render(<WeddingRailwayEmblem className="custom-emblem" />);

    expect(screen.getByTestId('wedding-railway-emblem')).toHaveClass('custom-emblem');
  });
});
