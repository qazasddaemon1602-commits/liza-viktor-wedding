import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminWeddingLiveDock } from './AdminWeddingLiveDock';

describe('AdminWeddingLiveDock', () => {
  it('shows message count and can close and publish the capsule', async () => {
    const load = vi.fn().mockResolvedValue({
      status: 'ok',
      open: true,
      count: 2,
      messages: [
        { guestId: 'g1', displayName: 'Анна П.', carriage: 'ВАГОН №2', message: 'Счастья!', updatedAt: '2026-08-24T00:00:00Z' },
        { guestId: 'g2', displayName: 'Денис К.', carriage: 'ВАГОН №1', message: 'Любви!', updatedAt: '2026-08-24T00:01:00Z' },
      ],
    });
    const setOpen = vi.fn().mockResolvedValue({ status: 'ok', open: false });
    const publish = vi.fn().mockResolvedValue({ status: 'published', eventId: 'screen-1', publishedCount: 2 });

    render(
      <AdminWeddingLiveDock dependencies={{ load, setOpen, publish }}>
        <div>АДМИНКА</div>
      </AdminWeddingLiveDock>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Открыть LIVE+ пульт' }));
    expect(await screen.findByText('2 СООБЩЕНИЯ')).toBeInTheDocument();
    expect(screen.getByText('Анна П.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ЗАКРЫТЬ ПРИЁМ' }));
    await waitFor(() => expect(setOpen).toHaveBeenCalledWith(false));

    fireEvent.click(screen.getByRole('button', { name: 'ПОКАЗАТЬ КАПСУЛУ НА ТВ' }));
    await waitFor(() => expect(publish).toHaveBeenCalledWith(7));
  });
});
