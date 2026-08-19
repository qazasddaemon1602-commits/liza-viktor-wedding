import { describe, expect, it, vi } from 'vitest';
import {
  broadcastPremiereScreenPresence,
  subscribeToPremiereScreenPresence,
  type PremierePresenceRealtimeChannel,
  type PremierePresenceRealtimeClient,
} from './premierePresence.realtime';

function channelFixture() {
  let listener: ((message: unknown) => void) | undefined;
  let subscribeCallback: ((status: string) => void) | undefined;
  const channel: PremierePresenceRealtimeChannel = {
    send: vi.fn().mockResolvedValue('ok'),
    on: vi.fn((_type, _filter, callback) => {
      listener = callback;
      return channel;
    }),
    subscribe: vi.fn((callback) => {
      subscribeCallback = callback;
      return channel;
    }),
    unsubscribe: vi.fn(),
  };
  const client: PremierePresenceRealtimeClient = {
    channel: vi.fn(() => channel),
  };
  return {
    client,
    channel,
    emit: (message: unknown) => listener?.(message),
    status: (value: string) => subscribeCallback?.(value),
  };
}

describe('premiere screen presence realtime', () => {
  it('broadcasts one typed screen heartbeat after the dedicated presence channel is subscribed', async () => {
    const fixture = channelFixture();
    const heartbeat = {
      screenId: 'screen-tv-1',
      videoReady: true,
      audioArmed: false,
    };

    const promise = broadcastPremiereScreenPresence(
      fixture.client,
      'liza-viktor',
      heartbeat,
    );
    fixture.status('SUBSCRIBED');
    await promise;

    expect(fixture.client.channel).toHaveBeenCalledWith('premiere-presence:liza-viktor');
    expect(fixture.channel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'screen_presence',
      payload: heartbeat,
    });
    expect(fixture.channel.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('subscribes to valid screen heartbeats and ignores malformed payloads', () => {
    const fixture = channelFixture();
    const received = vi.fn();
    const unsubscribe = subscribeToPremiereScreenPresence(
      fixture.client,
      'liza-viktor',
      received,
    );

    fixture.emit({
      payload: {
        screenId: 'screen-tv-2',
        videoReady: false,
        audioArmed: true,
      },
    });
    fixture.emit({ payload: { screenId: '', videoReady: true, audioArmed: true } });
    fixture.emit({ payload: { screenId: 'bad', videoReady: 'yes', audioArmed: true } });

    expect(received).toHaveBeenCalledTimes(1);
    expect(received).toHaveBeenCalledWith({
      screenId: 'screen-tv-2',
      videoReady: false,
      audioArmed: true,
    });

    unsubscribe();
    expect(fixture.channel.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('shares one underlying presence subscription across multiple admin consumers', () => {
    const fixture = channelFixture();
    const rehearsal = vi.fn();
    const premiereControl = vi.fn();

    const unsubscribeRehearsal = subscribeToPremiereScreenPresence(
      fixture.client,
      'liza-viktor',
      rehearsal,
    );
    const unsubscribePremiereControl = subscribeToPremiereScreenPresence(
      fixture.client,
      'liza-viktor',
      premiereControl,
    );

    expect(fixture.client.channel).toHaveBeenCalledTimes(1);

    fixture.emit({
      payload: {
        screenId: 'screen-tv-main',
        videoReady: true,
        audioArmed: true,
      },
    });

    expect(rehearsal).toHaveBeenCalledTimes(1);
    expect(premiereControl).toHaveBeenCalledTimes(1);

    unsubscribeRehearsal();
    expect(fixture.channel.unsubscribe).not.toHaveBeenCalled();

    unsubscribePremiereControl();
    expect(fixture.channel.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('rejects a heartbeat broadcast when realtime cannot subscribe', async () => {
    const fixture = channelFixture();
    const promise = broadcastPremiereScreenPresence(
      fixture.client,
      'liza-viktor',
      { screenId: 'screen-tv-1', videoReady: false, audioArmed: false },
    );
    fixture.status('TIMED_OUT');

    await expect(promise).rejects.toThrow('Unable to subscribe premiere presence channel');
    expect(fixture.channel.send).not.toHaveBeenCalled();
  });
});
