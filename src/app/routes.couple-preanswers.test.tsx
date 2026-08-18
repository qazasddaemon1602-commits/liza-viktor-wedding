import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../features/quiz/CouplePreanswersPage', () => ({
  CouplePreanswersPage: () => <div>REAL COUPLE PREANSWER FLOW</div>,
}));

import { AppRoutes, routePaths } from './routes';

describe('/couple-preanswers route', () => {
  it('renders the real one-time couple answer flow and is part of the route registry', () => {
    render(
      <MemoryRouter initialEntries={['/couple-preanswers?token=secret']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByText('REAL COUPLE PREANSWER FLOW')).toBeInTheDocument();
    expect(routePaths).toContain('/couple-preanswers');
  });
});
