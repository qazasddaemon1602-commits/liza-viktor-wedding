import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IdleRegistrationScreen } from './IdleRegistrationScreen';

describe('IdleRegistrationScreen', () => {
  it('shows the public registration QR as a collectible railway wedding ticket', () => {
    const joinUrl = 'https://wedding.example/join';

    render(<IdleRegistrationScreen joinUrl={joinUrl} />);

    expect(screen.getByText('ЛИЗА × ВИКТОР')).toBeInTheDocument();
    expect(screen.getByText('30 АВГУСТА 2026')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ПОЛУЧИТЕ СВОЙ БИЛЕТ' })).toBeInTheDocument();
    expect(screen.getByText('НАВЕДИТЕ КАМЕРУ → ПОЛУЧИТЕ БИЛЕТ')).toBeInTheDocument();
    expect(screen.getByTestId('registration-qr')).toHaveAttribute('data-join-url', joinUrl);
    expect(screen.getByTestId('idle-ticket-body')).toBeInTheDocument();
    expect(screen.getByTestId('idle-ticket-stub')).toBeInTheDocument();
    expect(screen.getByText('TRAIN No. LV-830')).toBeInTheDocument();
    expect(screen.getByTestId('wedding-railway-emblem')).toBeInTheDocument();
    expect(screen.queryByText(/список гостей/i)).not.toBeInTheDocument();
  });
});
