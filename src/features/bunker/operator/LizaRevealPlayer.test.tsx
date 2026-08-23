import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LizaRevealPlayer } from './LizaRevealPlayer';

describe('LizaRevealPlayer', () => {
  it('gives the phone a complete accessible reveal with a text-only media fallback', () => {
    render(<LizaRevealPlayer />);
    const reveal = screen.getByRole('region', { name: 'Лиза встречает поезд' });
    expect(reveal).toHaveTextContent('Сигнал принят. Поезд Виктора прибыл. Я ждала вас. — Лиза');
    expect(screen.getByRole('heading', { name: 'ЛИЗА' })).toBeInTheDocument();
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(reveal).toHaveTextContent('Сигнал принят. Поезд Виктора прибыл. Я ждала вас. — Лиза');
  });
});
