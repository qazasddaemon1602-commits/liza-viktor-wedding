import { describe, expect, it } from 'vitest';
import {
  announcementQueueReducer,
  createAnnouncementQueueState,
  type AnnouncementQueueAction,
} from './arrivalAnnouncementQueue';
import type { ScreenPresentationEvent } from './screenEvents.realtime';

const arrival = (id: string, carriageId = 'c2', displayName = `Гость ${id}`): ScreenPresentationEvent => ({
  id,
  kind: 'guest_registered',
  createdAt: `2026-08-30T12:00:0${id.slice(-1)}+05:00`,
  payload: {
    displayName,
    carriage: { id: carriageId, number: 2, label: 'ВАГОН №2', accentHex: '#31483A', visualMark: '02' },
  },
});

const call = (id: string): ScreenPresentationEvent => ({
  id,
  kind: 'carriage_call',
  createdAt: '2026-08-30T12:00:10+05:00',
  payload: {
    callId: `call-${id}`,
    message: 'К БАРУ',
    carriages: [{ id: 'c3', number: 3, label: 'ВАГОН №3', accentHex: '#7E3F3C', visualMark: '03' }],
  },
});

function reduce(actions: AnnouncementQueueAction[]) {
  return actions.reduce(announcementQueueReducer, createAnnouncementQueueState('event-1'));
}

describe('announcementQueueReducer', () => {
  it('presents the first free arrival and ignores its repeated ID', () => {
    const event = arrival('a1');
    const state = reduce([{ type: 'receive', event }, { type: 'receive', event }]);
    expect(state.active?.presentation.kind).toBe('arrival');
    expect(state.pending).toHaveLength(0);
    expect(state.seenIds).toEqual(['a1']);
  });

  it('keeps one pending arrival as a ceremony but coalesces two or more without names', () => {
    const state = reduce([
      { type: 'receive', event: arrival('a1') },
      { type: 'receive', event: arrival('a2', 'c2', 'Иван Петров') },
      { type: 'receive', event: arrival('a3', 'c4', 'Анна Смирнова') },
    ]);
    expect(state.pending[0]).toMatchObject({
      kind: 'boarding_summary',
      count: 2,
      eventIds: ['a2', 'a3'],
      carriageIds: ['c2', 'c4'],
    });
    expect(JSON.stringify(state.pending[0])).not.toContain('Иван Петров');
    expect(JSON.stringify(state.pending[0])).not.toContain('Анна Смирнова');
  });

  it('permanently closes an arrival batch at a carriage call and preserves FIFO', () => {
    const state = reduce([
      { type: 'receive', event: arrival('a1') },
      { type: 'receive', event: arrival('a2') },
      { type: 'receive', event: call('c1') },
      { type: 'receive', event: arrival('a3') },
      { type: 'receive', event: arrival('a4') },
      { type: 'complete' },
    ]);
    expect(state.active?.presentation.kind).toBe('arrival');
    expect(state.pending.map((item) => item.kind)).toEqual(['carriage_call', 'boarding_summary']);
  });

  it('cancels and marks presentations seen on protection, drops arrivals while protected, and does not catch up', () => {
    const state = reduce([
      { type: 'receive', event: arrival('a1') },
      { type: 'receive', event: arrival('a2') },
      { type: 'set_protected', protected: true },
      { type: 'receive', event: arrival('a3') },
      { type: 'set_protected', protected: false },
    ]);
    expect(state.active).toBeNull();
    expect(state.pending).toEqual([]);
    expect(state.seenIds).toEqual(['a1', 'a2', 'a3']);
    expect(state.protected).toBe(false);
  });

  it('resets queue and seen IDs for a new event session', () => {
    const state = reduce([
      { type: 'receive', event: arrival('a1') },
      { type: 'reset_session', sessionKey: 'event-2' },
      { type: 'receive', event: arrival('a1') },
    ]);
    expect(state.sessionKey).toBe('event-2');
    expect(state.active?.presentation.kind).toBe('arrival');
    expect(state.seenIds).toEqual(['a1']);
  });
});
