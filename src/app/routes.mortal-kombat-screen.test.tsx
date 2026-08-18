import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../features/mortalKombat/MkScreenPage', () => ({
  MkScreenPage: () => <div>REAL MK PROJECTOR</div>,
}));

import { AppRoutes } from './routes';

describe('/mortal-kombat/screen route', () => {
  it('renders the real live tournament projector instead of a placeholder', () => {
    render(
      <MemoryRouter initialEntries={['/mortal-kombat/screen']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByText('REAL MK PROJECTOR')).toBeInTheDocument();
    expect(screen.queryByText('Большой экран турнирной сетки.')).not.toBeInTheDocument();
  });
});