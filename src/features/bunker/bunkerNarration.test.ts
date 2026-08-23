import { describe, expect, it, vi } from 'vitest';
import { createBunkerNarrationController } from './bunkerNarration';

type TestUtterance = SpeechSynthesisUtterance & {
  text: string;
  voice: SpeechSynthesisVoice | null;
};

function voice(name: string, lang: string, isDefault = false): SpeechSynthesisVoice {
  return {
    default: isDefault,
    lang,
    localService: true,
    name,
    voiceURI: name,
  };
}

function fakeSynth() {
  const utterances: TestUtterance[] = [];
  return {
    utterances,
    synth: {
      cancel: vi.fn(),
      speak: vi.fn((utterance: SpeechSynthesisUtterance) => {
        utterances.push(utterance as TestUtterance);
      }),
    },
  };
}

describe('createBunkerNarrationController', () => {
  it('prefers an exact Russian voice and speaks each mission only once', () => {
    const { synth, utterances } = fakeSynth();
    const russian = voice('Milena', 'ru-RU');
    const controller = createBunkerNarrationController({
      synth,
      getVoices: () => [voice('English', 'en-US', true), russian, voice('Russian generic', 'ru')],
    });

    expect(controller.speak('mission_03', 'Проверьте аварийный запас.')).toBe(true);
    expect(controller.speak('mission_03', 'Этот текст не должен прозвучать снова.')).toBe(false);

    expect(utterances).toHaveLength(1);
    expect(utterances[0]).toMatchObject({
      text: 'Проверьте аварийный запас.',
      lang: 'ru-RU',
      voice: russian,
    });
  });

  it('falls back safely when voices are initially empty and uses a Russian voice on replay after they arrive', () => {
    const { synth, utterances } = fakeSynth();
    const russian = voice('Russian later', 'ru-RU');
    let voices: SpeechSynthesisVoice[] = [];
    const controller = createBunkerNarrationController({
      synth,
      getVoices: () => voices,
    });

    expect(controller.speak('mission_04', 'Восстановите канал связи.')).toBe(true);
    expect(utterances[0]).toMatchObject({
      text: 'Восстановите канал связи.',
      lang: 'ru-RU',
      voice: null,
    });

    voices = [russian];
    expect(controller.replay()).toBe(true);
    expect(utterances[1]).toMatchObject({ voice: russian });
  });

  it('stops an unfinished intro and speaks again when the mission identity changes', () => {
    const { synth, utterances } = fakeSynth();
    const controller = createBunkerNarrationController({ synth, getVoices: () => [] });

    expect(controller.speak('mission_03', 'Аварийный запас.')).toBe(true);
    expect(controller.speak('mission_04', 'Межвагонная связь.')).toBe(true);

    expect(utterances.map((utterance) => utterance.text)).toEqual([
      'Аварийный запас.',
      'Межвагонная связь.',
    ]);
    expect(synth.cancel).toHaveBeenCalledTimes(1);
  });

  it('stops immediately when disabled and never speaks while disabled', () => {
    const { synth, utterances } = fakeSynth();
    const controller = createBunkerNarrationController({ synth, getVoices: () => [] });

    controller.setEnabled(false);
    expect(controller.speak('mission_05', 'Выберите маршрут.')).toBe(false);
    expect(controller.replay()).toBe(false);
    expect(utterances).toHaveLength(0);

    controller.setEnabled(true);
    expect(controller.speak('mission_05', 'Выберите маршрут.')).toBe(true);
    controller.setEnabled(false);

    expect(synth.cancel).toHaveBeenCalledTimes(2);
  });

  it('catches synthesis failures so narration cannot interrupt game progress', () => {
    const synth = {
      cancel: vi.fn(),
      speak: vi.fn(() => {
        throw new Error('voice engine unavailable');
      }),
    };
    const controller = createBunkerNarrationController({ synth, getVoices: () => [] });

    expect(() => controller.speak('mission_06', 'Соберите общий протокол.')).not.toThrow();
    expect(controller.speak('mission_06', 'Соберите общий протокол.')).toBe(false);
  });
});
