import { describe, expect, it } from 'vitest';
import {
  bunkerAbilityLabel,
  bunkerArchiveLabel,
  bunkerContentTypeLabel,
  bunkerItemLabel,
  bunkerStageLabel,
  bunkerStatusLabel,
  humanizeBunkerKey,
} from './labels';

describe('bunker v2 labels', () => {
  it('translates stage identifiers into human Russian names', () => {
    expect(bunkerStageLabel('MISSION_01')).toBe('Задание 1 — Лишний пассажир');
    expect(bunkerStageLabel('mission_02')).toBe('Задание 2 — Чёрный ящик');
    expect(bunkerStageLabel('FINAL_30')).toBe('Финал — последние тридцать минут');
  });

  it('never leaks a raw identifier for unknown stages', () => {
    expect(bunkerStageLabel('MISSION_99')).not.toMatch(/MISSION_99/);
    expect(bunkerStageLabel(null)).toBe('Этап не назначен');
  });

  it('translates statuses, inventory and archive metadata', () => {
    expect(bunkerStatusLabel('active')).toBe('Идёт сейчас');
    expect(bunkerStatusLabel('completed')).toBe('Завершено');
    expect(bunkerStatusLabel('excluded')).toBe('Персонаж исключён');
    expect(bunkerItemLabel('medkit')).toBe('Аптечка');
    expect(bunkerContentTypeLabel('document')).toBe('Документ');
    expect(bunkerAbilityLabel('system_access')).toBe('Служебный доступ инженера');
    expect(bunkerArchiveLabel('BK-17').title).toBe('Папка BK-17');
  });

  it('humanizes unknown technical keys instead of leaking machine formatting', () => {
    expect(humanizeBunkerKey('technical_hatch')).toBe('Technical hatch');
    expect(humanizeBunkerKey('')).toBe('Нет данных');
  });
});
