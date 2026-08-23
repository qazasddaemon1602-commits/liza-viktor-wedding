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
});
