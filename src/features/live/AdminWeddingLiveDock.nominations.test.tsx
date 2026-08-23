import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminWeddingLiveDock } from './AdminWeddingLiveDock';

describe('AdminWeddingLiveDock nominations', () => {
  it('shows only derived awards and publishes them to TV', async () => {
    const publishNominations = vi.fn().mockResolvedValue({ status: 'published', eventId: 'n1', publishedCount: 2 });
    render(
      <AdminWeddingLiveDock dependencies={{
        load: vi.fn().mockResolvedValue({ status: 'ok', open: true, count: 0, messages: [] }),
        setOpen: vi.fn(),
        publish: vi.fn(),
        loadNominations: vi.fn().mockResolvedValue({ status: 'ok', nominations: [
          { key: 'first_passenger', title: 'ПЕРВЫЙ ПАССАЖИР', recipient: 'Анна П.', detail: 'БИЛЕТ №001' },
          { key: 'detective_wagon', title: 'ДЕТЕКТИВ BK-17', recipient: 'ВАГОН №2', detail: 'ПЕРВЫМ ЗАКРЫЛ «ЧЁРНЫЙ ЯЩИК»' },
        ] }),
        publishNominations,
      }}>
        <div>АДМИНКА</div>
      </AdminWeddingLiveDock>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Открыть LIVE+ пульт' }));
    expect(await screen.findByText('ПЕРВЫЙ ПАССАЖИР')).toBeInTheDocument();
    expect(screen.getByText('Анна П.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ПОКАЗАТЬ НОМИНАЦИИ НА ТВ' }));
    await waitFor(() => expect(publishNominations).toHaveBeenCalledTimes(1));
  });
});
