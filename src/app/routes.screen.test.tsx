import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../features/screen/IdleRegistrationScreen', () => ({
  IdleRegistrationScreen: ({ joinUrl }: { joinUrl: string }) => (
    <div data-testid="real-idle-screen">{joinUrl}</div>
  ),
}));

import { AppRoutes } from './routes';

describe('/screen route', () => {
  it('renders the idle registration screen with the public /join URL by default', () => {
    render(
      <MemoryRouter initialEntries={['/screen']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('real-idle-screen')).toHaveTextContent(
      new URL('/join', window.location.origin).toString(),
    );
    expect(screen.queryByText('Презентационный режим без управляющих элементов.')).not.toBeInTheDocument();
  });
});
