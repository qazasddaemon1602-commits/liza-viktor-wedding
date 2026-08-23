import { describe, expect, it } from 'vitest';
import {
  BUNKER_GLOBAL_GAME_STATES,
  type BunkerGlobalGameState,
} from '../bunkerSession.service';
import {
  BUNKER_OPERATOR_PHRASES,
  getDeterministicFallback,
  getOperatorStage,
  isOperatorWindowOpen,
} from './bunkerOperator.contract';

const OPERATOR_STAGES = [
  'MISSION_02',
  'MISSION_04',
  'MISSION_06',
  'FINAL_30',
] as const satisfies readonly BunkerGlobalGameState[];

const NON_OPERATOR_STAGES = BUNKER_GLOBAL_GAME_STATES.filter(
  (state) => !OPERATOR_STAGES.includes(state as typeof OPERATOR_STAGES[number]),
);

describe('Bunker operator transmission contract', () => {
  it.each([
    ['MISSION_02', 'MISSION_02'],
    ['MISSION_04', 'MISSION_04'],
    ['MISSION_06', 'MISSION_06'],
    ['FINAL_30', 'FINAL_30'],
  ] as const)('maps %s to its operator stage', (globalGameState, stage) => {
    expect(getOperatorStage(globalGameState)).toBe(stage);
  });

  it.each(NON_OPERATOR_STAGES)('returns no operator stage for valid non-operator state %s', (state) => {
    expect(getOperatorStage(state)).toBeNull();
  });

  it.each([
    ['MISSION_02', [
      { key: 'm02_signal', body: 'Сигнал слабый, но я вас слышу. Продолжайте.' },
      { key: 'm02_fragments', body: 'Не доверяйте одному фрагменту. Сверяйте всё, что нашли.' },
    ]],
    ['MISSION_04', [
      { key: 'm04_connection', body: 'Один вагон не дойдёт. Держите связь.' },
      { key: 'm04_share', body: 'Передавайте не только слова. Делитесь тем, что спасёт других.' },
    ]],
    ['MISSION_06', [
      { key: 'm06_between', body: 'У каждого только часть маршрута. Ответ — между вами.' },
      { key: 'm06_every_fragment', body: 'Состав почти у цели. Ни один фрагмент не лишний.' },
    ]],
    ['FINAL_30', [
      { key: 'final_waiting', body: 'Ворота ещё держатся. Я жду ваш сигнал.' },
      { key: 'final_viktor', body: 'Ещё немного. Доведите поезд Виктора до конца.' },
    ]],
  ] as const)('contains the approved phrases for %s', (stage, phrases) => {
    expect(BUNKER_OPERATOR_PHRASES[stage]).toEqual(phrases);
  });

  it.each([
    ['MISSION_02', { key: 'm02_signal', body: 'Сигнал слабый, но я вас слышу. Продолжайте.' }],
    ['MISSION_04', { key: 'm04_connection', body: 'Один вагон не дойдёт. Держите связь.' }],
    ['MISSION_06', { key: 'm06_every_fragment', body: 'Состав почти у цели. Ни один фрагмент не лишний.' }],
    ['FINAL_30', { key: 'final_waiting', body: 'Ворота ещё держатся. Я жду ваш сигнал.' }],
  ] as const)('returns the specified fallback phrase for %s', (stage, fallback) => {
    expect(getDeterministicFallback(stage)).toEqual(fallback);
  });

  it('keeps a 45-second window open before its server-time deadline', () => {
    expect(isOperatorWindowOpen({
      enteredAt: '2026-08-23T12:00:00.000Z',
      serverNow: '2026-08-23T12:00:44.999Z',
      windowSeconds: 45,
    })).toBe(true);
  });

  it('closes a 45-second window exactly at its server-time deadline', () => {
    expect(isOperatorWindowOpen({
      enteredAt: '2026-08-23T12:00:00.000Z',
      serverNow: '2026-08-23T12:00:45.000Z',
      windowSeconds: 45,
    })).toBe(false);
  });

  it('keeps the operator window closed before the stage entry timestamp', () => {
    expect(isOperatorWindowOpen({
      enteredAt: '2026-08-23T12:00:00.000Z',
      serverNow: '2026-08-23T11:59:59.999Z',
      windowSeconds: 45,
    })).toBe(false);
  });

  it('closes a 45-second window after its server-time deadline', () => {
    expect(isOperatorWindowOpen({
      enteredAt: '2026-08-23T12:00:00.000Z',
      serverNow: '2026-08-23T12:00:45.001Z',
      windowSeconds: 45,
    })).toBe(false);
  });
});
