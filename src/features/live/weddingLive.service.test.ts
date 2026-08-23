import { describe, expect, it } from 'vitest';
import {
  parseGuestReactionScreenEvent,
  parseSubmitGuestReactionResult,
  reactionEmoji,
} from './weddingLive.service';

describe('wedding live reaction service', () => {
  it('maps only the five approved wedding reactions', () => {
    expect(reactionEmoji('heart')).toBe('❤️');
    expect(reactionEmoji('laugh')).toBe('😂');
    expect(reactionEmoji('fire')).toBe('🔥');
    expect(reactionEmoji('clap')).toBe('👏');
    expect(reactionEmoji('wow')).toBe('😱');
    expect(reactionEmoji('angry' as never)).toBeNull();
  });

  it('parses accepted and cooldown submit responses', () => {
    expect(parseSubmitGuestReactionResult({
      status: 'accepted',
      reactionId: 'reaction-1',
      createdAt: '2026-08-24T00:00:00.000Z',
      cooldownMs: 5000,
    })).toEqual({
      status: 'accepted',
      reactionId: 'reaction-1',
      createdAt: '2026-08-24T00:00:00.000Z',
      cooldownMs: 5000,
    });

    expect(parseSubmitGuestReactionResult({ status: 'cooldown', retryAfterMs: 3200 })).toEqual({
      status: 'cooldown',
      retryAfterMs: 3200,
    });
  });

  it('accepts only valid public guest_reaction screen events', () => {
    expect(parseGuestReactionScreenEvent({
      id: 'event-1',
      kind: 'guest_reaction',
      created_at: '2026-08-24T00:00:00.000Z',
      payload: { reaction: 'fire' },
    })).toEqual({
      id: 'event-1',
      kind: 'guest_reaction',
      createdAt: '2026-08-24T00:00:00.000Z',
      reaction: 'fire',
    });

    expect(parseGuestReactionScreenEvent({
      id: 'event-2',
      kind: 'guest_reaction',
      created_at: '2026-08-24T00:00:00.000Z',
      payload: { reaction: 'angry' },
    })).toBeNull();
  });
});
