import { describe, expect, it } from 'vitest';
import { RADIO_PRESETS } from './trainRadio.service';
import {
  TRAIN_SOUND_AUDIO_SOURCE,
  radioAudioSource,
} from './trainRadioAudio';

describe('train radio audio mapping', () => {
  it('keeps uploaded voice files in the exact preset order', () => {
    expect(RADIO_PRESETS.map((preset) => [preset.id, radioAudioSource(preset.id)])).toEqual([
      ['departure', '/audio/radio/0824.MP3'],
      ['toast', '/audio/radio/0824(1).MP3'],
      ['quiet_carriage', '/audio/radio/0824(2).MP3'],
      ['late_passenger', '/audio/radio/0824(3).MP3'],
      ['kiss', '/audio/radio/0824(4).MP3'],
      ['dance', '/audio/radio/0824(5).MP3'],
      ['quiz', '/audio/radio/0824(6).MP3'],
      ['arena', '/audio/radio/0824(7).MP3'],
      ['bunker', '/audio/radio/0824(8).MP3'],
      ['final', '/audio/radio/0824(9).MP3'],
    ]);
  });

  it('keeps the plain train sound separate from the radio voices', () => {
    expect(TRAIN_SOUND_AUDIO_SOURCE).toBe('/audio/radio/train.MP3');
  });
});
