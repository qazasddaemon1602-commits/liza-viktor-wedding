import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PremiereScreenState } from '../premiere/premiere.service';
import { ScreenPage } from './ScreenPage';

const serverNow = '2026-08-30T12:00:00.000Z';
const standbyState: PremiereScreenState = {
  status: 'standby',
  mediaUrl: 'https://cdn.test/ring.mp4',
  durationSeconds: 623,
  startAt: null,
  playbackAnchorAt: null,
  playbackOffsetSeconds: 0,
  positionSeconds: 0,
  countdownSeconds: 10,
  countdownSoundEnabled: true,
  serverNow,
};

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('ScreenPage premiere presence heartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(serverNow));
  });

  afterEach(() => vi.useRealTimers());

  it('starts with sound enabled, auto-arms audio, and exposes a disable-first toggle', async () => {
    const broadcastPremierePresence = vi.fn().mockResolvedValue(undefined);
    const dependencies = {
      subscribe: () => vi.fn(),
      loadPremiere: vi.fn().mockResolvedValue(standbyState),
      subscribeToPremiereRefresh: vi.fn(() => vi.fn()),
      broadcastPremierePresence,
      armArrivalAudio: vi.fn().mockResolvedValue(true),
      armPremiereAudio: vi.fn().mockResolvedValue(true),
      playArrivalSignal: vi.fn(),
      stopArrivalAudio: vi.fn(),
      playPremiereCountdownTick: vi.fn(),
    };

    const { container } = render(
      <ScreenPage
        joinUrl="https://wedding.example/join"
        eventSlug="liza-viktor"
        screenId="tv-room-1"
        dependencies={dependencies}
      />,
    );
    await flushPromises();

    expect(dependencies.armArrivalAudio).toHaveBeenCalledTimes(1);
    expect(dependencies.armPremiereAudio).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'ВЫКЛЮЧИТЬ ЗВУК' })).toBeInTheDocument();
    expect(broadcastPremierePresence).toHaveBeenLastCalledWith({
      screenId: 'tv-room-1',
      videoReady: false,
      audioArmed: true,
    });

    fireEvent.canPlay(container.querySelector('video')!);
    await flushPromises();
    expect(broadcastPremierePresence).toHaveBeenLastCalledWith({
      screenId: 'tv-room-1',
      videoReady: true,
      audioArmed: true,
    });

    fireEvent.click(screen.getByRole('button', { name: 'ВЫКЛЮЧИТЬ ЗВУК' }));
    await flushPromises();
    expect(dependencies.stopArrivalAudio).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'ВКЛЮЧИТЬ ЗВУК' })).toBeInTheDocument();
    expect(broadcastPremierePresence).toHaveBeenLastCalledWith({
      screenId: 'tv-room-1',
      videoReady: true,
      audioArmed: false,
    });

    fireEvent.click(screen.getByRole('button', { name: 'ВКЛЮЧИТЬ ЗВУК' }));
    await flushPromises();
    expect(screen.getByRole('button', { name: 'ВЫКЛЮЧИТЬ ЗВУК' })).toBeInTheDocument();
    expect(broadcastPremierePresence).toHaveBeenLastCalledWith({
      screenId: 'tv-room-1',
      videoReady: true,
      audioArmed: true,
    });
  });

  it('repeats the latest heartbeat every five seconds so stale TVs disappear from admin', async () => {
    const broadcastPremierePresence = vi.fn().mockResolvedValue(undefined);
    const dependencies = {
      subscribe: () => vi.fn(),
      loadPremiere: vi.fn().mockResolvedValue(standbyState),
      subscribeToPremiereRefresh: vi.fn(() => vi.fn()),
      broadcastPremierePresence,
      playArrivalSignal: vi.fn(),
    };

    render(
      <ScreenPage
        joinUrl="https://wedding.example/join"
        eventSlug="liza-viktor"
        screenId="tv-room-2"
        dependencies={dependencies}
      />,
    );
    await flushPromises();
    const initialCalls = broadcastPremierePresence.mock.calls.length;

    await act(async () => {
      vi.advanceTimersByTime(5_000);
      await Promise.resolve();
    });

    expect(broadcastPremierePresence.mock.calls.length).toBeGreaterThan(initialCalls);
    expect(broadcastPremierePresence).toHaveBeenLastCalledWith({
      screenId: 'tv-room-2',
      videoReady: false,
      audioArmed: true,
    });
  });
});
