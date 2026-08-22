import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BunkerResultsPlayer } from './BunkerResultsPlayer';

const model = {
  finishTimeSeconds: 742,
  emergencyOpen: false,
  characters: { active: 1, saved: 16, excluded: 3 },
  archiveFound: 4,
  resourcesRemaining: 7,
  resourcesUsed: 5,
  tradesCompleted: 2,
  wrongAttempts: 1,
  hintsUsed: 1,
  skillsUsed: 4,
  missionsCompleted: 6,
  missionsTotal: 6,
  coordinationScore: 91,
};

describe('BunkerResultsPlayer', () => {
  it('gives a phone user a simple ending with the most important result first', () => {
    render(<BunkerResultsPlayer model={model} />);
    expect(screen.getByRole('region', { name: 'Итоги Бункера' })).toHaveTextContent('БУНКЕР ОТКРЫТ');
    expect(screen.getByText('91 / 100')).toBeInTheDocument();
    expect(screen.getByText(/ваш состав справился/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
