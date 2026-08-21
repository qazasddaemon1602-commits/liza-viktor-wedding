import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../features/registration/GuestJoinPage', () => ({
  GuestJoinPage: () => createElement('h1', null, 'Регистрация'),
}));

import { AppRoutes, routePaths } from './routes';

describe('routePaths', () => {
  it('exposes the core guest, couple, private-role, admin, screen, premiere and tournament routes', () => {
    expect(routePaths).toEqual([
      '/',
      '/join',
      '/play',
      '/couple-preanswers',
      '/liza',
      '/viktor',
      '/admin',
      '/screen',
      '/screen/connect',
      '/premiere',
      '/mortal-kombat',
      '/mortal-kombat/screen',
    ]);
  });
});

describe('public routes', () => {
  it('renders the wedding home at the root while keeping registration at /join', () => {
    const { unmount } = render(createElement(
      MemoryRouter,
      { initialEntries: ['/'] },
      createElement(AppRoutes),
    ));

    expect(screen.getByRole('heading', { name: 'Лиза и Виктор' })).toBeInTheDocument();

    unmount();

    render(createElement(
      MemoryRouter,
      { initialEntries: ['/join'] },
      createElement(AppRoutes),
    ));

    expect(screen.getByRole('heading', { name: 'Регистрация' })).toBeInTheDocument();
  });
});
