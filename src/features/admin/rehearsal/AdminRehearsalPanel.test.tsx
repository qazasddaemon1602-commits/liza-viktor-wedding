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

  it('shows rehearsal blockers with live technical counts when readiness is missing', async () => {
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
    expect(screen.getByText('ВИДЕО · 0 / 2')).toBeInTheDocument();
    expect(screen.getByText('ЗВУК · 0 / 2')).toBeInTheDocument();
    expect(screen.getByText('ПРЕМЬЕРА · НЕ НАСТРОЕНА')).toBeInTheDocument();
    expect(screen.getByText('ОТВЕТЫ ПАРЫ · 2 / 5')).toBeInTheDocument();
    expect(screen.getByText('БУНКЕР · ГОТОВ')).toBeInTheDocument();
    expect(screen.getByText('MK · ГОТОВ')).toBeInTheDocument();
  });

  it('updates each readiness count as a projector heartbeat arrives', async () => {
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
      onPresence?.({ screenId: 'tv-main', videoReady: false, audioArmed: true });
    });

    expect(screen.getByText('ТВ · 1 / 2')).toBeInTheDocument();
    expect(screen.getByText('ВИДЕО · 0 / 2')).toBeInTheDocument();
    expect(screen.getByText('ЗВУК · 1 / 2')).toBeInTheDocument();
  });

  it('reports an unissued couple link explicitly and shows a clean production start state', async () => {
    render(
      <AdminRehearsalPanel
        eventId="event-1"
        currentModule="idle"
        registrationOpen
        compositionLocked={false}
        guestCount={0}
        premiere={{
          load: vi.fn().mockResolvedValue(configuredPremiere),
        }}
        couplePreanswers={{
          load: vi.fn().mockResolvedValue({
            status: 'not_issued',
            answeredCount: 0,
            totalCount: 30,
            issuedAt: null,
            finalizedAt: null,
          }),
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('ОТВЕТЫ ПАРЫ · ССЫЛКА НЕ ВЫДАНА')).toBeInTheDocument();
    });

    expect(screen.getByText('СТАРТ СОБЫТИЯ · ЧИСТО')).toBeInTheDocument();
    expect(screen.getByText('РЕГИСТРАЦИЯ · ОТКРЫТА')).toBeInTheDocument();
    expect(screen.getByText('ТЕСТОВЫЕ ГОСТИ · 0')).toBeInTheDocument();
    expect(screen.getByText('СОСТАВ · СВОБОДЕН')).toBeInTheDocument();
  });

  it('marks the production start state for review when rehearsal data remains', async () => {
    render(
      <AdminRehearsalPanel
        eventId="event-1"
        currentModule="idle"
        registrationOpen={false}
        compositionLocked
        guestCount={3}
        premiere={{
          load: vi.fn().mockResolvedValue(configuredPremiere),
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

    await waitFor(() => {
      expect(screen.getByText('СТАРТ СОБЫТИЯ · ПРОВЕРИТЬ')).toBeInTheDocument();
    });

    expect(screen.getByText('РЕГИСТРАЦИЯ · ЗАКРЫТА')).toBeInTheDocument();
    expect(screen.getByText('ТЕСТОВЫЕ ГОСТИ · 3')).toBeInTheDocument();
    expect(screen.getByText('СОСТАВ · ЗАФИКСИРОВАН')).toBeInTheDocument();
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
    expect(screen.getByText('ВИДЕО · 2 / 2')).toBeInTheDocument();
    expect(screen.getByText('ЗВУК · 2 / 2')).toBeInTheDocument();
    expect(screen.getByText('ПРЕМЬЕРА · ГОТОВА')).toBeInTheDocument();
    expect(screen.getByText('ОТВЕТЫ ПАРЫ · ГОТОВЫ')).toBeInTheDocument();
    expect(screen.getByText('БУНКЕР · ГОТОВ')).toBeInTheDocument();
    expect(screen.getByText('MK · ГОТОВ')).toBeInTheDocument();
  });
});
