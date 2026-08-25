import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FinalScreen } from './FinalScreen';

describe('FinalScreen', () => {
  it('shows the 30-minute emergency, public progress and never secret values', () => {
    render(<FinalScreen model={{ remainingSeconds: 1800, solved: 2, total: 5, wrongAttempts: 1, unlocked: false, hintLevel: 0 }} />);
    expect(screen.getByRole('heading', { name: /ЕДИНСТВЕННАЯ БЕЗОПАСНАЯ ТОЧКА — БУНКЕР/i })).toBeInTheDocument();
    expect(screen.getByText('2 / 5 ПАРАМЕТРОВ')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /лиза и виктор вместе после прибытия поезда/i })).toHaveAttribute(
      'src',
      '/images/bunker/story/couple-epilogue.webp',
    );
    expect(screen.queryByText('4719')).not.toBeInTheDocument();
    expect(screen.queryByText('LV0830')).not.toBeInTheDocument();
  });
});
