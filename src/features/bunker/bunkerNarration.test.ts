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

  it('does not auto-speak a mission twice when another mission appeared between refreshes', () => {
    const { synth, utterances } = fakeSynth();
    const controller = createBunkerNarrationController({ synth, getVoices: () => [] });

    expect(controller.speak('mission_03', 'Третий этап.')).toBe(true);
    expect(controller.speak('mission_04', 'Четвёртый этап.')).toBe(true);
    expect(controller.speak('mission_03', 'Повторный снимок третьего этапа.')).toBe(false);

    expect(utterances.map((utterance) => utterance.text)).toEqual([
      'Третий этап.',
      'Четвёртый этап.',
    ]);
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
    let unavailable = true;
    const synth = {
      cancel: vi.fn(),
      speak: vi.fn(() => {
        if (unavailable) throw new Error('voice engine unavailable');
      }),
    };
    const controller = createBunkerNarrationController({ synth, getVoices: () => [] });

    expect(controller.speak('mission_06', 'Соберите общий протокол.')).toBe(false);
    unavailable = false;
    expect(controller.speak('mission_06', 'Соберите общий протокол.')).toBe(true);
    expect(synth.speak).toHaveBeenCalledTimes(2);
  });

  it('forgets the once-per-mission cache when a Bunker run resets', () => {
    const { synth, utterances } = fakeSynth();
    const controller = createBunkerNarrationController({ synth, getVoices: () => [] });

    expect(controller.speak('mission_03', 'Первый запуск.')).toBe(true);
    expect(controller.speak('mission_03', 'Повтор первого запуска.')).toBe(false);
    controller.reset();
    expect(controller.speak('mission_03', 'Новый запуск.')).toBe(true);

    expect(utterances.map((utterance) => utterance.text)).toEqual([
      'Первый запуск.',
      'Новый запуск.',
    ]);
  });

  it('uses and clamps the current projector master volume for every utterance', () => {
    const { synth, utterances } = fakeSynth();
    let masterVolume = 0.37;
    const controller = createBunkerNarrationController({
      synth,
      getVoices: () => [],
      getVolume: () => masterVolume,
    });

    controller.speak('mission_03', 'Тише.');
    masterVolume = 4;
    controller.speak('mission_04', 'Не громче максимума.');
    masterVolume = -2;
    controller.speak('mission_05', 'Не ниже нуля.');

    expect(utterances.map((utterance) => utterance.volume)).toEqual([0.37, 1, 0]);
  });
});
