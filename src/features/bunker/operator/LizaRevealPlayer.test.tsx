import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LizaRevealPlayer } from './LizaRevealPlayer';

describe('LizaRevealPlayer', () => {
  it('gives the phone a complete accessible reveal with a text-only media fallback', () => {
    render(<LizaRevealPlayer />);
    const reveal = screen.getByRole('region', { name: 'Лиза встречает поезд' });
    expect(reveal).toHaveTextContent('Сигнал принят. Поезд Виктора прибыл. Я ждала вас. — Лиза');
    expect(screen.getByRole('heading', { name: 'ЛИЗА' })).toBeInTheDocument();
    const portrait = screen.getByRole('img');
    expect(portrait).toHaveAttribute('width', '1122');
    expect(portrait).toHaveAttribute('height', '1402');
    expect(portrait.closest('picture')?.querySelector('source[type="image/avif"]')).toHaveAttribute(
      'srcset',
      '/images/bunker/story/liza-reveal.avif',
    );
    fireEvent.error(portrait);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(reveal).toHaveTextContent('Сигнал принят. Поезд Виктора прибыл. Я ждала вас. — Лиза');
  });
});
