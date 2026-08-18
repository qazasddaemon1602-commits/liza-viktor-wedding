import { describe, expect, it, vi } from 'vitest';
import {
  cancelPremiere,
  getOwnerPremiereControl,
  getPremiereScreenState,
  pausePremiere,
  restartPremiere,
  resumePremiere,
  returnMainScreen,
  seekPremiere,
  setPremiereBlack,
  setPremiereCountdownSound,
  setPremiereMedia,
  setPremiereStandby,
  startPremiere,
  type PremiereRpcClient,
} from './premiere.service';

function clientWith(...payloads: unknown[]): PremiereRpcClient {
  const rpc = vi.fn();
  for (const data of payloads) rpc.mockResolvedValueOnce({ data, error: null });
  return { rpc };
}

describe('premiere service', () => {
  it('parses a synchronized countdown screen state', async () => {
    const client = clientWith({
      status: 'countdown',
      mediaUrl: 'https://cdn.test/ring.mp4',
      durationSeconds: 623,
      startAt: '2026-08-30T18:00:10+05:00',
      playbackAnchorAt: null,
      playbackOffsetSeconds: 0,
      positionSeconds: 0,
      countdownSeconds: 10,
      countdownSoundEnabled: true,
      serverNow: '2026-08-30T18:00:03+05:00',
    });

    await expect(getPremiereScreenState(client, 'liza-viktor')).resolves.toEqual({
      status: 'countdown',
      mediaUrl: 'https://cdn.test/ring.mp4',
      durationSeconds: 623,
      startAt: '2026-08-30T18:00:10+05:00',
      playbackAnchorAt: null,
      playbackOffsetSeconds: 0,
      positionSeconds: 0,
      countdownSeconds: 10,
      countdownSoundEnabled: true,
      serverNow: '2026-08-30T18:00:03+05:00',
    });
    expect(client.rpc).toHaveBeenCalledWith('get_premiere_screen_state', { p_event_slug: 'liza-viktor' });
  });

  it('parses authoritative playing and paused states with positions', async () => {
    const playing = clientWith({
      status: 'playing', mediaUrl: 'https://cdn.test/ring.mp4', durationSeconds: 623,
      startAt: null, playbackAnchorAt: '2026-08-30T18:00:10+05:00', playbackOffsetSeconds: 0,
      positionSeconds: 17.25, countdownSeconds: 10, countdownSoundEnabled: true,
      serverNow: '2026-08-30T18:00:27.25+05:00',
    });
    const paused = clientWith({
      status: 'paused', mediaUrl: 'https://cdn.test/ring.mp4', durationSeconds: 623,
      startAt: null, playbackAnchorAt: null, playbackOffsetSeconds: 42.5,
      positionSeconds: 42.5, countdownSeconds: 10, countdownSoundEnabled: false,
      serverNow: '2026-08-30T18:01:00+05:00',
    });

    expect((await getPremiereScreenState(playing, 'liza-viktor')).status).toBe('playing');
    expect((await getPremiereScreenState(paused, 'liza-viktor')).status).toBe('paused');
  });

  it('keeps idle/black screen states minimal', async () => {
    await expect(getPremiereScreenState(clientWith({ status: 'idle', serverNow: '2026-08-30T18:00:00+05:00' }), 'liza-viktor'))
      .resolves.toEqual({ status: 'idle', serverNow: '2026-08-30T18:00:00+05:00' });
    await expect(getPremiereScreenState(clientWith({ status: 'black', serverNow: '2026-08-30T18:00:00+05:00' }), 'liza-viktor'))
      .resolves.toEqual({ status: 'black', serverNow: '2026-08-30T18:00:00+05:00' });
  });

  it('parses owner control readiness without requiring raw table access', async () => {
    const client = clientWith({
      status: 'standby', configured: true,
      mediaUrl: 'https://cdn.test/ring.mp4', durationSeconds: 623,
      startAt: null, playbackAnchorAt: null, playbackOffsetSeconds: 0, positionSeconds: 0,
      countdownSeconds: 10, countdownSoundEnabled: true,
      serverNow: '2026-08-30T18:00:00+05:00',
    });
    const result = await getOwnerPremiereControl(client, 'event-1');
    expect(result.status).toBe('standby');
    expect(result.configured).toBe(true);
  });

  it('wires owner setup/start and transport controls to dedicated RPCs', async () => {
    const client = clientWith(
      { status: 'configured', durationSeconds: 623 },
      { status: 'standby' },
      { status: 'countdown', startAt: '2026-08-30T18:00:10+05:00', countdownSeconds: 10 },
      { status: 'paused', positionSeconds: 18 },
      { status: 'playing', playbackAnchorAt: '2026-08-30T18:00:20+05:00', playbackOffsetSeconds: 18 },
      { status: 'seeked', positionSeconds: 120 },
      { status: 'playing', playbackAnchorAt: '2026-08-30T18:00:30+05:00', playbackOffsetSeconds: 0 },
      { status: 'standby' },
      { status: 'black' },
      { status: 'idle' },
      { status: 'ok', countdownSoundEnabled: false },
    );

    await setPremiereMedia(client, 'event-1', 'https://cdn.test/ring.mp4', 623);
    await setPremiereStandby(client, 'event-1');
    await startPremiere(client, 'event-1', 10);
    await pausePremiere(client, 'event-1');
    await resumePremiere(client, 'event-1');
    await seekPremiere(client, 'event-1', 120);
    await restartPremiere(client, 'event-1');
    await cancelPremiere(client, 'event-1');
    await setPremiereBlack(client, 'event-1');
    await returnMainScreen(client, 'event-1');
    await setPremiereCountdownSound(client, 'event-1', false);

    const rpc = client.rpc as ReturnType<typeof vi.fn>;
    expect(rpc).toHaveBeenCalledWith('owner_start_premiere', { p_event_id: 'event-1', p_countdown_seconds: 10 });
    expect(rpc).toHaveBeenCalledWith('owner_seek_premiere', { p_event_id: 'event-1', p_position_seconds: 120 });
    expect(rpc).toHaveBeenCalledWith('owner_set_premiere_countdown_sound', { p_event_id: 'event-1', p_enabled: false });
  });

  it('rejects malformed countdown payloads rather than guessing', async () => {
    await expect(getPremiereScreenState(clientWith({
      status: 'countdown', mediaUrl: 'https://cdn.test/ring.mp4', durationSeconds: 623,
      startAt: null, playbackAnchorAt: null, playbackOffsetSeconds: 0, positionSeconds: 0,
      countdownSeconds: 10, countdownSoundEnabled: true, serverNow: '2026-08-30T18:00:00+05:00',
    }), 'liza-viktor')).rejects.toThrow('Unexpected premiere response');
  });
});
