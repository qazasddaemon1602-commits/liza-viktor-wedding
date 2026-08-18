import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../features/screen/ScreenPage', () => ({
  ScreenPage: ({ joinUrl, eventSlug }: { joinUrl: string; eventSlug?: string }) => (
    <div data-testid="realtime-screen-page">
      <span>{joinUrl}</span>
      <span>{eventSlug}</span>
    </div>
  ),
}));

import { AppRoutes } from './routes';

describe('/screen route', () => {
  it('renders the realtime presentation screen with the public /join URL', () => {
    render(
      <MemoryRouter initialEntries={['/screen']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    const route = screen.getByTestId('realtime-screen-page');
    expect(route).toHaveTextContent(new URL('/join', window.location.origin).toString());
    expect(route).toHaveTextContent('liza-viktor');
    expect(screen.queryByText('Презентационный режим без управляющих элементов.')).not.toBeInTheDocument();
  });
});
