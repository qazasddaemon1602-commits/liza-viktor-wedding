import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../features/registration/GuestJoinPage', () => ({
  GuestJoinPage: () => <div>REAL GUEST JOIN FLOW</div>,
}));

import { AppRoutes } from './routes';

describe('/join route', () => {
  it('renders the real guest join flow instead of a placeholder', () => {
    render(
      <MemoryRouter initialEntries={['/join']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByText('REAL GUEST JOIN FLOW')).toBeInTheDocument();
    expect(screen.queryByText('ПОЛУЧИТЬ БИЛЕТ')).not.toBeInTheDocument();
  });
});
