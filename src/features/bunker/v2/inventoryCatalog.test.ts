import { describe, expect, it } from 'vitest';
import { BUNKER_INVENTORY_CATALOG } from './inventoryCatalog';

describe('Bunker inventory catalog', () => {
  it('contains exactly the six approved emergency items with Russian labels', () => {
    expect(BUNKER_INVENTORY_CATALOG.map((item) => [item.key, item.label])).toEqual([
      ['medkit', 'Аптечка'], ['radio', 'Рация'], ['generator', 'Генератор'],
      ['tools', 'Набор инструментов'], ['water', 'Запас воды'], ['gas_mask', 'Противогаз'],
    ]);
  });
});
