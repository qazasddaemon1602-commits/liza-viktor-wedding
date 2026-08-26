// @ts-expect-error Vitest runs this CSS contract in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IlyaSongMiniPlayer } from './IlyaSongMiniPlayer';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const css = readFileSync(`${runtime.process.cwd()}/src/styles/wedding-live.css`, 'utf8');

describe('IlyaSongMiniPlayer layout', () => {
  it('stays as a compact fixed notification on the opposite side from reactions', () => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
    try {
      render(<IlyaSongMiniPlayer song={{
        id: 'song-1',
        kind: 'ilya_song',
        createdAt: '2026-08-26T18:00:00Z',
        action: 'play',
        title: 'Песня про Илью',
        artist: 'Посажёный отец',
        durationMs: 233080,
      }} />);
      const player = screen.getByRole('status', { name: 'Сейчас играет песня про Илью' });
      const computed = getComputedStyle(player);
      expect(computed.position).toBe('fixed');
      expect(computed.left).not.toBe('auto');
      expect(computed.right).toBe('auto');
      expect(computed.pointerEvents).toBe('none');
      expect(Number.parseInt(computed.zIndex, 10)).toBeGreaterThanOrEqual(5000);
    } finally {
      style.remove();
    }
  });
});
