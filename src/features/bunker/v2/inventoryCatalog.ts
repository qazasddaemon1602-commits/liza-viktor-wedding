export const BUNKER_INVENTORY_CATALOG = [
  { key: 'medkit', label: 'Аптечка', description: 'Первая помощь при травмах.' },
  { key: 'radio', label: 'Рация', description: 'Восстанавливает связь внутри состава.' },
  { key: 'generator', label: 'Генератор', description: 'Даёт резервное питание системам вагона.' },
  { key: 'tools', label: 'Набор инструментов', description: 'Помогает устранить механическую поломку.' },
  { key: 'water', label: 'Запас воды', description: 'Безопасный резерв питьевой воды.' },
  { key: 'gas_mask', label: 'Противогаз', description: 'Защита при задымлении и опасной среде.' },
] as const;
export type BunkerInventoryKey = typeof BUNKER_INVENTORY_CATALOG[number]['key'];
export function inventoryDefinition(key: string) { return BUNKER_INVENTORY_CATALOG.find((item) => item.key === key); }
