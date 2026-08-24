import type { RadioPresetId } from './trainRadio.service';

const RADIO_AUDIO_SOURCES: Record<RadioPresetId, string> = {
  departure: '/audio/radio/0824.MP3',
  toast: '/audio/radio/0824(1).MP3',
  quiet_carriage: '/audio/radio/0824(2).MP3',
  late_passenger: '/audio/radio/0824(3).MP3',
  kiss: '/audio/radio/0824(4).MP3',
  dance: '/audio/radio/0824(5).MP3',
  quiz: '/audio/radio/0824(6).MP3',
  arena: '/audio/radio/0824(7).MP3',
  bunker: '/audio/radio/0824(8).MP3',
  final: '/audio/radio/0824(9).MP3',
};

export const TRAIN_SOUND_AUDIO_SOURCE = '/audio/radio/train.MP3';

export function radioAudioSource(preset: RadioPresetId): string {
  return RADIO_AUDIO_SOURCES[preset];
}
