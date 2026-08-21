import { render, screen } from '@testing-library/react';
// @ts-expect-error Vitest runs this contract test in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { TrainArrivalScene } from './TrainArrivalScene';

const testRuntime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const weddingScenesCss = readFileSync(
  `${testRuntime.process.cwd()}/src/styles/wedding-scenes.css`,
  'utf8',
);

const event = {
  id: 'screen-event-1',
  kind: 'guest_registered' as const,
  createdAt: '2026-08-30T12:06:00+05:00',
  payload: {
    displayName: 'Анна Смирнова',
    carriage: {
      id: 'c4',
      number: 4,
      label: 'ВАГОН №4',
      accentHex: '#78806A',
      visualMark: '04',
    },
  },
};

describe('TrainArrivalScene', () => {
  it('moves one full four-carriage train with the whole announcement attached to its wagons', () => {
    const onSignal = vi.fn();

    render(<TrainArrivalScene event={event} onSignal={onSignal} />);

    const convoy = screen.getByTestId('arrival-convoy');
    expect(convoy).toContainElement(screen.getByTestId('arrival-train-sprite'));
    expect(convoy).toHaveAttribute('data-reduced-motion', 'static-pass');
    expect(screen.getByTestId('arrival-train-sprite')).toHaveAttribute(
      'src',
      '/images/wedding/arrival-train-sprite-v2.png',
    );
    expect(screen.getByTestId('arrival-train-smoke')).toHaveAttribute(
      'src',
      '/images/wedding/arrival-train-smoke-v2.png',
    );
    expect(screen.getByTestId('arrival-train-smoke')).toHaveAttribute('data-motion', 'rig-parallax');
    expect(screen.getAllByTestId(/arrival-wagon-copy-/)).toHaveLength(4);
    expect(screen.getByTestId('arrival-wagon-copy-1')).toHaveTextContent('ПРИБЫЛ НОВЫЙ ИГРОК');
    expect(screen.getByTestId('arrival-wagon-copy-2')).toHaveTextContent('Анна Смирнова');
    expect(screen.getByTestId('arrival-wagon-copy-3')).toHaveTextContent('ВАГОН №4');
    expect(screen.getByTestId('arrival-wagon-copy-4')).toHaveTextContent('ПОСАДКА · 30.08.2026');
    expect(screen.getByRole('heading', { name: 'Анна Смирнова' })).toBeInTheDocument();
    expect(screen.getByTestId('train-arrival-scene')).toHaveStyle({ '--arrival-accent': '#78806A' });
    expect(onSignal).toHaveBeenCalledTimes(1);
  });

  it('keeps the visual convoy decorative and duplicates the complete message only for assistive tech', () => {
    render(<TrainArrivalScene event={event} />);

    expect(screen.getByTestId('arrival-convoy')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('status')).toHaveClass('sr-only');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Прибыл новый игрок. Анна Смирнова. Назначен ВАГОН №4.',
    );
    expect(screen.queryByTestId('arrival-platform-ticket')).not.toBeInTheDocument();
  });

  it.each([390, 1920])(
    'fits and centers every wagon announcement inside a %ipx reduced-motion viewport',
    (viewportWidth) => {
      const reducedMotionStart = weddingScenesCss.lastIndexOf('@media (prefers-reduced-motion: reduce)');
      const reducedMotionCss = weddingScenesCss.slice(reducedMotionStart);
      const convoyRule = reducedMotionCss.match(/\.train-arrival__convoy\s*\{([^}]*)\}/)?.[1] ?? '';

      expect(reducedMotionStart).toBeGreaterThan(-1);
      expect(convoyRule).toMatch(/left:\s*50%/);
      expect(convoyRule).toMatch(/width:\s*min\(96vw,\s*80rem\)/);
      expect(convoyRule).toMatch(/transform:\s*translate3d\(-50%,\s*-50%,\s*0\)/);
      expect(convoyRule).not.toMatch(/translate3d\(-34vw/);

      const convoyWidth = Math.min(viewportWidth * 0.96, 80 * 16);
      const convoyLeft = (viewportWidth - convoyWidth) / 2;
      const wagonWidth = convoyWidth * 0.134;

      [41.2, 59.2, 77.1, 93.4].forEach((wagonCenterPercent) => {
        const wagonCenter = convoyLeft + convoyWidth * (wagonCenterPercent / 100);
        expect(wagonCenter - wagonWidth / 2).toBeGreaterThanOrEqual(0);
        expect(wagonCenter + wagonWidth / 2).toBeLessThanOrEqual(viewportWidth);
      });
    },
  );
});
