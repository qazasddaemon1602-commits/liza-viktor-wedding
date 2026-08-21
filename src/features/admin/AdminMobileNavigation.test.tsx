import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminMobileNavigation } from './AdminMobileNavigation';

describe('AdminMobileNavigation', () => {
  it('offers direct 44px-safe anchors to live operations on a phone', () => {
    render(<AdminMobileNavigation />);

    expect(screen.getByRole('navigation', { name: 'Быстрая навигация по админке' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'СЕЙЧАС' })).toHaveAttribute('href', '#admin-now');
    expect(screen.getByRole('link', { name: 'ПРЕМЬЕРА' })).toHaveAttribute('href', '#admin-premiere');
    expect(screen.getByRole('link', { name: 'LIVE QUIZ' })).toHaveAttribute('href', '#admin-quiz');
    expect(screen.getByRole('link', { name: 'ТУРНИР' })).toHaveAttribute('href', '#admin-tournament');
    expect(screen.getByRole('link', { name: 'БУНКЕР' })).toHaveAttribute('href', '#admin-bunker');
    expect(screen.getByRole('link', { name: 'ГОСТИ' })).toHaveAttribute('href', '#admin-guests');
    expect(screen.getByRole('link', { name: 'СБРОС' })).toHaveAttribute('href', '#admin-reset');
  });
});
