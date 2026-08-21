import { act, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/eventConfig', () => ({
  EVENT_DATE: '2026-09-14',
  EXPECTED_GUEST_COUNT: 40,
  WEDDING_DATE: '2026-09-13',
}));

import { WeddingHomePage } from './WeddingHomePage';

describe('WeddingHomePage event date configuration', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the wedding date separate from the second-day event and countdown boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-13T18:59:58.000Z'));

    const { container } = render(<WeddingHomePage />);

    const hero = container.querySelector('#top');
    const venue = container.querySelector('#venue');
    const gallery = container.querySelector('#gallery');

    expect(hero).not.toBeNull();
    expect(venue).not.toBeNull();
    expect(gallery).not.toBeNull();
    expect(within(hero as HTMLElement).getByText('13 сентября 2026')).toBeInTheDocument();
    expect(within(hero as HTMLElement).getByText('13·09')).toBeInTheDocument();
    expect(within(hero as HTMLElement).queryByText('14 сентября 2026')).not.toBeInTheDocument();
    expect(within(venue as HTMLElement).getByText('14 сентября 2026')).toBeInTheDocument();
    expect(within(gallery as HTMLElement).getByText('13 сентября 2026')).toBeInTheDocument();
    expect(within(gallery as HTMLElement).getByText('14 сентября 2026')).toBeInTheDocument();
    expect(screen.getByText('Тюмень · 14.09.2026')).toBeInTheDocument();
    expect(screen.getByText('13 сентября 2026 · Тюмень')).toBeInTheDocument();

    const timer = screen.getByRole('timer');
    expect(within(timer).getByText('02')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(within(timer).getByText('01')).toBeInTheDocument();
  });
});
