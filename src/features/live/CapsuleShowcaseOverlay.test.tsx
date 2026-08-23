import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CapsuleShowcaseOverlay } from './CapsuleShowcaseOverlay';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('CapsuleShowcaseOverlay', () => {
  it('shows capsule messages one at a time in sequence', () => {
    render(<CapsuleShowcaseOverlay messages={[
      { displayName: 'Анна П.', carriage: 'ВАГОН №2', message: 'Первое сообщение' },
      { displayName: 'Денис К.', carriage: 'ВАГОН №1', message: 'Второе сообщение' },
    ]} stepMs={5000} />);

    expect(screen.getByText('Первое сообщение')).toBeInTheDocument();
    expect(screen.queryByText('Второе сообщение')).not.toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText('Второе сообщение')).toBeInTheDocument();
  });
});
