import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../features/mortalKombat/MortalKombatPage', () => ({
  MortalKombatPage: () => <div>REAL MORTAL KOMBAT FLOW</div>,
}));

import { AppRoutes } from './routes';

describe('/mortal-kombat route', () => {
  it('renders the real registered-guest tournament flow instead of a placeholder', () => {
    render(
      <MemoryRouter initialEntries={['/mortal-kombat']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByText('REAL MORTAL KOMBAT FLOW')).toBeInTheDocument();
    expect(screen.queryByText('Регистрация, текущий бой и турнирная сетка.')).not.toBeInTheDocument();
  });
});