import { describe, expect, it } from 'vitest';
import {
  parseSendTrainSoundResult,
  parseTrainSoundScreenEvent,
} from './trainSound.service';

describe('train sound service', () => {
  it('parses the owner send result', () => {
    expect(parseSendTrainSoundResult({ status: 'sent', eventId: 'train-1' })).toEqual({
      status: 'sent',
      eventId: 'train-1',
    });
  });

  it('accepts only train_sound projector events', () => {
    expect(parseTrainSoundScreenEvent({
      id: 'screen-1',
      kind: 'train_sound',
      created_at: '2026-08-24T06:00:00Z',
      payload: {},
    })).toEqual({
      id: 'screen-1',
      kind: 'train_sound',
      createdAt: '2026-08-24T06:00:00Z',
    });

    expect(parseTrainSoundScreenEvent({
      id: 'screen-2',
      kind: 'radio_transmission',
      created_at: '2026-08-24T06:00:00Z',
      payload: {},
    })).toBeNull();
  });
});
