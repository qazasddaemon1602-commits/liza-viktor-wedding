import { describe, expect, it } from 'vitest';
import {
  controlIlyaSong,
  parseControlIlyaSongResult,
  parseIlyaSongScreenEvent,
  subscribeToIlyaSong,
} from './ilyaSong.service';

describe('Ilya song service', () => {
  it('parses complete play and stop projector events and rejects malformed play data', () => {
    expect(parseIlyaSongScreenEvent({
      id: 'song-1',
      kind: 'ilya_song',
      created_at: '2026-08-26T18:00:00Z',
      payload: {
        action: 'play',
        trackId: 'koshkin-dom-2',
        title: 'Песня про Илью',
        artist: 'Посажёный отец',
        durationMs: 350281,
      },
    })).toEqual({
      id: 'song-1',
      kind: 'ilya_song',
      createdAt: '2026-08-26T18:00:00Z',
      action: 'play',
      trackId: 'koshkin-dom-2',
      title: 'Песня про Илью',
      artist: 'Посажёный отец',
      durationMs: 350281,
    });
    expect(parseIlyaSongScreenEvent({
      id: 'song-2', kind: 'ilya_song', created_at: '2026-08-26T18:01:00Z', payload: { action: 'stop' },
    })).toEqual({
      id: 'song-2', kind: 'ilya_song', createdAt: '2026-08-26T18:01:00Z', action: 'stop',
    });
    expect(parseIlyaSongScreenEvent({
      id: 'song-3', kind: 'ilya_song', created_at: '2026-08-26T18:02:00Z', payload: { action: 'play' },
    })).toBeNull();
  });

  it('sends the selected track with the requested owner action to the song control RPC', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return { data: { status: 'ok', eventId: 'song-1', action: 'play' }, error: null };
      },
    };

    await expect(controlIlyaSong(client, 'liza-viktor', 'play', 'last-route')).resolves.toEqual({
      status: 'ok', eventId: 'song-1', action: 'play',
    });
    expect(calls).toEqual([{
      name: 'owner_control_ilya_song',
      args: { p_event_slug: 'liza-viktor', p_action: 'play', p_track_id: 'last-route' },
    }]);
    expect(() => parseControlIlyaSongResult({ status: 'ok', eventId: '', action: 'play' })).toThrow();
  });

  it('delivers valid realtime song events and unsubscribes cleanly', () => {
    let receive: ((payload: { new?: Record<string, unknown> }) => void) | undefined;
    let unsubscribed = false;
    const channel = {
      on: (_eventType: 'postgres_changes', _filter: unknown, callback: typeof receive) => {
        receive = callback;
        return channel;
      },
      subscribe: () => undefined,
      unsubscribe: () => { unsubscribed = true; },
    };
    const events: unknown[] = [];
    const stop = subscribeToIlyaSong({ channel: () => channel }, 'liza-viktor', (event) => events.push(event));

    receive?.({
      new: {
        id: 'song-1',
        kind: 'ilya_song',
        created_at: '2026-08-26T18:00:00Z',
        payload: {
          action: 'play',
          trackId: 'koshkin-dom-3',
          title: 'Кошкин дом — версия 3',
          artist: 'Свадебный плейлист',
          durationMs: 354721,
        },
      },
    });
    expect(events).toHaveLength(1);
    stop();
    expect(unsubscribed).toBe(true);
  });
});
