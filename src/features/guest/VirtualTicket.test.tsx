import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VirtualTicket } from './VirtualTicket';

const guest = {
  id: 'guest-31',
  firstName: 'Иван',
  lastName: 'Петров',
  affiliationType: 'viktor',
  affiliationDetail: 'коллега Виктора',
  ticketNumber: 'LV-031',
  carriage: {
    id: 'carriage-3',
    number: 3,
    label: 'ВАГОН №3',
    accentHex: '#7E3F3C',
    visualMark: '03',
  },
};

describe('VirtualTicket', () => {
  it('shows private guest identity, date, ticket number and carriage number', () => {
    render(<VirtualTicket guest={guest} />);

    expect(screen.getByText('Иван Петров')).toBeInTheDocument();
    expect(screen.getByText('30.08.2026')).toBeInTheDocument();
    expect(screen.getByText('LV-031')).toBeInTheDocument();
    expect(screen.getByText('ВАГОН №3')).toBeInTheDocument();
    expect(screen.queryByTestId('wedding-railway-emblem')).not.toBeInTheDocument();
  });

  it('exposes carriage color only as a secondary accent', () => {
    render(<VirtualTicket guest={guest} />);

    const ticket = screen.getByTestId('virtual-ticket');
    expect(ticket).toHaveStyle({ '--carriage-accent': '#7E3F3C' });
    expect(screen.getByText('ВАГОН №3')).toBeVisible();
  });

  it('loads the generated ticket artwork from stable local paths as decoration', () => {
    render(<VirtualTicket guest={guest} />);

    const artwork = [
      ['ticket-paper-texture', '/images/ticket/paper-texture.png'],
      ['ticket-railway-seal', '/images/ticket/railway-seal.png'],
      ['ticket-locomotive-art', '/images/ticket/locomotive-engraving.png'],
      ['ticket-skyline-art', '/images/ticket/tyumen-skyline-engraving.png'],
    ] as const;

    for (const [testId, src] of artwork) {
      const image = screen.getByTestId(testId);
      expect(image).toHaveAttribute('src', src);
      expect(image).toHaveAttribute('alt', '');
      expect(image).toHaveAttribute('aria-hidden', 'true');
    }

    expect(screen.getByText('Иван Петров')).toBeInTheDocument();
    expect(screen.getByText('LV-031')).toBeInTheDocument();
    expect(screen.getByText('ВАГОН №3')).toBeInTheDocument();
  });

  it('offers AVIF and WebP ticket artwork before the canonical PNG fallbacks', () => {
    render(<VirtualTicket guest={guest} />);

    const responsiveArtwork = [
      ['ticket-paper-texture', '/images/ticket/paper-texture-512.avif 512w, /images/ticket/paper-texture-1024.avif 1024w', '/images/ticket/paper-texture-512.webp 512w, /images/ticket/paper-texture-1024.webp 1024w'],
      ['ticket-railway-seal', '/images/ticket/railway-seal-128.avif 128w, /images/ticket/railway-seal-256.avif 256w', '/images/ticket/railway-seal-128.webp 128w, /images/ticket/railway-seal-256.webp 256w'],
      ['ticket-locomotive-art', '/images/ticket/locomotive-engraving-480.avif 480w, /images/ticket/locomotive-engraving-960.avif 960w', '/images/ticket/locomotive-engraving-480.webp 480w, /images/ticket/locomotive-engraving-960.webp 960w'],
      ['ticket-skyline-art', '/images/ticket/tyumen-skyline-engraving-960.avif 960w, /images/ticket/tyumen-skyline-engraving-1600.avif 1600w', '/images/ticket/tyumen-skyline-engraving-960.webp 960w, /images/ticket/tyumen-skyline-engraving-1600.webp 1600w'],
    ] as const;

    for (const [testId, avifSrcSet, webpSrcSet] of responsiveArtwork) {
      const image = screen.getByTestId(testId);
      const picture = image.closest('picture');
      expect(picture, `${testId} must be delivered by a picture element`).not.toBeNull();
      expect(picture?.querySelector('source[type="image/avif"]')).toHaveAttribute('srcset', avifSrcSet);
      expect(picture?.querySelector('source[type="image/webp"]')).toHaveAttribute('srcset', webpSrcSet);
      expect(image).toHaveAttribute('sizes');
    }
  });
});
