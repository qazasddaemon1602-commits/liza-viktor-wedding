import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../features/admin/AdminPage', () => ({
  AdminPage: () => <div>REAL OWNER ADMIN</div>,
}));

import { AppRoutes } from './routes';

describe('/admin route', () => {
  it('renders the real owner admin page instead of a placeholder', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByText('REAL OWNER ADMIN')).toBeInTheDocument();
    expect(screen.queryByText('ПАНЕЛЬ УПРАВЛЕНИЯ')).not.toBeInTheDocument();
  });
});
