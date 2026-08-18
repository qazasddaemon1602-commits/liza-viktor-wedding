import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  AdminCouplePreanswersPanel,
  type AdminCouplePreanswersPanelDependencies,
} from './AdminCouplePreanswersPanel';

function deps(overrides: Partial<AdminCouplePreanswersPanelDependencies> = {}): AdminCouplePreanswersPanelDependencies {
  return {
    load: vi.fn().mockResolvedValue({
      status: 'not_issued',
      answeredCount: 0,
      totalCount: 30,
      issuedAt: null,
      finalizedAt: null,
    }),
    issue: vi.fn().mockResolvedValue({ status: 'issued', token: 'secret-token' }),
    buildAccessUrl: (token) => `https://wedding.test/couple-preanswers?token=${token}`,
    ...overrides,
  };
}

describe('AdminCouplePreanswersPanel', () => {
  it('shows that the private link has not been issued yet', async () => {
    render(<AdminCouplePreanswersPanel eventId="event-1" dependencies={deps()} />);

    expect(await screen.findByText('ССЫЛКА ЕЩЁ НЕ ВЫДАНА')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'СОЗДАТЬ ССЫЛКУ' })).toBeEnabled();
    expect(screen.queryByText(/secret-token/)).not.toBeInTheDocument();
  });

  it('shows completion progress without exposing any answer values', async () => {
    render(<AdminCouplePreanswersPanel eventId="event-1" dependencies={deps({
      load: vi.fn().mockResolvedValue({
        status: 'active',
        answeredCount: 12,
        totalCount: 30,
        issuedAt: '2026-08-18T10:00:00Z',
        finalizedAt: null,
      }),
    })} />);

    expect(await screen.findByText('12 / 30 ОТВЕЧЕНО')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ПЕРЕВЫДАТЬ ССЫЛКУ' })).toBeEnabled();
    expect(screen.queryByText(/выбрали лиз/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/выбрали виктор/i)).not.toBeInTheDocument();
  });

  it('issues a fresh URL and refreshes only the completion status', async () => {
    const load = vi.fn()
      .mockResolvedValueOnce({
        status: 'not_issued',
        answeredCount: 0,
        totalCount: 30,
        issuedAt: null,
        finalizedAt: null,
      })
      .mockResolvedValueOnce({
        status: 'active',
        answeredCount: 0,
        totalCount: 30,
        issuedAt: '2026-08-18T10:00:00Z',
        finalizedAt: null,
      });
    const issue = vi.fn().mockResolvedValue({ status: 'issued', token: 'secret-token' });

    render(<AdminCouplePreanswersPanel eventId="event-1" dependencies={deps({ load, issue })} />);

    fireEvent.click(await screen.findByRole('button', { name: 'СОЗДАТЬ ССЫЛКУ' }));

    await waitFor(() => expect(issue).toHaveBeenCalledWith('event-1'));
    expect(await screen.findByDisplayValue('https://wedding.test/couple-preanswers?token=secret-token')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Скопируйте ссылку сейчас. После обновления страницы секретный токен повторно не показывается.')).toBeInTheDocument();
  });

  it('locks link issuing after the couple has finalized all answers', async () => {
    render(<AdminCouplePreanswersPanel eventId="event-1" dependencies={deps({
      load: vi.fn().mockResolvedValue({
        status: 'finalized',
        answeredCount: 30,
        totalCount: 30,
        issuedAt: '2026-08-18T10:00:00Z',
        finalizedAt: '2026-08-19T09:30:00Z',
      }),
    })} />);

    expect(await screen.findByText('ОТВЕТЫ ЗАФИКСИРОВАНЫ')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ССЫЛКУ/ })).not.toBeInTheDocument();
  });
});
