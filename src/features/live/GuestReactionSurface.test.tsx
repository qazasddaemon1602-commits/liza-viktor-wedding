import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
// @ts-expect-error Vitest runs this CSS contract in Node; the browser app omits Node types.
import { readFileSync } from 'node:fs';
import { GuestReactionSurface } from './GuestReactionSurface';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const weddingLiveCss = readFileSync(`${runtime.process.cwd()}/src/styles/wedding-live.css`, 'utf8');

describe('GuestReactionSurface', () => {
  it('keeps the capsule launcher and reaction rail in one non-overlapping fixed stack', () => {
    const style = document.createElement('style');
    style.textContent = weddingLiveCss;
    document.head.append(style);

    try {
      render(<GuestReactionSurface><main>Экран гостя</main></GuestReactionSurface>);

      const launcher = screen.getByRole('button', { name: 'Открыть капсулу сообщений' });
      const reactions = screen.getByRole('complementary', { name: 'Живые реакции' });
      const stack = launcher.closest('.guest-live-controls');

      expect(stack).not.toBeNull();
      expect(stack).toContainElement(reactions);
      expect(getComputedStyle(stack!).position).toBe('fixed');
      expect(getComputedStyle(stack!).display).toBe('grid');
      expect(getComputedStyle(launcher).position).toBe('static');
      expect(getComputedStyle(reactions).position).toBe('static');
    } finally {
      style.remove();
    }
  });
});
