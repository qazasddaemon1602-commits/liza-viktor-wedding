import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../features/quiz/FinalFiveRolePage', () => ({
  FinalFiveRolePage: ({ role }: { role: 'liza' | 'viktor' }) => <div>FINAL FIVE ROLE: {role}</div>,
}));

import { AppRoutes, routePaths } from './routes';

describe('private final-five role routes', () => {
  it('binds /liza to Liza role', () => {
    render(
      <MemoryRouter initialEntries={['/liza?token=secret']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByText('FINAL FIVE ROLE: liza')).toBeInTheDocument();
    expect(routePaths).toContain('/liza');
  });

  it('binds /viktor to Viktor role', () => {
    render(
      <MemoryRouter initialEntries={['/viktor?token=secret']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByText('FINAL FIVE ROLE: viktor')).toBeInTheDocument();
    expect(routePaths).toContain('/viktor');
  });
});
