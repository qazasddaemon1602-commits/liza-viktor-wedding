import type { BunkerGlobalGameState } from '../bunkerSession.service';

export type BunkerOperatorStage = 'MISSION_02' | 'MISSION_04' | 'MISSION_06' | 'FINAL_30';

export type BunkerOperatorPhrase = Readonly<{
  key: string;
  body: string;
}>;

type BunkerOperatorPhraseCatalog = Readonly<Record<
  BunkerOperatorStage,
  readonly [BunkerOperatorPhrase, BunkerOperatorPhrase]
>>;

function phrase(key: string, body: string): BunkerOperatorPhrase {
  return Object.freeze({ key, body });
}

function phrasePair(first: BunkerOperatorPhrase, second: BunkerOperatorPhrase) {
  return Object.freeze([first, second]) as readonly [BunkerOperatorPhrase, BunkerOperatorPhrase];
}

export const BUNKER_OPERATOR_PHRASES: BunkerOperatorPhraseCatalog = Object.freeze({
  MISSION_02: phrasePair(
    phrase('m02_signal', 'Сигнал слабый, но я вас слышу. Продолжайте.'),
    phrase('m02_fragments', 'Не доверяйте одному фрагменту. Сверяйте всё, что нашли.'),
  ),
  MISSION_04: phrasePair(
    phrase('m04_connection', 'Один вагон не дойдёт. Держите связь.'),
    phrase('m04_share', 'Передавайте не только слова. Делитесь тем, что спасёт других.'),
  ),
  MISSION_06: phrasePair(
    phrase('m06_between', 'У каждого только часть маршрута. Ответ — между вами.'),
    phrase('m06_every_fragment', 'Состав почти у цели. Ни один фрагмент не лишний.'),
  ),
  FINAL_30: phrasePair(
    phrase('final_waiting', 'Ворота ещё держатся. Я жду ваш сигнал.'),
    phrase('final_viktor', 'Ещё немного. Доведите поезд Виктора до конца.'),
  ),
});

const OPERATOR_STAGES = new Set<BunkerOperatorStage>([
  'MISSION_02',
  'MISSION_04',
  'MISSION_06',
  'FINAL_30',
]);

const FALLBACK_PHRASE_INDEX: Readonly<Record<BunkerOperatorStage, 0 | 1>> = Object.freeze({
  MISSION_02: 0,
  MISSION_04: 0,
  MISSION_06: 1,
  FINAL_30: 0,
});

export function getOperatorStage(
  globalGameState: BunkerGlobalGameState,
): BunkerOperatorStage | null {
  return OPERATOR_STAGES.has(globalGameState as BunkerOperatorStage)
    ? globalGameState as BunkerOperatorStage
    : null;
}

export function getDeterministicFallback(stage: BunkerOperatorStage): BunkerOperatorPhrase {
  return BUNKER_OPERATOR_PHRASES[stage][FALLBACK_PHRASE_INDEX[stage]];
}

export function isOperatorWindowOpen({
  enteredAt,
  serverNow,
  windowSeconds,
}: {
  enteredAt: string;
  serverNow: string;
  windowSeconds: number;
}): boolean {
  const enteredAtMilliseconds = Date.parse(enteredAt);
  const serverNowMilliseconds = Date.parse(serverNow);
  return Number.isFinite(enteredAtMilliseconds)
    && Number.isFinite(serverNowMilliseconds)
    && Number.isFinite(windowSeconds)
    && windowSeconds >= 0
    && serverNowMilliseconds >= enteredAtMilliseconds
    && serverNowMilliseconds < enteredAtMilliseconds + windowSeconds * 1000;
}
