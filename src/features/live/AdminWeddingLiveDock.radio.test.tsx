import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminWeddingLiveDock } from './AdminWeddingLiveDock';

describe('AdminWeddingLiveDock radio', () => {
  it('sends a wedding radio preset from LIVE+', async () => {
    const sendRadio = vi.fn().mockResolvedValue({
      status: 'sent', eventId: 'radio-1', preset: 'dance', durationMs: 12000,
    });
    render(
      <AdminWeddingLiveDock dependencies={{
        load: vi.fn().mockResolvedValue({ status: 'ok', open: true, count: 0, messages: [] }),
        setOpen: vi.fn(),
        publish: vi.fn(),
        sendRadio,
      }}>
        <div>АДМИНКА</div>
      </AdminWeddingLiveDock>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Открыть LIVE+ пульт' }));
    await screen.findByText('РАДИО СОСТАВА');
    fireEvent.click(screen.getByRole('button', { name: 'Эфир: ТАНЦПОЛ' }));
    await waitFor(() => expect(sendRadio).toHaveBeenCalledWith('dance'));
    expect(await screen.findByText('ЭФИР ОТПРАВЛЕН · ТАНЦПОЛ')).toBeInTheDocument();
  });

  it('keeps the Ilya song controls at the bottom of the admin and sends play or stop to the screen', async () => {
    const controlIlyaSong = vi.fn().mockResolvedValue({
      status: 'ok', eventId: 'song-1', action: 'play',
    });
    render(
      <AdminWeddingLiveDock dependencies={{
        load: vi.fn().mockResolvedValue({ status: 'ok', open: true, count: 0, messages: [] }),
        setOpen: vi.fn(),
        publish: vi.fn(),
        controlIlyaSong,
      }}>
        <main>АДМИНКА</main>
      </AdminWeddingLiveDock>,
    );

    const card = screen.getByRole('region', { name: 'Песня про Илью' });
    expect(card.compareDocumentPosition(screen.getByText('АДМИНКА')) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Включить песню на экране' }));
    await waitFor(() => expect(controlIlyaSong).toHaveBeenCalledWith('play'));
    expect(await screen.findByText('ПЕСНЯ ИГРАЕТ НА ЭКРАНЕ')).toBeInTheDocument();

    controlIlyaSong.mockResolvedValueOnce({ status: 'ok', eventId: 'song-2', action: 'stop' });
    fireEvent.click(screen.getByRole('button', { name: 'Остановить песню на экране' }));
    await waitFor(() => expect(controlIlyaSong).toHaveBeenCalledWith('stop'));
  });
});
