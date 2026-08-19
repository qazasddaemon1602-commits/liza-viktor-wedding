import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminRehearsalPanel } from './AdminRehearsalPanel';

describe('AdminRehearsalPanel', () => {
  it('shows the five rehearsal shortcuts with domain-safe relative routes', () => {
    render(<AdminRehearsalPanel />);

    expect(screen.getByRole('heading', { name: 'РЕПЕТИЦИЯ' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ОТКРЫТЬ ТВ' })).toHaveAttribute('href', '/screen');
    expect(screen.getByRole('link', { name: 'РЕГИСТРАЦИЯ ГОСТЯ' })).toHaveAttribute('href', '/join');
    expect(screen.getByRole('link', { name: 'КВИЗ' })).toHaveAttribute('href', '/play');
    expect(screen.getByRole('link', { name: 'MK' })).toHaveAttribute('href', '/mortal-kombat');
    expect(screen.getByRole('link', { name: 'MK НА ТВ' })).toHaveAttribute('href', '/mortal-kombat/screen');
  });
});
