// @ts-expect-error Vitest runs this CSS contract in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminWeddingLiveDock } from './AdminWeddingLiveDock';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const css = readFileSync(`${runtime.process.cwd()}/src/styles/wedding-live.css`, 'utf8');

describe('Admin wedding music player layout', () => {
  it('lays out every track as a readable row and keeps one full-width stop control', () => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
    try {
      render(
        <AdminWeddingLiveDock dependencies={{
          load: vi.fn().mockResolvedValue({ status: 'ok', open: true, count: 0, messages: [] }),
          setOpen: vi.fn(),
          publish: vi.fn(),
          controlIlyaSong: vi.fn(),
        }}>
          <main>АДМИНКА</main>
        </AdminWeddingLiveDock>,
      );

      const player = screen.getByRole('region', { name: 'Музыкальный плеер' });
      const tracks = player.querySelector('.admin-ilya-song-card__tracks');
      const stop = screen.getByRole('button', { name: 'Остановить песню на экране' });
      expect(getComputedStyle(tracks as Element).display).toBe('grid');
      expect(getComputedStyle(stop).gridColumn).toBe('1/-1');
    } finally {
      style.remove();
    }
  });
});
