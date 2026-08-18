import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FinalFiveRevealScene } from './FinalFiveRevealScene';

describe('FinalFiveRevealScene', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reveals guest result, then Liza, then Viktor, then the verdict', () => {
    render(
      <FinalFiveRevealScene
        state={{
          status: 'revealed',
          question: { id: 'f1', text: 'Кто главный?' },
          results: { liza: 20, viktor: 11, total: 31 },
          lizaAnswer: 'liza',
          viktorAnswer: 'viktor',
        }}
        stepMs={1000}
      />,
    );

    expect(screen.getByText('ЛИЗА 65%')).toBeInTheDocument();
    expect(screen.getByText('ВИКТОР 35%')).toBeInTheDocument();
    expect(screen.queryByText('ОТВЕТ ЛИЗЫ')).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('ОТВЕТ ЛИЗЫ')).toBeInTheDocument();
    expect(screen.getByText('ЛИЗА', { selector: '.final-five-reveal-answer-value' })).toBeInTheDocument();
    expect(screen.queryByText('ОТВЕТ ВИКТОРА')).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('ОТВЕТ ВИКТОРА')).toBeInTheDocument();
    expect(screen.getByText('ВИКТОР', { selector: '.final-five-reveal-answer-value' })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('СЕМЕЙНАЯ ДИСКУССИЯ ОФИЦИАЛЬНО ОТКРЫТА.')).toBeInTheDocument();
  });

  it('uses the matching verdict when both private answers agree', () => {
    render(
      <FinalFiveRevealScene
        state={{
          status: 'revealed',
          question: { id: 'f2', text: 'Кто первым мирится?' },
          results: { liza: 8, viktor: 22, total: 30 },
          lizaAnswer: 'viktor',
          viktorAnswer: 'viktor',
        }}
        stepMs={1000}
      />,
    );

    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByText('СОВПАЛИ. НЕВЕРОЯТНО.')).toBeInTheDocument();
  });
});
