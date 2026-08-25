import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
// @ts-expect-error Vitest runs this CSS contract in Node; the browser app omits Node types.
import { readFileSync } from 'node:fs';
import { FinalScreen } from './FinalScreen';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const weddingThemeCss = readFileSync(`${runtime.process.cwd()}/src/styles/bunker-wedding-theme.css`, 'utf8');

describe('FinalScreen', () => {
  it('shows the 30-minute emergency, public progress and never secret values', () => {
    render(<FinalScreen model={{ remainingSeconds: 1800, solved: 2, total: 5, wrongAttempts: 1, unlocked: false, hintLevel: 0 }} />);
    expect(screen.getByRole('heading', { name: /ЕДИНСТВЕННАЯ БЕЗОПАСНАЯ ТОЧКА — БУНКЕР/i })).toBeInTheDocument();
    expect(screen.getByText('2 / 5 ПАРАМЕТРОВ')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /лиза и виктор вместе после прибытия поезда/i })).not.toBeInTheDocument();
    expect(screen.queryByText('4719')).not.toBeInTheDocument();
    expect(screen.queryByText('LV0830')).not.toBeInTheDocument();
  });

  it('uses the full content width after the spoiler image is removed', () => {
    const style = document.createElement('style');
    style.textContent = weddingThemeCss;
    document.head.append(style);

    try {
      render(<FinalScreen model={{ remainingSeconds: 1800, solved: 2, total: 5, wrongAttempts: 0, unlocked: false, hintLevel: 0 }} />);
      const content = screen.getByRole('region', { name: 'Финал · общий экран' }).querySelector('.bunker-v2-final-screen__content');
      expect(content).not.toBeNull();
      expect(getComputedStyle(content!).gridTemplateColumns).toBe('1fr');
    } finally {
      style.remove();
    }
  });
});
