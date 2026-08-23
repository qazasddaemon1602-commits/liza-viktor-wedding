import { useEffect, useState } from 'react';
import {
  isBunkerGlobalMissionState,
  type BunkerGlobalMissionPayload,
  type BunkerGlobalMissionState,
} from './bunkerGlobalMission.service';
import type { BunkerMissionStage, GuestBunkerQuestState } from './bunkerQuest.types';
import type { GuestBunkerGlobalMissionAction } from './bunkerRuntime.service';
import { M03_PROBLEMS, type BunkerMissionContent } from './v2/content/missionContent';

type ActiveQuestState = Extract<GuestBunkerQuestState, { status: 'active' }>;
type InventoryRow = Record<string, unknown>;
type ItemGuide = {
  label: string;
  purpose: string;
  asset: string;
};

const ITEM_GUIDES: Record<string, ItemGuide> = {
  radio: { label: 'Рация', purpose: 'Помогает быстро сверить сообщение с другим вагоном.', asset: '/images/bunker/items/radio.webp' },
  medkit: { label: 'Аптечка', purpose: 'Снижает медицинский риск и помогает пострадавшему.', asset: '/images/bunker/items/medkit.webp' },
  water: { label: 'Вода', purpose: 'Поддерживает людей и помогает при перегреве.', asset: '/images/bunker/items/water.webp' },
  generator: { label: 'Генератор', purpose: 'Даёт резервное питание системам вагона.', asset: '/images/bunker/items/generator.webp' },
  tools: { label: 'Инструменты', purpose: 'Устраняют механическую неисправность.', asset: '/images/bunker/items/tools.webp' },
  gas_mask: { label: 'Противогаз', purpose: 'Защищает при задымлении или утечке.', asset: '/images/bunker/items/gas-mask.webp' },
};

const ITEM_STATUS: Record<string, string> = {
  available: 'ДОСТУПНО',
  used: 'ИСПОЛЬЗОВАНО',
  transferred: 'ПЕРЕДАНО',
  lost: 'ПОТЕРЯНО',
};

function itemKey(row: InventoryRow): string {
  return typeof row.itemKey === 'string' ? row.itemKey.toLocaleLowerCase('en-US') : '';
}

function itemGuide(row: InventoryRow, content?: BunkerMissionContent): ItemGuide {
  const key = itemKey(row);
  const contextual = content?.items.find((item) => item.key === key);
  const fallback = ITEM_GUIDES[key];
  return {
    label: contextual?.label ?? fallback?.label ?? 'Предмет вагона',
    purpose: contextual?.purpose ?? fallback?.purpose ?? 'Назначение откроется в подходящем задании.',
    asset: fallback?.asset ?? '/images/bunker/archive-document.png',
  };
}

function statusLabel(row: InventoryRow): string {
  const status = typeof row.status === 'string' ? row.status : '';
  return ITEM_STATUS[status] ?? 'СТАТУС ОБНОВЛЯЕТСЯ';
}

function quantity(row: InventoryRow): string {
  return typeof row.quantity === 'number' ? String(row.quantity) : '1';
}

function missionOptionLabel(option: string): string {
  return ITEM_GUIDES[option.toLocaleLowerCase('en-US')]?.label ?? option;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
    : [];
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

function normalizedIncludes(value: string, terms: string[]): boolean {
  const normalized = value.toLocaleLowerCase('ru-RU');
  return terms.every((term) => normalized.includes(term.toLocaleLowerCase('ru-RU')));
}

function normalizedIncludesAny(value: string, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const normalized = value.toLocaleLowerCase('ru-RU');
  return terms.some((term) => normalized.includes(term.toLocaleLowerCase('ru-RU')));
}

function humanWagons(value: unknown): { ids: string[]; labels: string[] } {
  if (!Array.isArray(value)) return { ids: [], labels: [] };
  const rows = value.filter(record);
  return {
    ids: rows.flatMap((row) => typeof row.id === 'string' ? [row.id] : []),
    labels: rows.flatMap((row) => {
      if (typeof row.label === 'string' && row.label.trim()) return [row.label];
      if (typeof row.number === 'number') return [`ВАГОН №${row.number}`];
      return [];
    }),
  };
}

type M03ClosureSource = 'ability' | 'wagon' | null;

function m03ClosureSource(
  problemKey: string,
  wagonState: Record<string, unknown>,
): M03ClosureSource {
  const modifiers = record(wagonState.abilityModifiers)
    ? wagonState.abilityModifiers
    : {};
  if (problemKey === 'water') {
    if (modifiers.waterStabilized === true) return 'ability';
    if (wagonState.waterStatus === 'stable') return 'wagon';
  }
  if (problemKey === 'power') {
    if (modifiers.powerStabilized === true) return 'ability';
    if (wagonState.powerStatus === 'stable') return 'wagon';
  }
  if (problemKey === 'mechanical_navigation') {
    if (modifiers.technicalDoorUnlocked === true) return 'ability';
    if (wagonState.technicalDoorStatus === 'unlocked') return 'wagon';
  }
  return null;
}

function transferableItems(value: unknown): Array<{ lotId: string; itemKey: string; quantity: number }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!record(entry)
      || typeof entry.lotId !== 'string'
      || !entry.lotId.trim()
      || typeof entry.itemKey !== 'string'
      || !entry.itemKey.trim()
      || typeof entry.quantity !== 'number'
      || !Number.isInteger(entry.quantity)
      || entry.quantity < 1) return [];
    return [{ lotId: entry.lotId, itemKey: entry.itemKey, quantity: entry.quantity }];
  });
}

function selectableProfiles(value: unknown): Array<{
  profileId: string; realName: string; profession: string;
}> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!record(entry)
      || typeof entry.profileId !== 'string'
      || typeof entry.realName !== 'string'
      || typeof entry.profession !== 'string') return [];
    return [{
      profileId: entry.profileId,
      realName: entry.realName,
      profession: entry.profession,
    }];
  });
}

export function availableInventoryKeys(inventory: InventoryRow[]): string[] {
  return inventory
    .filter((row) => row.status === 'available' && Number(row.quantity ?? 0) > 0)
    .map(itemKey)
    .filter(Boolean);
}

type InventoryProps = {
  inventory: InventoryRow[];
  missionContent?: BunkerMissionContent;
};

export function BunkerInventoryCards({ inventory, missionContent }: InventoryProps) {
  if (inventory.length === 0) {
    return <p>Инвентарь вагона пока пуст. Найденные предметы появятся здесь автоматически.</p>;
  }

  const relevantKeys = new Set(missionContent?.items.map((item) => item.key) ?? []);
  return (
    <div className="bunker-player-list bunker-inventory-cards">
      {inventory.map((row, index) => {
        const key = itemKey(row);
        const guide = itemGuide(row, missionContent);
        const isAvailable = row.status === 'available' && Number(row.quantity ?? 0) > 0;
        const relevant = relevantKeys.has(key) && isAvailable;
        return (
          <article key={typeof row.id === 'string' ? row.id : `${key || 'item'}-${index}`}>
            <img
              className="bunker-inventory-card__icon"
              data-testid="bunker-inventory-icon"
              src={guide.asset}
              alt={guide.label}
              width="96"
              height="96"
              loading="lazy"
            />
            <div>
              <h3>{guide.label}</h3>
              <strong><span>{statusLabel(row)}</span> · {quantity(row)} ШТ.</strong>
              <p>{guide.purpose}</p>
              <small>{relevant
                ? 'ПРИГОДИТСЯ В ТЕКУЩЕЙ МИССИИ'
                : isAvailable
                  ? 'СОХРАНИТЕ ДЛЯ ПОДХОДЯЩЕЙ СИТУАЦИИ'
                  : 'НЕДОСТУПНО ДЛЯ ПРИМЕНЕНИЯ'}</small>
            </div>
          </article>
        );
      })}
    </div>
  );
}

type MissionActionsProps = {
  state?: GuestBunkerQuestState | null;
  globalMissionState?: string | null;
  globalAction?: GuestBunkerGlobalMissionAction | null;
  inventory?: InventoryRow[];
  wagonState?: Record<string, unknown>;
  submitting?: boolean;
  feedback?: string;
  onGlobalMission?: (
    missionState: BunkerGlobalMissionState,
    payload: BunkerGlobalMissionPayload,
  ) => Promise<void> | void;
  onMission: (stage: BunkerMissionStage, answer: string) => Promise<void> | void;
  onFinalCode: (code: string) => Promise<void> | void;
};

type GlobalActionFormProps = {
  action: GuestBunkerGlobalMissionAction;
  inventory: InventoryRow[];
  wagonState: Record<string, unknown>;
  submitting: boolean;
  onSubmit: (missionState: BunkerGlobalMissionState, payload: BunkerGlobalMissionPayload) => void;
};

function GlobalActionForm({ action, inventory, wagonState, submitting, onSubmit }: GlobalActionFormProps) {
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [chronology, setChronology] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [transferLotId, setTransferLotId] = useState('');
  const [transferToWagonId, setTransferToWagonId] = useState('');
  const [routeChoice, setRouteChoice] = useState<'safe' | 'short' | ''>('');
  const [routeItem, setRouteItem] = useState('');
  const [protocolConfirmed, setProtocolConfirmed] = useState(false);
  const [protocolCode, setProtocolCode] = useState('');
  const requirements = action.requirements;
  const availableInWagon = new Set(availableInventoryKeys(inventory));
  const availableForMission = stringList(requirements.availableItemKeys)
    .filter((key) => availableInWagon.has(key));
  const m03ClosedItemKeys = M03_PROBLEMS
    .filter((problem) => m03ClosureSource(problem.key, wagonState) !== null)
    .map((problem) => problem.resolvingItemKey);
  const m03ClosedSignature = m03ClosedItemKeys.join('|');
  useEffect(() => {
    if (!m03ClosedSignature) return;
    const closed = new Set<string>(m03ClosedItemKeys);
    setSelectedItems((current) => current.filter((key) => !closed.has(key)));
  }, [m03ClosedSignature]);
  const toggle = (values: string[], value: string, max = Number.POSITIVE_INFINITY) => (
    values.includes(value) ? values.filter((entry) => entry !== value) : values.length < max ? [...values, value] : values
  );

  if (action.missionState === 'MISSION_01') {
    const quota = positiveInteger(requirements.exclusionCount, 1);
    const profiles = selectableProfiles(requirements.selectableProfiles);
    return (
      <div className="bunker-global-action bunker-global-action--selection">
        <h3>ВЫБОР СЮЖЕТНЫХ ПЕРСОНАЖЕЙ</h3>
        <p>Выберите ровно {quota}. Обсудите выбор всем вагоном.</p>
        <p className="bunker-mission-actions__safety">Это решение касается только вымышленных персонажей. Реальные гости остаются в игре и продолжают участвовать.</p>
        <div className="bunker-global-action__choices">
          {profiles.map((profile) => (
            <label key={profile.profileId}>
              <input
                type="checkbox"
                checked={selectedProfiles.includes(profile.profileId)}
                disabled={submitting || (!selectedProfiles.includes(profile.profileId) && selectedProfiles.length >= quota)}
                onChange={() => setSelectedProfiles(toggle(selectedProfiles, profile.profileId, quota))}
              />
              <span>{profile.realName} · {profile.profession}</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={submitting || selectedProfiles.length !== quota}
          onClick={() => onSubmit(action.missionState, { selectedProfileIds: selectedProfiles })}
        >ПОДТВЕРДИТЬ ВЫБОР</button>
      </div>
    );
  }

  if (action.missionState === 'MISSION_02') {
    const minLength = positiveInteger(requirements.minLength, 1);
    const fragments = stringList(requirements.fragments);
    const requiredTerms = stringList(requirements.requiredTerms);
    const chronologyValid = chronology.trim().length >= minLength
      && normalizedIncludesAny(chronology, requiredTerms);
    return (
      <div className="bunker-global-action">
        <h3>ВОССТАНОВИТЕ ХРОНОЛОГИЮ</h3>
        <p>Соберите общую версию событий по найденным фрагментам и запишите её своими словами.</p>
        <div className="bunker-global-action__clues" aria-label="Фрагменты чёрного ящика">
          {fragments.map((fragment, index) => (
            <p key={fragment}><strong>ФРАГМЕНТ {index + 1}</strong><span>{fragment}</span></p>
          ))}
        </div>
        <label>
          <span>Хронология аварии</span>
          <textarea value={chronology} disabled={submitting} onChange={(event) => setChronology(event.target.value)} />
        </label>
        <p className="bunker-mission-actions__safety">
          Минимум {minLength} символов. Упомяните опорную деталь из фрагментов: BK-17, Сектор 04, маршрут, тоннель или питание.
        </p>
        <button
          type="button"
          disabled={submitting || !chronologyValid}
          onClick={() => onSubmit(action.missionState, { chronology: chronology.trim() })}
        >ОТПРАВИТЬ ХРОНОЛОГИЮ</button>
      </div>
    );
  }

  if (action.missionState === 'MISSION_03') {
    const minItems = positiveInteger(requirements.minItems, 1);
    const maxItems = positiveInteger(requirements.maxItems, 3);
    const authoritativeProblems = M03_PROBLEMS.filter(
      (problem) => m03ClosureSource(problem.key, wagonState) !== null,
    );
    const selectedProblems = M03_PROBLEMS.filter((problem) => (
      m03ClosureSource(problem.key, wagonState) === null
      && selectedItems.includes(problem.resolvingItemKey)
    ));
    const resolvedProblems = [...authoritativeProblems, ...selectedProblems];
    const unresolvedProblems = M03_PROBLEMS.filter((problem) => (
      m03ClosureSource(problem.key, wagonState) === null
      && !selectedItems.includes(problem.resolvingItemKey)
    ));
    const unassignedItems = selectedItems.filter((key) => !M03_PROBLEMS.some((problem) => problem.resolvingItemKey === key));
    const resolvingItemKeys = new Set<string>(M03_PROBLEMS.map((problem) => problem.resolvingItemKey));
  const additionalItems = availableForMission.filter((key) => !resolvingItemKeys.has(key));
    return (
      <div className="bunker-global-action bunker-global-action--selection">
        <h3>РАСПРЕДЕЛИТЕ АВАРИЙНЫЙ ЗАПАС</h3>
        <p>Сначала выберите риск, который важнее закрыть. Затем отметьте предмет под ним. Использованные, потерянные и переданные предметы выбрать нельзя.</p>
        <ol className="bunker-m03-problem-board" aria-label="Риски вагона">
          {M03_PROBLEMS.map((problem) => {
            const guide = itemGuide({ itemKey: problem.resolvingItemKey });
            const closureSource = m03ClosureSource(problem.key, wagonState);
            const selected = selectedItems.includes(problem.resolvingItemKey);
            const resolved = closureSource !== null || selected;
            const available = availableForMission.includes(problem.resolvingItemKey);
            return (
              <li key={problem.key} data-status={resolved ? 'resolved' : 'open'}>
                <img src={guide.asset} alt={guide.label} width="96" height="96" loading="lazy" />
                <div>
                  <p>{closureSource === 'ability'
                    ? 'ЗАКРЫТО СПОСОБНОСТЬЮ'
                    : closureSource === 'wagon'
                      ? 'ЗАКРЫТО СОСТОЯНИЕМ ВАГОНА'
                      : selected
                        ? 'ЗАКРЫТО ВЫБРАННЫМ ЗАПАСОМ'
                        : 'РИСК ОСТАЁТСЯ'}</p>
                  <h4>{problem.label}</h4>
                  <span>{problem.risk}</span>
                  <strong>{closureSource !== null
                    ? `${guide.label} не требуется: риск уже закрыт авторитетным состоянием вагона. Сохраните запас.`
                    : selected
                      ? `Выбран предмет: ${guide.label}. Этот риск закрыт.`
                    : available
                      ? `Отметьте ${guide.label}, чтобы закрыть этот риск.`
                      : `Нужный предмет сейчас недоступен в инвентаре вагона.`}</strong>
                  {available && (
                    <label className="bunker-m03-problem-board__control">
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={submitting || closureSource !== null || (!selected && selectedItems.length >= maxItems)}
                        onChange={() => setSelectedItems(toggle(selectedItems, problem.resolvingItemKey, maxItems))}
                      />
                      <span>{closureSource !== null
                        ? `Сохранить: ${guide.label} · запас не требуется`
                        : `Применить: ${guide.label}`}</span>
                    </label>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <section className="bunker-m03-preview" aria-label="Предварительный итог" aria-live="polite">
          <h4>ПРОВЕРКА РЕШЕНИЯ</h4>
          <p>Выбрано предметов: {selectedItems.length} из {maxItems}</p>
          <p>Закрыто рисков: {resolvedProblems.length} из {M03_PROBLEMS.length}</p>
          <p>Осталось рисков: {unresolvedProblems.length} из {M03_PROBLEMS.length}</p>
          {selectedProblems.length > 0 ? (
            <ul>
              {selectedProblems.map((problem) => (
                <li key={problem.key}>{itemGuide({ itemKey: problem.resolvingItemKey }).label} закрывает риск «{problem.label}».</li>
              ))}
            </ul>
          ) : <p>Пока не выбран ни один предмет.</p>}
          {authoritativeProblems.length > 0 && (
            <ul>
              {authoritativeProblems.map((problem) => (
                <li key={`authoritative-${problem.key}`}>Риск «{problem.label}» уже закрыт состоянием вагона — соответствующий запас сохранён.</li>
              ))}
            </ul>
          )}
          {unassignedItems.length > 0 && (
            <p>{unassignedItems.map((key) => itemGuide({ itemKey: key }).label).join(', ')} пока не закрывает один из пяти рисков на этой доске.</p>
          )}
        </section>
        {additionalItems.length > 0 && (
          <fieldset className="bunker-m03-additional-items" aria-label="Дополнительные доступные предметы">
            <legend>ДОПОЛНИТЕЛЬНЫЕ ДОСТУПНЫЕ ПРЕДМЕТЫ</legend>
            <p>Эти предметы можно отправить в решении, но они не закрывают ни один из пяти рисков на этой доске.</p>
            <div className="bunker-global-action__choices bunker-m03-additional-items__choices">
              {additionalItems.map((key) => {
                const guide = itemGuide({ itemKey: key });
                return (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(key)}
                      disabled={submitting || (!selectedItems.includes(key) && selectedItems.length >= maxItems)}
                      onChange={() => setSelectedItems(toggle(selectedItems, key, maxItems))}
                    />
                    <img src={guide.asset} alt="" width="64" height="64" loading="lazy" />
                    <span><strong>{guide.label}</strong><small>{guide.purpose}</small></span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        <button
          type="button"
          disabled={submitting || selectedItems.length < minItems || selectedItems.length > maxItems}
          onClick={() => onSubmit(action.missionState, { itemKeys: selectedItems })}
        >ПРИМЕНИТЬ ЗАПАС</button>
      </div>
    );
  }

  if (action.missionState === 'MISSION_04') {
    const group = humanWagons(requirements.groupWagons);
    const partners = humanWagons(requirements.partnerWagons);
    const fallbackSize = positiveInteger(requirements.groupSize ?? requirements.groupWagonCount, 0);
    const messageFragment = typeof requirements.messageFragment === 'string'
      ? requirements.messageFragment
      : '';
    const minLength = positiveInteger(requirements.minLength, 1);
    const requiredIncludes = stringList(requirements.requiredIncludes);
    const requiredTerms = stringList(requirements.requiredTerms);
    const transferOptions = transferableItems(requirements.transferableItems)
      .filter((item) => availableInWagon.has(item.itemKey));
    const selectedTransfer = transferOptions.find((item) => item.lotId === transferLotId) ?? null;
    const transferDestination = partners.ids.includes(transferToWagonId)
      ? partners.labels[partners.ids.indexOf(transferToWagonId)]
      : '';
    const messageValid = message.trim().length >= minLength
      && normalizedIncludes(message, requiredIncludes)
      && normalizedIncludesAny(message, requiredTerms);
    const transferValid = !transferLotId || Boolean(selectedTransfer && transferDestination);
    const submitExchange = () => {
      const base = {
        message: message.trim(),
        ...(partners.ids.length > 0 ? { partnerWagonIds: partners.ids } : {}),
      };
      if (selectedTransfer && transferDestination) {
        onSubmit(action.missionState, {
          ...base,
          transferLotId: selectedTransfer.lotId,
          transferToWagonId,
        });
        return;
      }
      onSubmit(action.missionState, base);
    };
    return (
      <div className="bunker-global-action bunker-m04-exchange">
        <h3>МЕЖВАГОННАЯ СВЯЗЬ</h3>
        <p>{group.labels.length > 0 ? `Ваша группа: ${group.labels.join(' · ')}` : `В вашей группе ${fallbackSize || 'несколько'} вагонов.`}</p>
        <ol className="bunker-m04-stepper" aria-label="Порядок межвагонного обмена">
          <li>
            <strong>ШАГ 1</strong>
            <div>
              <h4>НАЙДИТЕ ПАРТНЁРСКИЙ ВАГОН</h4>
              <p>{partners.labels.length > 0 ? `Связаться: ${partners.labels.join(' · ')}` : 'Состав партнёров синхронизируется.'}</p>
            </div>
          </li>
          <li>
            <strong>ШАГ 2</strong>
            <div>
              <h4>ПРОЧИТАЙТЕ СВОЙ ФРАГМЕНТ</h4>
              {messageFragment
                ? <p className="bunker-global-action__fragment">Ваша часть сообщения: <strong>{messageFragment}</strong></p>
                : <p>Фрагмент появится после синхронизации.</p>}
            </div>
          </li>
          <li>
            <strong>ШАГ 3</strong>
            <div>
              <h4>ОБМЕНЯЙТЕСЬ ДАННЫМИ И ПРЕДМЕТОМ</h4>
              <p>Передайте фрагмент партнёрам. При необходимости выберите один реальный запас вагона — после отправки он появится у получателя.</p>
              <label>
                <span>Предмет для передачи</span>
                <select
                  value={transferLotId}
                  disabled={submitting}
                  onChange={(event) => {
                    setTransferLotId(event.target.value);
                    setTransferToWagonId('');
                  }}
                >
                  <option value="">Без передачи предмета</option>
                  {transferOptions.map((item) => (
                    <option key={item.lotId} value={item.lotId}>
                      {itemGuide({ itemKey: item.itemKey }).label} · {item.quantity} ШТ.
                    </option>
                  ))}
                </select>
              </label>
              {transferLotId && (
                <label>
                  <span>Кому передать предмет</span>
                  <select
                    value={transferToWagonId}
                    disabled={submitting}
                    onChange={(event) => setTransferToWagonId(event.target.value)}
                  >
                    <option value="">Выберите партнёрский вагон</option>
                    {partners.ids.map((id, index) => (
                      <option key={id} value={id}>{partners.labels[index] ?? `ВАГОН ${index + 1}`}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </li>
          <li>
            <strong>ШАГ 4</strong>
            <div>
              <h4>ПРОВЕРЬТЕ И ОТПРАВЬТЕ</h4>
              <label>
                <span>Сообщение партнёрам</span>
                <textarea value={message} disabled={submitting} onChange={(event) => setMessage(event.target.value)} />
              </label>
              <p className="bunker-mission-actions__safety">
                Запишите не короче {minLength} символов: в сообщении должны быть «04» и одна опорная деталь — тоннель, маршрут, канал или сектор.
              </p>
              <section
                className="bunker-m04-preview"
                role="status"
                aria-label="Предварительная проверка обмена"
                aria-live="polite"
              >
                <h5>ЧТО БУДЕТ ОТПРАВЛЕНО</h5>
                <p>{messageValid ? `Сообщение готово: ${message.trim()}` : 'Сообщение пока не прошло проверку.'}</p>
                <p>{selectedTransfer && transferDestination
                  ? `${itemGuide({ itemKey: selectedTransfer.itemKey }).label} · ${selectedTransfer.quantity} ШТ. → ${transferDestination}`
                  : transferLotId
                    ? 'Выберите получателя предмета.'
                    : 'Предмет не передаётся.'}</p>
              </section>
            </div>
          </li>
        </ol>
        <button
          type="button"
          disabled={submitting || !messageValid || !transferValid}
          onClick={submitExchange}
        >ОТПРАВИТЬ СООБЩЕНИЕ</button>
      </div>
    );
  }

  if (action.missionState === 'MISSION_05') {
    return (
      <div className="bunker-global-action">
        <h3>ВЫБЕРИТЕ МАРШРУТ</h3>
        <fieldset className="bunker-global-action__routes">
          <legend>Решение вагона</legend>
          <label><input type="radio" name="route" value="safe" checked={routeChoice === 'safe'} disabled={submitting} onChange={() => setRouteChoice('safe')} /><span>Безопасный маршрут · дольше, но с меньшим риском</span></label>
          <label><input type="radio" name="route" value="short" checked={routeChoice === 'short'} disabled={submitting} onChange={() => setRouteChoice('short')} /><span>Короткий маршрут · быстрее, но опаснее</span></label>
        </fieldset>
        <label>
          <span>Предмет для маршрута</span>
          <select value={routeItem} disabled={submitting} onChange={(event) => setRouteItem(event.target.value)}>
            <option value="">Без предмета</option>
            {availableForMission.map((key) => <option key={key} value={key}>{itemGuide({ itemKey: key }).label}</option>)}
          </select>
        </label>
        <button
          type="button"
          disabled={submitting || !routeChoice}
          onClick={() => onSubmit(action.missionState, {
            routeChoice: routeChoice || 'safe',
            itemKey: routeItem || null,
          })}
        >ПОДТВЕРДИТЬ МАРШРУТ</button>
      </div>
    );
  }

  const required = humanWagons(requirements.requiredWagons);
  const rewardFragment = typeof requirements.rewardFragment === 'string' ? requirements.rewardFragment : null;
  const protocolFragments = stringList(requirements.protocolFragments);
  return (
    <div className="bunker-global-action">
      <h3>ОБЩИЙ ПРОТОКОЛ</h3>
      <p>{required.labels.length > 0 ? `Вагоны протокола: ${required.labels.join(' · ')}` : 'Список вагонов протокола синхронизируется.'}</p>
      <div className="bunker-global-action__clues" aria-label="Фрагменты общего протокола">
        {protocolFragments.map((fragment) => <p key={fragment}><span>{fragment}</span></p>)}
      </div>
      {rewardFragment && <p className="bunker-global-action__fragment">Фрагмент сервера: <strong>{rewardFragment}</strong></p>}
      <label>
        <span>Архивная последовательность</span>
        <input
          inputMode="numeric"
          value={protocolCode}
          disabled={submitting}
          onChange={(event) => setProtocolCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
        />
      </label>
      <label>
        <input type="checkbox" checked={protocolConfirmed} disabled={submitting} onChange={(event) => setProtocolConfirmed(event.target.checked)} />
        <span>Данные сверены с указанными вагонами</span>
      </label>
      <button
        type="button"
        disabled={submitting || !protocolConfirmed || protocolCode.length !== 4}
        onClick={() => onSubmit(action.missionState, { protocolConfirmed: true, protocolCode })}
      >ПОДТВЕРДИТЬ ПРОТОКОЛ</button>
    </div>
  );
}

export function BunkerMissionActions({
  state,
  globalMissionState = null,
  globalAction = null,
  inventory = [],
  wagonState = {},
  submitting = false,
  feedback = '',
  onGlobalMission = () => undefined,
  onMission,
  onFinalCode,
}: MissionActionsProps) {
  const [answer, setAnswer] = useState('');
  const [finalCode, setFinalCode] = useState('');
  const submitCode = () => {
    const normalized = finalCode.replace(/\D/g, '');
    if (!normalized || submitting) return;
    void onFinalCode(normalized);
  };

  if (isBunkerGlobalMissionState(globalMissionState)) {
    const handleGlobalSubmit = (missionState: BunkerGlobalMissionState, payload: BunkerGlobalMissionPayload) => {
      if (submitting) return;
      void onGlobalMission(missionState, payload);
    };
    return (
      <section className="bunker-mission-actions" aria-label="Действие вагона">
        <p className="bunker-player-dashboard__index">ДЕЙСТВИЕ ВАГОНА</p>
        <p className="bunker-mission-actions__confirmation">
          Отправить решение может любой участник этого вагона. После отправки оно становится общим решением команды.
        </p>
        {!globalAction || globalAction.missionState !== globalMissionState ? (
          <p>Сервер готовит действие текущей миссии. Оставайтесь на этой странице.</p>
        ) : globalAction.completed ? (
          <div className="bunker-mission-actions__result" role="status">
            <h3>РЕШЕНИЕ ВАГОНА ПРИНЯТО</h3>
            <p>Задание завершено. Форма заблокирована от повторной отправки.</p>
            {globalAction.missionState === 'MISSION_06'
              && typeof globalAction.requirements.rewardFragment === 'string'
              && <p>Фрагмент протокола: <strong>{globalAction.requirements.rewardFragment}</strong></p>}
          </div>
        ) : (
          <GlobalActionForm
            action={globalAction}
            inventory={inventory}
            wagonState={wagonState}
            submitting={submitting}
            onSubmit={handleGlobalSubmit}
          />
        )}
        {feedback && <p className="bunker-mission-actions__feedback" role="status">{feedback}</p>}
      </section>
    );
  }

  if (globalMissionState === 'FINAL_30'
    || globalMissionState === 'BUNKER_OPEN'
    || globalMissionState === 'FINISHED') {
    const unlocked = globalMissionState !== 'FINAL_30'
      || (state?.status === 'active' && state.final.unlocked);
    return (
      <section className="bunker-mission-actions" aria-label="Действие вагона">
        <p className="bunker-player-dashboard__index">ФИНАЛЬНЫЙ ПРОТОКОЛ</p>
        {unlocked ? (
          <div className="bunker-mission-actions__result" role="status">
            <h3>ДОСТУП ПОЛУЧЕН</h3>
            <p>Финальный протокол принят.</p>
          </div>
        ) : (
          <div className="bunker-mission-actions__form">
            <h3>ОБЩИЙ КОД БУНКЕРА</h3>
            {state?.status === 'active' && state.team?.fragment && (
              <p>Фрагмент вашего вагона: <strong>{state.team.fragment}</strong></p>
            )}
            <label>
              <span>Общий код Бункера</span>
              <input
                inputMode="numeric"
                autoComplete="off"
                value={finalCode}
                disabled={submitting}
                onChange={(event) => setFinalCode(event.target.value.replace(/\D/g, '').slice(0, 10))}
                onKeyDown={(event) => { if (event.key === 'Enter') submitCode(); }}
              />
            </label>
            <button type="button" disabled={submitting || !finalCode} onClick={submitCode}>ОТКРЫТЬ ШЛЮЗ</button>
          </div>
        )}
        {feedback && <p className="bunker-mission-actions__feedback" role="status">{feedback}</p>}
      </section>
    );
  }

  if (!state || state.status !== 'active') {
    return (
      <section className="bunker-mission-actions" aria-label="Действие вагона">
        <p className="bunker-player-dashboard__index">ДЕЙСТВИЕ ВАГОНА</p>
        <p>Ведущий пока не открыл действие для телефона. Следите за общей задачей выше.</p>
      </section>
    );
  }

  const stage = state.team?.stage;
  const mission = state.team?.mission;
  const submitAnswer = () => {
    if (!stage || !answer.trim() || submitting) return;
    void onMission(stage, answer.trim());
  };
  return (
    <section className="bunker-mission-actions" aria-label="Действие вагона">
      <p className="bunker-player-dashboard__index">ДЕЙСТВИЕ ВАГОНА</p>
      <p className="bunker-mission-actions__confirmation">
        Отправить ответ может любой участник этого вагона. Система примет решение и покажет ведущему прогресс команды.
      </p>

      {(state.phase === 'mission_a' || state.phase === 'mission_b') && state.team && (
        state.team.completed ? (
          <div className="bunker-mission-actions__result" role="status">
            <h3>ЗАДАНИЕ ВЫПОЛНЕНО</h3>
            {state.team.fragment && <p>Фрагмент вагона: <strong>{state.team.fragment}</strong></p>}
            <p>Ожидайте следующую команду ведущего.</p>
          </div>
        ) : mission && stage ? (
          <div className="bunker-mission-actions__form">
            <h3>{mission.title}</h3>
            <p>{mission.prompt}</p>
            {mission.options.length > 0 ? (
              <div className="bunker-mission-actions__options">
                {mission.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={submitting}
                    onClick={() => void onMission(stage, option)}
                  >
                    {missionOptionLabel(option)}
                  </button>
                ))}
              </div>
            ) : (
              <div className="bunker-mission-actions__answer">
                <label>
                  <span>ОТВЕТ ВАГОНА</span>
                  <input
                    value={answer}
                    disabled={submitting}
                    onChange={(event) => setAnswer(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') submitAnswer(); }}
                  />
                </label>
                <button type="button" disabled={submitting || !answer.trim()} onClick={submitAnswer}>
                  ПРОВЕРИТЬ ОТВЕТ
                </button>
              </div>
            )}
          </div>
        ) : <p>Задание синхронизируется. Оставайтесь на этой странице.</p>
      )}

      {(state.phase === 'final' || state.phase === 'completed') && (
        state.final.unlocked ? (
          <div className="bunker-mission-actions__result" role="status">
            <h3>ДОСТУП ПОЛУЧЕН</h3>
            <p>Финальный протокол принят.</p>
          </div>
        ) : (
          <div className="bunker-mission-actions__form">
            <h3>ОБЩИЙ КОД БУНКЕРА</h3>
            {state.team?.fragment && <p>Фрагмент вашего вагона: <strong>{state.team.fragment}</strong></p>}
            <label>
              <span>Общий код Бункера</span>
              <input
                inputMode="numeric"
                autoComplete="off"
                value={finalCode}
                disabled={submitting}
                onChange={(event) => setFinalCode(event.target.value.replace(/\D/g, '').slice(0, 10))}
                onKeyDown={(event) => { if (event.key === 'Enter') submitCode(); }}
              />
            </label>
            <button type="button" disabled={submitting || !finalCode} onClick={submitCode}>ОТКРЫТЬ ШЛЮЗ</button>
          </div>
        )
      )}

      {!['mission_a', 'mission_b', 'final', 'completed'].includes(state.phase) && (
        <p>Сейчас изучите досье и дождитесь команды ведущего. Отправлять ответ пока не нужно.</p>
      )}
      {feedback && <p className="bunker-mission-actions__feedback" role="status">{feedback}</p>}
    </section>
  );
}
