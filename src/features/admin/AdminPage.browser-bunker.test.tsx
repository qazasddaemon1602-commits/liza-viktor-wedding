import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: () => Promise.resolve({
        data: { session: { user: { id: 'owner-1' } } },
        error: null,
      }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => undefined } },
      }),
      signInWithPassword: () => Promise.resolve({ error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
  }),
}));

vi.mock('./AdminShell', () => ({
  AdminShell: () => <div>ADMIN SHELL</div>,
}));

vi.mock('./bunker/AdminBunkerDock', () => ({
  AdminBunkerDock: ({ dependencies }: { dependencies?: unknown }) => (
    <div
      data-testid="bunker-dock"
      data-injected-dependencies={dependencies ? 'yes' : 'no'}
    />
  ),
}));

import { AdminPage } from './AdminPage';

describe('AdminPage production Bunker wiring', () => {
  it('lets the production Bunker dock create its complete browser dependencies', async () => {
    render(<AdminPage />);

    expect(await screen.findByText('ADMIN SHELL')).toBeInTheDocument();
    expect(screen.getByTestId('bunker-dock')).toHaveAttribute(
      'data-injected-dependencies',
      'no',
    );
  });
});
