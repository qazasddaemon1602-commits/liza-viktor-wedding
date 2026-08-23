import { describe, expect, it } from 'vitest';
import {
  RADIO_PRESETS,
  parseRadioTransmissionScreenEvent,
  parseSendRadioTransmissionResult,
} from './trainRadio.service';

describe('train radio service', () => {
  it('ships a compact wedding-friendly preset list', () => {
    expect(RADIO_PRESETS.length).toBeGreaterThanOrEqual(8);
    expect(RADIO_PRESETS.some((preset) => preset.id === 'departure')).toBe(true);
    expect(RADIO_PRESETS.some((preset) => preset.id === 'dance')).toBe(true);
    expect(RADIO_PRESETS.some((preset) => preset.id === 'final')).toBe(true);
  });

  it('parses an owner send result', () => {
    expect(parseSendRadioTransmissionResult({
      status: 'sent', eventId: 'event-1', preset: 'dance', durationMs: 12000,
    })).toEqual({
      status: 'sent', eventId: 'event-1', preset: 'dance', durationMs: 12000,
    });
  });

  it('parses only a complete radio projector event', () => {
    expect(parseRadioTransmissionScreenEvent({
      id: 'screen-1',
      kind: 'radio_transmission',
      created_at: '2026-08-24T00:00:00Z',
      payload: {
        preset: 'dance',
        label: 'ТАНЦПОЛ',
        message: 'Танцевальная платформа свободна.',
        durationMs: 12000,
      },
    })).toEqual({
      id: 'screen-1',
      kind: 'radio_transmission',
      createdAt: '2026-08-24T00:00:00Z',
      preset: 'dance',
      label: 'ТАНЦПОЛ',
      message: 'Танцевальная платформа свободна.',
      durationMs: 12000,
    });
  });
});
