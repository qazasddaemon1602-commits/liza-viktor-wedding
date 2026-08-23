import { describe, expect, it, vi } from 'vitest';
import {
  getLizaBunkerOperatorState,
  parseLizaBunkerOperatorState,
  submitLizaBunkerOperatorPhrase,
} from './bunkerOperator.service';

const activePayload = {
  status: 'active',
  bunkerActive: true,
  globalGameState: 'MISSION_02',
  stage: 'MISSION_02',
  enteredAt: '2026-08-23T12:00:00.000Z',
  sendUntil: '2026-08-23T12:00:45.000Z',
  serverNow: '2026-08-23T12:00:05.000Z',
  windowOpen: true,
  options: [
    { key: 'm02_signal', body: 'Сигнал слабый, но я вас слышу. Продолжайте.' },
    { key: 'm02_fragments', body: 'Не доверяйте одному фрагменту. Сверяйте всё, что нашли.' },
  ],
  selectedMessage: null,
};

describe('bunkerOperator.service', () => {
  it.each([
    [{ status: 'invalid_access' }, { status: 'invalid_access' }],
    [{ status: 'idle', bunkerActive: false, serverNow: '2026-08-23T12:00:00Z' }, {
      status: 'idle', bunkerActive: false, serverNow: '2026-08-23T12:00:00Z', globalGameState: null,
    }],
    [{
      status: 'idle', bunkerActive: true, globalGameState: 'MISSION_03', serverNow: '2026-08-23T12:00:00Z',
    }, {
      status: 'idle', bunkerActive: true, globalGameState: 'MISSION_03', serverNow: '2026-08-23T12:00:00Z',
    }],
    [{
      status: 'revealed', bunkerActive: true, globalGameState: 'BUNKER_OPEN', serverNow: '2026-08-23T12:00:00Z',
    }, {
      status: 'revealed', bunkerActive: true, globalGameState: 'BUNKER_OPEN', serverNow: '2026-08-23T12:00:00Z',
    }],
    [{
      status: 'finished', bunkerActive: true, globalGameState: 'FINISHED', serverNow: '2026-08-23T12:00:00Z',
    }, {
      status: 'finished', bunkerActive: true, globalGameState: 'FINISHED', serverNow: '2026-08-23T12:00:00Z',
    }],
  ])('parses a supported private state', (payload, expected) => {
    expect(parseLizaBunkerOperatorState(payload)).toEqual(expected);
  });

  it('parses an active window and its optional selected message', () => {
    expect(parseLizaBunkerOperatorState({
      ...activePayload,
      windowOpen: false,
      selectedMessage: {
        id: 'c795159a-79ad-4dcb-9594-b3c974bdf33a',
        stage: 'MISSION_02',
        optionKey: 'm02_signal',
        body: 'Сигнал слабый, но я вас слышу. Продолжайте.',
        source: 'selected',
        publishedAt: '2026-08-23T12:00:06.000Z',
      },
    })).toMatchObject({
      status: 'active',
      stage: 'MISSION_02',
      windowOpen: false,
      options: activePayload.options,
      selectedMessage: { source: 'selected', optionKey: 'm02_signal' },
    });
  });

  it.each([
    null,
    {},
    { status: 'unknown' },
    { status: 'idle', bunkerActive: 'yes', serverNow: '2026-08-23T12:00:00Z' },
    { status: 'revealed', bunkerActive: true, globalGameState: 'FINISHED', serverNow: '2026-08-23T12:00:00Z' },
    { ...activePayload, options: activePayload.options.slice(0, 1) },
    { ...activePayload, options: [...activePayload.options].reverse() },
    { ...activePayload, serverNow: 'not-a-date' },
    { ...activePayload, selectedMessage: { id: 'x' } },
    { ...activePayload, lizaName: 'Лиза' },
  ])('rejects malformed or identity-leaking payload %#', (payload) => {
    expect(() => parseLizaBunkerOperatorState(payload)).toThrow('Unexpected Liza operator response');
  });

  it('calls the private state RPC with only slug and token', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: activePayload, error: null });
    await expect(getLizaBunkerOperatorState({ rpc }, 'liza-viktor', 'secret-token')).resolves.toMatchObject({ status: 'active' });
    expect(rpc).toHaveBeenCalledWith('get_liza_bunker_operator_state', {
      p_event_slug: 'liza-viktor', p_token: 'secret-token',
    });
  });

  it.each(['accepted', 'locked'] as const)('parses an idempotent %s submission', async (status) => {
    const rpc = vi.fn().mockResolvedValue({ data: {
      status,
      serverNow: '2026-08-23T12:00:06.000Z',
      message: {
        id: 'c795159a-79ad-4dcb-9594-b3c974bdf33a', stage: 'MISSION_02',
        optionKey: 'm02_signal', body: 'Сигнал слабый, но я вас слышу. Продолжайте.',
        source: 'selected', publishedAt: '2026-08-23T12:00:06.000Z',
      },
    }, error: null });
    await expect(submitLizaBunkerOperatorPhrase(
      { rpc }, 'liza-viktor', 'secret-token', 'MISSION_02', 'm02_signal',
    )).resolves.toMatchObject({ status, message: { optionKey: 'm02_signal' } });
    expect(rpc).toHaveBeenCalledWith('submit_liza_bunker_operator_phrase', {
      p_event_slug: 'liza-viktor', p_token: 'secret-token', p_stage: 'MISSION_02', p_option_key: 'm02_signal',
    });
  });

  it('preserves RPC error codes', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } });
    await expect(getLizaBunkerOperatorState({ rpc }, 'event', 'token')).rejects.toMatchObject({ code: '42501' });
  });
});
