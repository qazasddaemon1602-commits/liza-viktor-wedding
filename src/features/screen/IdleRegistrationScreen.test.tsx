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
    const qr = screen.getByTestId('registration-qr');
    expect(qr).toHaveAttribute('data-join-url', joinUrl);
    expect(qr.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByText(joinUrl)).toBeInTheDocument();
    expect(screen.getByTestId('idle-ticket-body')).toBeInTheDocument();
    expect(screen.getByTestId('idle-ticket-stub')).toBeInTheDocument();
    expect(screen.getByText('TRAIN No. LV-830')).toBeInTheDocument();
    expect(screen.queryByText(/ПЯТЬ ВАГОНОВ/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('wedding-railway-emblem')).not.toBeInTheDocument();
    expect(screen.queryByText(/список гостей/i)).not.toBeInTheDocument();
  });

  it('keeps generated ticket artwork decorative while the live QR remains semantic', () => {
    const joinUrl = 'https://wedding.example/join';

    render(<IdleRegistrationScreen joinUrl={joinUrl} />);

    const artwork = [
      ['idle-ticket-paper-texture', '/images/ticket/paper-texture.png'],
      ['idle-ticket-railway-seal', '/images/ticket/railway-seal.png'],
      ['idle-ticket-locomotive-art', '/images/ticket/locomotive-engraving.png'],
      ['idle-ticket-skyline-art', '/images/ticket/tyumen-skyline-engraving.png'],
    ] as const;

    for (const [testId, src] of artwork) {
      const image = screen.getByTestId(testId);
      expect(image).toHaveAttribute('src', src);
      expect(image).toHaveAttribute('alt', '');
      expect(image).toHaveAttribute('aria-hidden', 'true');
    }

    expect(screen.getByTestId('registration-qr')).toHaveAttribute('data-join-url', joinUrl);
  });

  it('offers modern responsive formats for every decorative ticket layer', () => {
    render(<IdleRegistrationScreen joinUrl="https://wedding.example/join" />);

    const responsiveArtwork = [
      ['idle-ticket-paper-texture', '/images/ticket/paper-texture-512.avif 512w, /images/ticket/paper-texture-1024.avif 1024w'],
      ['idle-ticket-railway-seal', '/images/ticket/railway-seal-128.avif 128w, /images/ticket/railway-seal-256.avif 256w'],
      ['idle-ticket-locomotive-art', '/images/ticket/locomotive-engraving-480.avif 480w, /images/ticket/locomotive-engraving-960.avif 960w'],
      ['idle-ticket-skyline-art', '/images/ticket/tyumen-skyline-engraving-960.avif 960w, /images/ticket/tyumen-skyline-engraving-1600.avif 1600w'],
    ] as const;

    for (const [testId, avifSrcSet] of responsiveArtwork) {
      const image = screen.getByTestId(testId);
      const picture = image.closest('picture');
      expect(picture, `${testId} must be delivered by a picture element`).not.toBeNull();
      expect(picture?.querySelector('source[type="image/avif"]')).toHaveAttribute('srcset', avifSrcSet);
      expect(picture?.querySelector('source[type="image/webp"]')).toHaveAttribute('srcset');
      expect(image).toHaveAttribute('sizes');
    }
  });
});
