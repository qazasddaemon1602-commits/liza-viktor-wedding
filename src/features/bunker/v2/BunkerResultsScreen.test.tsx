import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BunkerResultsScreen } from './BunkerResultsScreen';

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

describe('BunkerResultsScreen', () => {
  it('turns the end of the game into a clear celebration instead of an internal state', () => {
    render(<BunkerResultsScreen model={model} />);
    expect(screen.getByRole('region', { name: 'Бункер открыт · итоги игры' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'БУНКЕР ОТКРЫТ' })).toBeInTheDocument();
    expect(screen.getByText('91 / 100')).toBeInTheDocument();
    expect(screen.getByText(/12:22/)).toBeInTheDocument();
    expect(screen.getByText(/16 персонажей спасено/i)).toBeInTheDocument();
    expect(screen.queryByText('4719')).not.toBeInTheDocument();
    expect(screen.queryByText('LV0830')).not.toBeInTheDocument();
  });
});
