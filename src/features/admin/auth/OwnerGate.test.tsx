import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OwnerGate } from './OwnerGate';

describe('OwnerGate', () => {
  it('does not render admin content for a non-owner session', async () => {
    render(
      <OwnerGate resolveAccess={vi.fn().mockResolvedValue('denied')}>
        <div>SECRET ADMIN</div>
      </OwnerGate>,
    );

    expect(await screen.findByText(/доступ запрещён/i)).toBeInTheDocument();
    expect(screen.queryByText('SECRET ADMIN')).not.toBeInTheDocument();
  });

  it('renders admin content only after owner access is confirmed', async () => {
    render(
      <OwnerGate resolveAccess={vi.fn().mockResolvedValue('owner')}>
        <div>SECRET ADMIN</div>
      </OwnerGate>,
    );

    expect(await screen.findByText('SECRET ADMIN')).toBeInTheDocument();
  });
});
