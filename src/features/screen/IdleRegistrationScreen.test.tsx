import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IdleRegistrationScreen } from './IdleRegistrationScreen';

describe('IdleRegistrationScreen', () => {
  it('shows the public registration QR as the default event screen', () => {
    const joinUrl = 'https://wedding.example/join';

    render(<IdleRegistrationScreen joinUrl={joinUrl} />);

    expect(screen.getByText('ЛИЗА × ВИКТОР')).toBeInTheDocument();
    expect(screen.getByText('30 АВГУСТА 2026')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ПОЛУЧИТЕ СВОЙ БИЛЕТ' })).toBeInTheDocument();
    expect(screen.getByText(/наведите камеру/i)).toBeInTheDocument();
    expect(screen.getByTestId('registration-qr')).toHaveAttribute('data-join-url', joinUrl);
    expect(screen.queryByText(/список гостей/i)).not.toBeInTheDocument();
  });
});
