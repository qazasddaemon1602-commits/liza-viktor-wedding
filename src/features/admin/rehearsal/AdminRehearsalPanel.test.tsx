import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminRehearsalPanel } from './AdminRehearsalPanel';

const serverNow = '2026-08-19T03:30:00.000Z';

type ScreenPresence = {
  screenId: string;
  videoReady: boolean;
  audioArmed: boolean;
};

const configuredPremiere = {
  status: 'idle' as const,
  configured: true as const,
  mediaUrl: 'https://example.com/ring.mp4',
  durationSeconds: 623,
  startAt: null,
  playbackAnchorAt: null,
  playbackOffsetSeconds: 0,
  positionSeconds: 0,
  countdownSeconds: 10,
  countdownSoundEnabled: true,
  serverNow,
};

const unconfiguredPremiere = {
  status: 'idle' as const,
  configured: false as const,
  serverNow,
  countdownSoundEnabled: true,
  countdownSeconds: 10,
};

describe('AdminRehearsalPanel', () => {
  it('shows the five rehearsal shortcuts with domain-safe relative routes', () => {
    render(<AdminRehearsalPanel />);

    expect(screen.getByRole('heading', { name: 'РЕПЕТИЦИЯ' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ОТКРЫТЬ ТВ' })).toHaveAttribute('href', '/screen');
    expect(screen.getByRole('link', { name: 'РЕГИСТРАЦИЯ ГОСТЯ' })).toHaveAttribute('href', '/join');
    expect(screen.getByRole('link', { name: 'КВИЗ' })).toHaveAttribute('href', '/play');
    expect(screen.getByRole('link', { name: 'MK' })).toHaveAttribute('href', '/mortal-kombat');
    expect(screen.getByRole('link', { name: 'MK НА ТВ' })).toHaveAttribute('href', '/mortal-kombat/screen');
  });

  it('shows rehearsal blockers when technical or content readiness is missing', async () => {
    render(
      <AdminRehearsalPanel
        eventId="event-1"
        currentModule="idle"
        expectedScreenCount={2}
        premiere={{
          load: vi.fn().mockResolvedValue(unconfiguredPremiere),
        }}
        couplePreanswers={{
          load: vi.fn().mockResolvedValue({
            status: 'active',
            answeredCount: 2,
            totalCount: 5,
            issuedAt: serverNow,
            finalizedAt: null,
          }),
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('ЕСТЬ БЛОКЕРЫ')).toBeInTheDocument();
    });

    expect(screen.getByText('ТВ · 0 / 2')).toBeInTheDocument();
    expect(screen.getByText('ВИДЕО · НЕ ГОТОВО')).toBeInTheDocument();
    expect(screen.getByText('ЗВУК · НЕ ГОТОВ')).toBeInTheDocument();
    expect(screen.getByText('ПРЕМЬЕРА · НЕ НАСТРОЕНА')).toBeInTheDocument();
    expect(screen.getByText('ОТВЕТЫ ПАРЫ · 2 / 5')).toBeInTheDocument();
    expect(screen.getByText('БУНКЕР · ГОТОВ')).toBeInTheDocument();
    expect(screen.getByText('MK · ГОТОВ')).toBeInTheDocument();
  });

  it('reports ready when two screens, video, audio, premiere and couple answers are ready', async () => {
    let onPresence: ((presence: ScreenPresence) => void) | undefined;

    render(
      <AdminRehearsalPanel
        eventId="event-1"
        currentModule="idle"
        expectedScreenCount={2}
        premiere={{
          load: vi.fn().mockResolvedValue(configuredPremiere),
          subscribeScreenPresence: (callback: (presence: ScreenPresence) => void) => {
            onPresence = callback;
            return () => undefined;
          },
        }}
        couplePreanswers={{
          load: vi.fn().mockResolvedValue({
            status: 'finalized',
            answeredCount: 5,
            totalCount: 5,
            issuedAt: serverNow,
            finalizedAt: serverNow,
          }),
        }}
      />,
    );

    await waitFor(() => expect(onPresence).toBeTypeOf('function'));

    act(() => {
      onPresence?.({ screenId: 'tv-main', videoReady: true, audioArmed: true });
      onPresence?.({ screenId: 'tv-second', videoReady: true, audioArmed: true });
    });

    await waitFor(() => {
      expect(screen.getByText('ГОТОВО К РЕПЕТИЦИИ')).toBeInTheDocument();
    });

    expect(screen.getByText('ТВ · 2 / 2')).toBeInTheDocument();
    expect(screen.getByText('ВИДЕО · ГОТОВО')).toBeInTheDocument();
    expect(screen.getByText('ЗВУК · ГОТОВ')).toBeInTheDocument();
    expect(screen.getByText('ПРЕМЬЕРА · ГОТОВА')).toBeInTheDocument();
    expect(screen.getByText('ОТВЕТЫ ПАРЫ · ГОТОВЫ')).toBeInTheDocument();
    expect(screen.getByText('БУНКЕР · ГОТОВ')).toBeInTheDocument();
    expect(screen.getByText('MK · ГОТОВ')).toBeInTheDocument();
  });
});
