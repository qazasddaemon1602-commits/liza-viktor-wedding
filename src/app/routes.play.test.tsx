import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../features/quiz/GuestQuizPage', () => ({
  GuestQuizPage: () => <div>REAL GUEST QUIZ FLOW</div>,
}));

import { AppRoutes } from './routes';

describe('/play route', () => {
  it('renders the real guest quiz flow instead of the placeholder', () => {
    render(
      <MemoryRouter initialEntries={['/play']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByText('REAL GUEST QUIZ FLOW')).toBeInTheDocument();
    expect(screen.queryByText('Здесь появится активный вопрос.')).not.toBeInTheDocument();
  });
});
