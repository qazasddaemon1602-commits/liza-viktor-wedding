import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  rpc: vi.fn(),
  channel: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  getSupabaseClient: () => ({
    rpc: mocked.rpc,
    channel: mocked.channel,
  }),
}));

import { createAdminPageDependencies } from './AdminPage';

describe('createAdminPageDependencies premiere wiring', () => {
  beforeEach(() => {
    mocked.rpc.mockReset();
    mocked.channel.mockReset();
  });

  it('wires the secure owner premiere RPCs', async () => {
    mocked.rpc
      .mockResolvedValueOnce({
        data: {
          status: 'standby',
          configured: true,
          mediaUrl: 'https://cdn.test/ring.mp4',
          durationSeconds: 623,
          startAt: null,
          playbackAnchorAt: null,
          playbackOffsetSeconds: 0,
          positionSeconds: 0,
          countdownSeconds: 10,
          countdownSoundEnabled: true,
          serverNow: '2026-08-30T12:00:00.000Z',
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: { status: 'standby' }, error: null })
      .mockResolvedValueOnce({ data: { status: 'countdown' }, error: null })
      .mockResolvedValueOnce({ data: { status: 'paused' }, error: null })
      .mockResolvedValueOnce({ data: { status: 'playing' }, error: null })
      .mockResolvedValueOnce({ data: { status: 'seeked' }, error: null })
      .mockResolvedValueOnce({ data: { status: 'black' }, error: null })
      .mockResolvedValueOnce({ data: { status: 'idle' }, error: null });

    const deps = createAdminPageDependencies();
    expect(deps.premiere).toBeDefined();

    await expect(deps.premiere!.load('event-1')).resolves.toMatchObject({
      status: 'standby',
      configured: true,
    });
    await expect(deps.premiere!.standby('event-1')).resolves.toEqual({ status: 'standby' });
    await expect(deps.premiere!.start('event-1', 10)).resolves.toEqual({ status: 'countdown' });
    await expect(deps.premiere!.pause('event-1')).resolves.toEqual({ status: 'paused' });
    await expect(deps.premiere!.resume('event-1')).resolves.toEqual({ status: 'playing' });
    await expect(deps.premiere!.seek('event-1', 152)).resolves.toEqual({ status: 'seeked' });
    await expect(deps.premiere!.black('event-1')).resolves.toEqual({ status: 'black' });
    await expect(deps.premiere!.returnMain('event-1')).resolves.toEqual({ status: 'idle' });

    expect(mocked.rpc).toHaveBeenNthCalledWith(1, 'owner_get_premiere_control', { p_event_id: 'event-1' });
    expect(mocked.rpc).toHaveBeenNthCalledWith(2, 'owner_set_premiere_standby', { p_event_id: 'event-1' });
    expect(mocked.rpc).toHaveBeenNthCalledWith(3, 'owner_start_premiere', {
      p_countdown_seconds: 10,
      p_event_id: 'event-1',
    });
    expect(mocked.rpc).toHaveBeenNthCalledWith(6, 'owner_seek_premiere', {
      p_event_id: 'event-1',
      p_position_seconds: 152,
    });
  });

  it('wires live projector presence into the owner premiere panel on its dedicated channel', () => {
    let listener: ((message: unknown) => void) | undefined;
    const realtimeChannel = {
      send: vi.fn().mockResolvedValue('ok'),
      on: vi.fn((_type: string, _filter: unknown, callback: (message: unknown) => void) => {
        listener = callback;
        return realtimeChannel;
      }),
      subscribe: vi.fn(() => realtimeChannel),
      unsubscribe: vi.fn(),
    };
    mocked.channel.mockReturnValue(realtimeChannel);

    const deps = createAdminPageDependencies();
    const receive = vi.fn();
    const unsubscribe = deps.premiere!.subscribeScreenPresence!(receive);

    expect(mocked.channel).toHaveBeenCalledWith('premiere-presence:liza-viktor');
    expect(realtimeChannel.on).toHaveBeenCalledWith(
      'broadcast',
      { event: 'screen_presence' },
      expect.any(Function),
    );

    listener?.({
      payload: {
        screenId: 'tv-room-1',
        videoReady: true,
        audioArmed: false,
      },
    });
    expect(receive).toHaveBeenCalledWith({
      screenId: 'tv-room-1',
      videoReady: true,
      audioArmed: false,
    });

    unsubscribe();
    expect(realtimeChannel.unsubscribe).toHaveBeenCalledTimes(1);
  });
});

