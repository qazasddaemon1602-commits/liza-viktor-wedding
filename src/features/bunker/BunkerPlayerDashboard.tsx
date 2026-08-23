import { useEffect, useRef, useState } from 'react';
import type {
  ActiveGuestBunkerRuntime,
  GuestBunkerAbilityResult,
} from './bunkerRuntime.service';
import { BunkerResponsivePicture, type BunkerAsset } from './BunkerResponsivePicture';
import { BunkerMissionBriefing } from './BunkerMissionBriefing';
import {
  availableInventoryKeys,
  BunkerInventoryCards,
  BunkerMissionActions,
} from './BunkerMissionActions';
import type { BunkerMissionStage, GuestBunkerQuestState } from './bunkerQuest.types';
import {
  isBunkerGlobalMissionState,
  type BunkerGlobalMissionPayload,
  type BunkerGlobalMissionState,
} from './bunkerGlobalMission.service';
import { getBunkerMissionContent } from './v2/content/missionContent';

const SECTIONS = [
  'МОЙ ВАГОН', 'ПЕРСОНАЖ', 'ПАССАЖИРЫ', 'ИНВЕНТАРЬ',
  'АРХИВ', 'СОСТОЯНИЕ', 'ТЕКУЩЕЕ ЗАДАНИЕ',
] as const;
type Section = typeof SECTIONS[number];

const PRIMARY_SECTIONS: readonly Section[] = [
  'МОЙ ВАГОН', 'ПЕРСОНАЖ', 'ИНВЕНТАРЬ', 'ТЕКУЩЕЕ ЗАДАНИЕ',
];
const OVERFLOW_SECTIONS = SECTIONS.filter((section) => !PRIMARY_SECTIONS.includes(section));
const LARGE_TEXT_STORAGE_KEY = 'bunker.largeText.v1';
const COMPACT_NAVIGATION_QUERY = '(max-width: 760px)';

function readLargeTextPreference(): boolean {
  try {
    return window.localStorage.getItem(LARGE_TEXT_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function useCompactNavigation(): boolean {
  const [compact, setCompact] = useState(() => (
    typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia(COMPACT_NAVIGATION_QUERY).matches
  ));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(COMPACT_NAVIGATION_QUERY);
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return compact;
}

function rows(value: unknown[]): Record<string, unknown>[] {
  return value.filter((entry): entry is Record<string, unknown> => (
    typeof entry === 'object' && entry !== null && !Array.isArray(entry)
  ));
}

type ArchiveEntry = {
  artifactKey: string;
  contentType: string;
  decryptionStatus: string;
  scope: string;
};

type CurrentMission = { id: string };

function nonEmptyText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function archiveEntries(value: unknown[]): ArchiveEntry[] {
  return rows(value).flatMap((entry) => {
    const artifactKey = nonEmptyText(entry.artifactKey);
    const contentType = nonEmptyText(entry.contentType);
    const decryptionStatus = nonEmptyText(entry.decryptionStatus);
    const scope = nonEmptyText(entry.scope);
    return artifactKey && contentType && decryptionStatus && scope
      ? [{ artifactKey, contentType, decryptionStatus, scope }]
      : [];
  });
}

function currentMission(value: unknown): CurrentMission | null {
  const entry = rows([value])[0];
  const id = entry ? nonEmptyText(entry.id) : null;
  return id ? { id } : null;
}

function archiveArtwork(entry: ArchiveEntry): BunkerAsset | null {
  const key = entry.artifactKey.toLocaleLowerCase('en-US');
  const contentType = entry.contentType.toLocaleLowerCase('en-US');
  if (key.includes('bk17') || key.includes('bk-17')) return 'archive-bk17';
  if (contentType === 'card' || key.includes('card')) return 'archive-card';
  if (contentType === 'document' || key.includes('document')) return 'archive-document';
  return null;
}

type BunkerPlayerDashboardProps = {
  runtime: ActiveGuestBunkerRuntime;
  connectionError?: string;
  questState?: GuestBunkerQuestState | null;
  missionFeedback?: string;
  missionSubmitting?: boolean;
  onMission?: (stage: BunkerMissionStage, answer: string) => Promise<void> | void;
  onFinalCode?: (code: string) => Promise<void> | void;
  onGlobalMission?: (
    missionState: BunkerGlobalMissionState,
    payload: BunkerGlobalMissionPayload,
  ) => Promise<void> | void;
  onAbility?: () => Promise<GuestBunkerAbilityResult>;
};

type BunkerAbilityActionCardProps = {
  runtime: ActiveGuestBunkerRuntime;
  onAbility?: () => Promise<GuestBunkerAbilityResult>;
};

function BunkerAbilityActionCard({ runtime, onAbility }: BunkerAbilityActionCardProps) {
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GuestBunkerAbilityResult | null>(null);
  const [error, setError] = useState('');
  const requestInFlight = useRef(false);
  const action = runtime.character.abilityAction;
  if (!action) return null;

  const remaining = result?.abilityUsesRemaining ?? runtime.character.abilityUsesRemaining;
  const usable = action.applicable && remaining > 0 && Boolean(onAbility);

  const submit = async () => {
    if (!usable || !onAbility || requestInFlight.current) return;
    requestInFlight.current = true;
    setSubmitting(true);
    setError('');
    try {
      const next = await onAbility();
      setResult(next);
      setConfirming(false);
    } catch {
      setError('Способность не активировалась. Повторите отправку — заряд не пропадёт.');
    } finally {
      requestInFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section className="bunker-player-ability-action" aria-label="Особая способность персонажа">
      <p className="bunker-player-dashboard__index">ЛИЧНОЕ ДЕЙСТВИЕ</p>
      <h3>ОСОБАЯ СПОСОБНОСТЬ</h3>
      <strong>{action.effectLabel}</strong>
      <p>{action.effectDescription}</p>
      <p className="bunker-player-ability-action__uses">
        ОСТАЛОСЬ ИСПОЛЬЗОВАНИЙ · {remaining}
      </p>

      {result && (
        <p className="bunker-player-ability-action__result" role="status">
          {result.resultCopy}
        </p>
      )}
      {error && <p className="bunker-player-ability-action__error" role="alert">{error}</p>}

      {usable && !result && !confirming && (
        <button type="button" onClick={() => setConfirming(true)}>
          ИСПОЛЬЗОВАТЬ СПОСОБНОСТЬ
        </button>
      )}
      {usable && !result && confirming && (
        <div className="bunker-player-ability-action__confirm" role="group" aria-label="Подтверждение способности">
          <p>Действие нельзя отменить: будет израсходован один заряд способности.</p>
          <div>
            <button type="button" disabled={submitting} onClick={() => void submit()}>
              {submitting ? 'АКТИВИРУЕМ…' : 'ПОДТВЕРДИТЬ ИСПОЛЬЗОВАНИЕ'}
            </button>
            <button type="button" disabled={submitting} onClick={() => setConfirming(false)}>
              ОТМЕНА
            </button>
          </div>
        </div>
      )}
      {action.applicable && remaining === 0 && !result && (
        <p className="bunker-player-ability-action__spent">Заряд уже использован в этой игре.</p>
      )}
    </section>
  );
}

export function BunkerPlayerDashboard({
  runtime,
  connectionError = '',
  questState = null,
  missionFeedback = '',
  missionSubmitting = false,
  onMission = () => undefined,
  onFinalCode = () => undefined,
  onGlobalMission = () => undefined,
  onAbility,
}: BunkerPlayerDashboardProps) {
  const [section, setSection] = useState<Section>('МОЙ ВАГОН');
  const [largeText, setLargeText] = useState(readLargeTextPreference);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const compactNavigation = useCompactNavigation();
  const inventory = rows(runtime.inventory);
  const passengers = rows(runtime.passengers);
  const archive = archiveEntries(runtime.archive);
  const mission = currentMission(runtime.currentMission);
  const missionContent = getBunkerMissionContent(mission?.id ?? runtime.game.state);
  const availableItems = availableInventoryKeys(inventory);
  const isGlobalMission = isBunkerGlobalMissionState(runtime.game.state);
  const gameStateLabel = missionContent?.title.toLocaleUpperCase('ru-RU')
    ?? (runtime.game.bunkerRevealed ? 'БУНКЕР ОТКРЫТ' : 'ПРОТОКОЛ АКТИВЕН');

  const chooseSection = (nextSection: Section) => {
    setSection(nextSection);
    if (OVERFLOW_SECTIONS.includes(nextSection)) setOverflowOpen(true);
  };

  const toggleLargeText = () => {
    setLargeText((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(LARGE_TEXT_STORAGE_KEY, String(next));
      } catch {
        // A privacy-restricted browser may refuse storage; the current visit still remains readable.
      }
      return next;
    });
  };

  return (
    <section
      className="bunker-player-dashboard"
      aria-label="Игровой модуль Бункер"
      data-large-text={largeText ? 'true' : undefined}
    >
      <header className="bunker-player-dashboard__header">
        <div>
          <p className="bunker-player-dashboard__index">ПОСЛЕДНИЙ ВАГОН · {runtime.wagon.label}</p>
          <h2 className="bunker-player-dashboard__guest-name">
            {runtime.guest.realName.toLocaleUpperCase('ru-RU')}
          </h2>
        </div>
        <div className="bunker-player-dashboard__status-controls">
          <span className="bunker-player-dashboard__state">{gameStateLabel}</span>
          <button
            className="bunker-player-dashboard__large-text-toggle"
            type="button"
            aria-pressed={largeText}
            onClick={toggleLargeText}
          >
            КРУПНЫЙ ТЕКСТ
          </button>
        </div>
      </header>

      <BunkerResponsivePicture
        asset="tunnel-relief-wide"
        mobileAsset="tunnel-relief-mobile"
        className="bunker-player-dashboard__relief"
        testId="bunker-tunnel-relief"
        sizes="(max-width: 640px) calc(100vw - 1.3rem), min(72rem, calc(100vw - 5rem))"
        loading="eager"
      />

      {connectionError && (
        <p className="bunker-player-dashboard__connection" role="alert">{connectionError}</p>
      )}

      {runtime.guest.joinedLate && (
        <p className="bunker-player-dashboard__late" role="status">
          Вы присоединились к составу после отправления. Некоторые решения уже были приняты вашим вагоном.
        </p>
      )}

      {runtime.character.status === 'excluded' && (
        <p className="bunker-player-dashboard__continuity" role="status">
          Персонаж исключён из истории, но вы продолжаете участвовать: обсуждайте решения вагона и выполняйте текущие задания.
        </p>
      )}

      {runtime.character.status === 'saved' && (
        <p className="bunker-player-dashboard__continuity" role="status">
          Персонаж спасён по итогам истории, но вы продолжаете участвовать: обсуждайте решения вагона и выполняйте текущие задания.
        </p>
      )}

      {(missionContent || questState?.status === 'active') && (
        <button
          className="bunker-player-dashboard__primary-action"
          type="button"
          onClick={() => chooseSection('ТЕКУЩЕЕ ЗАДАНИЕ')}
        >
          ОТКРЫТЬ ТЕКУЩЕЕ ЗАДАНИЕ
        </button>
      )}

      <nav className="bunker-player-dashboard__nav" aria-label="Разделы игры">
        {PRIMARY_SECTIONS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={section === item}
            onClick={() => chooseSection(item)}
          >
            {item}
          </button>
        ))}
        <div className="bunker-player-dashboard__nav-overflow" role="group" aria-label="Дополнительные разделы">
          <button
            className="bunker-player-dashboard__nav-overflow-toggle"
            type="button"
            aria-expanded={compactNavigation ? overflowOpen : true}
            onClick={() => setOverflowOpen((current) => !current)}
          >
            ЕЩЁ
          </button>
          <div
            className="bunker-player-dashboard__nav-overflow-content"
            hidden={compactNavigation && !overflowOpen}
          >
            {OVERFLOW_SECTIONS.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={section === item}
                onClick={() => chooseSection(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div className="bunker-player-dashboard__content">
        {section === 'МОЙ ВАГОН' && (
          <article>
            <p className="bunker-player-dashboard__index">СОСТАВ</p>
            <h3>{runtime.wagon.label.toLocaleUpperCase('ru-RU')}</h3>
            <p>{passengers.length} пассажиров · решения команды синхронизируются автоматически.</p>
          </article>
        )}

        {section === 'ПЕРСОНАЖ' && (
          <article className="bunker-player-character">
            <p className="bunker-player-dashboard__index">ВАША РОЛЬ</p>
            <h3>{runtime.character.profession}</h3>
            <dl>
              <div><dt>Здоровье</dt><dd>{runtime.character.health}</dd></div>
              <div><dt>Навык</dt><dd>{runtime.character.visibleSkill}</dd></div>
              <div><dt>Скрытая характеристика</dt><dd>{runtime.character.hiddenTrait ?? 'ДАННЫЕ НЕДОСТУПНЫ'}</dd></div>
            </dl>
            <div className="bunker-player-character__ability">
              <span>ОПЕРАЦИОННЫЙ ЭФФЕКТ СПОСОБНОСТИ</span>
              {runtime.character.abilityAction ? (
                <>
                  <strong>{runtime.character.abilityAction.effectLabel}</strong>
                  <p>{runtime.character.abilityAction.effectDescription}</p>
                  <small>Осталось использований: {runtime.character.abilityUsesRemaining}</small>
                </>
              ) : (
                <p>Система ещё не получила серверное описание способности.</p>
              )}
            </div>
          </article>
        )}

        {section === 'ПАССАЖИРЫ' && (
          <div className="bunker-player-list">
            {passengers.map((passenger) => (
              <article key={String(passenger.guestId)}>
                <h3>{String(passenger.realName)}</h3>
                <strong>{String(passenger.profession)}</strong>
                <p>{String(passenger.visibleSkill)}</p>
                <small>{passenger.hiddenTraitRevealed ? String(passenger.hiddenTrait) : 'СКРЫТАЯ ХАРАКТЕРИСТИКА · ???'}</small>
              </article>
            ))}
          </div>
        )}

        {section === 'ИНВЕНТАРЬ' && (
          <BunkerInventoryCards inventory={inventory} missionContent={missionContent} />
        )}

        {section === 'АРХИВ' && (
          <article aria-label="Архив вагона">
            <h3>АРХИВ ВАГОНА</h3>
            {archive.length === 0 ? (
              <p>Архив вагона пока пуст. Полученные материалы появятся здесь после синхронизации.</p>
            ) : (
              <div className="bunker-player-list">
                {archive.map((entry) => {
                  const artwork = archiveArtwork(entry);
                  return (
                    <article key={`${entry.scope}:${entry.artifactKey}`}>
                      {artwork && (
                        <BunkerResponsivePicture
                          asset={artwork}
                          className="bunker-player-archive__artwork"
                          testId="bunker-archive-artwork"
                          sizes="(max-width: 760px) calc(100vw - 3.3rem), 24rem"
                        />
                      )}
                      <h3>{entry.artifactKey.toLocaleUpperCase('ru-RU')}</h3>
                      <strong>{entry.contentType.toLocaleUpperCase('ru-RU')}</strong>
                      <p>{entry.decryptionStatus.toLocaleUpperCase('ru-RU')}</p>
                      <small>{entry.scope.toLocaleUpperCase('ru-RU')}</small>
                    </article>
                  );
                })}
              </div>
            )}
          </article>
        )}

        {section === 'СОСТОЯНИЕ' && (
          <article><h3>СОСТОЯНИЕ ВАГОНА</h3><p>ПИТАНИЕ · {String(runtime.wagonState.powerStatus).toLocaleUpperCase('ru-RU')}</p><p>СВЯЗЬ · {String(runtime.wagonState.communicationStatus).toLocaleUpperCase('ru-RU')}</p><p>НАВИГАЦИЯ · {String(runtime.wagonState.navigationStatus).toLocaleUpperCase('ru-RU')}</p></article>
        )}

        {section === 'ТЕКУЩЕЕ ЗАДАНИЕ' && (
          <article aria-label="Текущее задание">
            {missionContent ? (
              <BunkerMissionBriefing
                content={missionContent}
                availableItemKeys={availableItems}
                missionAction={runtime.missionAction}
                missionPlan={runtime.currentMission?.plan}
                wagonId={runtime.wagon.id}
                showConsequences={!isGlobalMission || runtime.missionAction?.completed === true}
              />
            ) : (
              <>
                <h3>ТЕКУЩЕЕ ЗАДАНИЕ</h3>
                <p>Для текущего этапа активное задание не назначено.</p>
              </>
            )}
            <BunkerAbilityActionCard runtime={runtime} onAbility={onAbility} />
            <BunkerMissionActions
              state={questState}
              globalMissionState={runtime.game.state}
              globalAction={runtime.missionAction}
              inventory={inventory}
              submitting={missionSubmitting}
              feedback={missionFeedback}
              onGlobalMission={onGlobalMission}
              onMission={onMission}
              onFinalCode={onFinalCode}
            />
          </article>
        )}
      </div>
    </section>
  );
}
