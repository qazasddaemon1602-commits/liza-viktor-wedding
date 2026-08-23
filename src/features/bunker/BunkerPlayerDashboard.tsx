import { useEffect, useRef, useState } from 'react';
import type {
  ActiveGuestBunkerRuntime,
  GuestBunkerAbilityResult,
} from './bunkerRuntime.service';
import { BunkerResponsivePicture, type BunkerAsset } from './BunkerResponsivePicture';
import type { BunkerV2ActiveGuestRuntime } from './v2/contracts';
import type { BunkerV2DashboardReadModel } from './v2/dashboard.service';
import {
  bunkerArchiveLabel,
  bunkerContentTypeLabel,
  bunkerItemLabel,
  bunkerStageLabel,
  bunkerStatusLabel,
} from './v2/labels';
import { MissionOnePlayer, type MissionOnePlayerReadModel } from './v2/MissionOnePlayer';
import { MissionTwoPlayer, type MissionTwoPlayerReadModel } from './v2/MissionTwoPlayer';
import { MissionThreePlayer, type MissionThreePlayerReadModel } from './v2/MissionThreePlayer';
import { MissionFourPlayer, type MissionFourPlayerReadModel } from './v2/MissionFourPlayer';
import { MissionFivePlayer, type MissionFivePlayerReadModel } from './v2/MissionFivePlayer';
import { MissionSixPlayer, type MissionSixPlayerReadModel } from './v2/MissionSixPlayer';
import { UnknownPassengerPlayer, type UnknownPassengerPlayerModel } from './v2/UnknownPassengerPlayer';
import { FinalPlayer, type FinalPlayerModel } from './v2/FinalPlayer';
import type { FinalValues } from './v2/final.service';
import { BunkerResultsLivePlayer } from './v2/BunkerResultsLivePlayer';
import { BunkerMissionBriefing } from './BunkerMissionBriefing';
import {
  availableInventoryKeys,
  BunkerInventoryCards,
  BunkerMissionActions,
} from './BunkerMissionActions';
import type { BunkerMissionStage, GuestBunkerQuestState } from './bunkerQuest.types';
import type {
  BunkerGlobalMissionPayload,
  BunkerGlobalMissionState,
} from './bunkerGlobalMission.service';
import { getBunkerMissionContent } from './v2/content/missionContent';
import { BunkerOperatorTransmission } from './operator/BunkerOperatorTransmission';
import {
  useBunkerOperatorFeed,
  type BunkerOperatorFeedDependencies,
} from './operator/useBunkerOperatorFeed';

const SECTIONS = [
  'МОЙ ВАГОН',
  'ПЕРСОНАЖ',
  'ПАССАЖИРЫ',
  'ИНВЕНТАРЬ',
  'АРХИВ',
  'СОСТОЯНИЕ',
  'ТЕКУЩЕЕ ЗАДАНИЕ',
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
type ActiveDashboard = Extract<BunkerV2DashboardReadModel, { status: 'active' }>;
type ArchiveEntry = {
  artifactKey: string;
  contentType: string;
  decryptionStatus: string;
  scope: string;
};
type LegacyCurrentMission = { id: string };

function rows(value: unknown[]): Record<string, unknown>[] {
  return value.filter((entry): entry is Record<string, unknown> => (
    typeof entry === 'object' && entry !== null && !Array.isArray(entry)
  ));
}

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

function legacyCurrentMission(value: unknown): LegacyCurrentMission | null {
  const entry = rows([value])[0];
  const id = entry ? nonEmptyText(entry.id) : null;
  return id ? { id } : null;
}

function artwork(entry: ArchiveEntry): BunkerAsset | null {
  const key = entry.artifactKey.toLowerCase();
  const type = entry.contentType.toLowerCase();
  if (key.includes('bk17') || key.includes('bk-17')) return 'archive-bk17';
  if (type === 'card') return 'archive-card';
  if (type === 'document') return 'archive-document';
  return null;
}

function signedMinutes(value: number): string {
  return `${value > 0 ? '+' : ''}${value} мин`;
}

type Props = {
  runtime: ActiveGuestBunkerRuntime | BunkerV2ActiveGuestRuntime;
  eventSlug?: string;
  operatorFeedDependencies?: BunkerOperatorFeedDependencies | null;
  dashboard?: ActiveDashboard;
  connectionError?: string;
  missionOne?: MissionOnePlayerReadModel;
  missionTwo?: MissionTwoPlayerReadModel;
  missionThree?: MissionThreePlayerReadModel;
  missionFour?: MissionFourPlayerReadModel;
  missionFive?: MissionFivePlayerReadModel;
  missionSix?: MissionSixPlayerReadModel;
  unknownPassenger?: UnknownPassengerPlayerModel;
  final?: FinalPlayerModel;
  onConfirmMissionOne?: (ids: string[]) => Promise<void> | void;
  onSubmitMissionTwo?: (answers: string[]) => Promise<void> | void;
  onUseMissionTwoAbility?: (ability: 'system_access' | 'terminal_hack') => Promise<void> | void;
  onConfirmMissionThree?: (problems: string[]) => Promise<void> | void;
  onUseMissionThreeAbility?: (problem: string) => Promise<void> | void;
  onSendMissionFourMessage?: (message: string) => Promise<void> | void;
  onProposeMissionFourTrade?: (input: {
    targetWagonNumber: number;
    itemKey: string;
    quantity: number;
  }) => Promise<void> | void;
  onRespondMissionFourTrade?: (id: string, response: 'accept' | 'reject') => Promise<void> | void;
  onSubmitMissionFourAnswer?: (answer: string) => Promise<void> | void;
  onCastMissionFiveVote?: (vote: 'A' | 'B') => Promise<void> | void;
  onUseMissionFiveAbility?: () => Promise<void> | void;
  onRevealMissionSixFragment?: () => Promise<void> | void;
  onCastMissionSixVote?: (vote: 'A' | 'B' | 'C') => Promise<void> | void;
  onUseMissionSixAbility?: () => Promise<void> | void;
  onRequestFinalAccess?: (values: FinalValues) => Promise<void> | void;
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
      <p className="bunker-player-ability-action__uses">ОСТАЛОСЬ ИСПОЛЬЗОВАНИЙ · {remaining}</p>
      {result && <p className="bunker-player-ability-action__result" role="status">{result.resultCopy}</p>}
      {error && <p className="bunker-player-ability-action__error" role="alert">{error}</p>}
      {usable && !result && !confirming && (
        <button type="button" onClick={() => setConfirming(true)}>ИСПОЛЬЗОВАТЬ СПОСОБНОСТЬ</button>
      )}
      {usable && !result && confirming && (
        <div className="bunker-player-ability-action__confirm" role="group" aria-label="Подтверждение способности">
          <p>Действие нельзя отменить: будет израсходован один заряд способности.</p>
          <div>
            <button type="button" disabled={submitting} onClick={() => void submit()}>
              {submitting ? 'АКТИВИРУЕМ…' : 'ПОДТВЕРДИТЬ ИСПОЛЬЗОВАНИЕ'}
            </button>
            <button type="button" disabled={submitting} onClick={() => setConfirming(false)}>ОТМЕНА</button>
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
  eventSlug = 'liza-viktor',
  operatorFeedDependencies,
  dashboard,
  connectionError = '',
  missionOne,
  missionTwo,
  missionThree,
  missionFour,
  missionFive,
  missionSix,
  unknownPassenger,
  final,
  onConfirmMissionOne,
  onSubmitMissionTwo,
  onUseMissionTwoAbility,
  onConfirmMissionThree,
  onUseMissionThreeAbility,
  onSendMissionFourMessage,
  onProposeMissionFourTrade,
  onRespondMissionFourTrade,
  onSubmitMissionFourAnswer,
  onCastMissionFiveVote,
  onUseMissionFiveAbility,
  onRevealMissionSixFragment,
  onCastMissionSixVote,
  onUseMissionSixAbility,
  onRequestFinalAccess,
  questState = null,
  missionFeedback = '',
  missionSubmitting = false,
  onMission = () => undefined,
  onFinalCode = () => undefined,
  onGlobalMission = () => undefined,
  onAbility,
}: Props) {
  const isV2 = 'contractVersion' in runtime;
  const guest = isV2
    ? { ...runtime.viewer.guest, joinedLate: runtime.character.m01Eligibility === 'late_joiner' }
    : runtime.guest;
  const activeId = missionOne?.instanceId
    ?? missionTwo?.instanceId
    ?? missionThree?.instanceId
    ?? missionFour?.instanceId
    ?? missionFive?.instanceId
    ?? missionSix?.instanceId
    ?? '';
  const wagon = isV2
    ? { id: dashboard?.wagon.id ?? activeId, ...(dashboard?.wagon ?? runtime.viewer.wagon) }
    : runtime.wagon;
  const gameState = isV2 ? runtime.state : runtime.game.state;
  const operatorSessionKey = isV2
    ? `${eventSlug}:${runtime.runNonce}`
    : `${eventSlug}:legacy`;
  const operatorFeed = useBunkerOperatorFeed({
    eventSlug,
    sessionKey: operatorSessionKey,
    enabled: isV2,
    dependencies: isV2
      ? operatorFeedDependencies ?? (import.meta.env.MODE === 'test' ? null : undefined)
      : null,
  });
  const fallbackV2Passengers = missionOne?.members.map((member) => ({
    ...member,
    hiddenTraitRevealed: false,
  })) ?? [];
  const hasV2Mission = Boolean(
    missionOne || missionTwo || missionThree || missionFour
    || missionFive || missionSix || unknownPassenger || final,
  );
  const mission = isV2 ? runtime.currentMission : legacyCurrentMission(runtime.currentMission);
  const missionContent = getBunkerMissionContent(
    (isV2
      ? runtime.currentMission?.code
      : mission && 'id' in mission
        ? mission.id
        : undefined) ?? gameState,
  );
  const hasMission = hasV2Mission || Boolean(missionContent || questState?.status === 'active');
  const [section, setSection] = useState<Section>(hasMission ? 'ТЕКУЩЕЕ ЗАДАНИЕ' : 'МОЙ ВАГОН');
  const [largeText, setLargeText] = useState(readLargeTextPreference);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [restoreOverflowFocus, setRestoreOverflowFocus] = useState(false);
  const overflowToggleRef = useRef<HTMLButtonElement>(null);
  const compactNavigation = useCompactNavigation();
  const fallbackInventory = rows(
    isV2 ? (missionThree?.inventory ?? missionFour?.inventory ?? []) : runtime.inventory,
  );
  const passengers = rows(
    isV2 ? (dashboard?.passengers ?? fallbackV2Passengers) : runtime.passengers,
  );
  const archive = archiveEntries(isV2 ? (dashboard?.archive ?? []) : runtime.archive);
  const resultsStage = isV2 && (gameState === 'BUNKER_OPEN' || gameState === 'FINISHED');
  const hiddenTrait = 'hiddenTrait' in runtime.character && runtime.character.hiddenTraitRevealed
    ? runtime.character.hiddenTrait
    : null;
  const abilityAction = 'abilityAction' in runtime.character
    ? runtime.character.abilityAction
    : undefined;
  const inventory = isV2 && dashboard
    ? dashboard.inventory
    : fallbackInventory;
  const availableItems = availableInventoryKeys(inventory);
  const gameStateLabel = missionContent?.title.toLocaleUpperCase('ru-RU')
    ?? bunkerStageLabel(gameState).toLocaleUpperCase('ru-RU');
  const overflowSectionActive = OVERFLOW_SECTIONS.includes(section);

  useEffect(() => {
    if (!restoreOverflowFocus) return;
    overflowToggleRef.current?.focus();
    setRestoreOverflowFocus(false);
  }, [restoreOverflowFocus]);

  const chooseSection = (nextSection: Section) => {
    setSection(nextSection);
    setOverflowOpen(false);
    setRestoreOverflowFocus(OVERFLOW_SECTIONS.includes(nextSection));
  };

  const toggleLargeText = () => {
    setLargeText((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(LARGE_TEXT_STORAGE_KEY, String(next));
      } catch {
        // The current visit still keeps the preference when storage is unavailable.
      }
      return next;
    });
  };

  if (resultsStage) {
    return (
      <section
        className="bunker-player-dashboard bunker-player-dashboard--results"
        aria-label="Игровой модуль Бункер"
        data-large-text={largeText ? 'true' : undefined}
      >
        <BunkerResultsLivePlayer />
      </section>
    );
  }

  return (
    <section
      className={`bunker-player-dashboard${hasMission ? ' bunker-player-dashboard--active-mission' : ''}`}
      aria-label="Игровой модуль Бункер"
      data-large-text={largeText ? 'true' : undefined}
    >
      {isV2 && (
        <BunkerOperatorTransmission
          sessionKey={operatorSessionKey}
          variant="phone"
          message={operatorFeed.feed?.message ?? null}
        />
      )}
      {missionOne && <MissionOnePlayer model={missionOne} onConfirm={onConfirmMissionOne} />}
      {missionTwo && (
        <MissionTwoPlayer
          model={missionTwo}
          onSubmit={onSubmitMissionTwo}
          onUseAbility={onUseMissionTwoAbility}
        />
      )}
      {missionThree && (
        <MissionThreePlayer
          model={missionThree}
          onConfirm={onConfirmMissionThree}
          onUseAbility={onUseMissionThreeAbility}
        />
      )}
      {missionFour && (
        <MissionFourPlayer
          model={missionFour}
          onSend={onSendMissionFourMessage}
          onProposeTrade={onProposeMissionFourTrade}
          onRespondTrade={onRespondMissionFourTrade}
          onAnswer={onSubmitMissionFourAnswer}
        />
      )}
      {missionFive && (
        <MissionFivePlayer
          model={missionFive}
          onVote={onCastMissionFiveVote}
          onUseAbility={onUseMissionFiveAbility}
        />
      )}
      {missionSix && (
        <MissionSixPlayer
          model={missionSix}
          onReveal={onRevealMissionSixFragment}
          onVote={onCastMissionSixVote}
          onUseAbility={onUseMissionSixAbility}
        />
      )}
      {unknownPassenger && <UnknownPassengerPlayer model={unknownPassenger} />}
      {final && <FinalPlayer model={final} onRequestAccess={onRequestFinalAccess} />}

      <header className="bunker-player-dashboard__header">
        <div>
          <p className="bunker-player-dashboard__index">ПОСЛЕДНИЙ ВАГОН · {wagon.label}</p>
          <h2 className="bunker-player-dashboard__guest-name">
            {guest.realName.toLocaleUpperCase('ru-RU')}
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

      {!hasMission && (
        <BunkerResponsivePicture
          asset="tunnel-relief-wide"
          mobileAsset="tunnel-relief-mobile"
          className="bunker-player-dashboard__relief"
          testId="bunker-tunnel-relief"
          loading="eager"
        />
      )}

      {connectionError && (
        <p className="bunker-player-dashboard__connection" role="alert">{connectionError}</p>
      )}
      {guest.joinedLate && (
        <p className="bunker-player-dashboard__late" role="status">
          Вы присоединились после отправления. Некоторые решения уже приняты вагоном — это нормально, вы продолжаете играть.
        </p>
      )}
      {runtime.character.status === 'excluded' && (
        <p className="bunker-player-dashboard__continuity" role="status">
          Персонаж исключён из истории, но вы продолжаете участвовать: обсуждайте решения и выполняйте задания вместе с вагоном.
        </p>
      )}
      {runtime.character.status === 'saved' && (
        <p className="bunker-player-dashboard__continuity" role="status">
          Персонаж спасён. Вы продолжаете участвовать во всех следующих заданиях вместе со своим вагоном.
        </p>
      )}

      {(missionContent || questState?.status === 'active') && !hasV2Mission && (
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
            ref={overflowToggleRef}
            className="bunker-player-dashboard__nav-overflow-toggle"
            type="button"
            aria-expanded={compactNavigation ? overflowOpen : true}
            aria-pressed={overflowSectionActive}
            onClick={() => setOverflowOpen((current) => !current)}
          >
            {overflowSectionActive ? `ЕЩЁ · ${section}` : 'ЕЩЁ'}
          </button>
          <div
            className="bunker-player-dashboard__nav-overflow-menu"
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
            <h3>{wagon.label.toLocaleUpperCase('ru-RU')}</h3>
            <p>{passengers.length} пассажиров · решения синхронизируются автоматически.</p>
          </article>
        )}

        {section === 'ПЕРСОНАЖ' && (
          <article className="bunker-player-character">
            <h3>{runtime.character.profession}</h3>
            <dl>
              <div><dt>Здоровье</dt><dd>{runtime.character.health}</dd></div>
              <div><dt>Навык</dt><dd>{runtime.character.visibleSkill}</dd></div>
              <div><dt>Скрытая характеристика</dt><dd>{hiddenTrait ?? 'ДАННЫЕ НЕДОСТУПНЫ'}</dd></div>
            </dl>
            <div className="bunker-player-character__ability">
              <span>ОСОБАЯ СПОСОБНОСТЬ</span>
              {abilityAction ? (
                <>
                  <strong>{abilityAction.effectLabel}</strong>
                  <p>{abilityAction.effectDescription}</p>
                </>
              ) : (
                <p>{runtime.character.abilityDescription}</p>
              )}
              <small>Осталось использований: {runtime.character.abilityUsesRemaining}</small>
            </div>
          </article>
        )}

        {section === 'ПАССАЖИРЫ' && (
          <div className="bunker-player-list">
            {passengers.length ? passengers.map((passenger) => (
              <article key={String(passenger.guestId)}>
                <h3>{String(passenger.realName)}</h3>
                {nonEmptyText(passenger.profession)
                  ? <strong>{String(passenger.profession)}</strong>
                  : null}
                {nonEmptyText(passenger.visibleSkill)
                  ? <p>{String(passenger.visibleSkill)}</p>
                  : null}
                {passenger.hiddenTraitRevealed && passenger.hiddenTrait
                  ? <small>{String(passenger.hiddenTrait)}</small>
                  : <small>Скрытая характеристика пока неизвестна</small>}
              </article>
            )) : (
              <article>
                <h3>СОСТАВ ВАГОНА</h3>
                <p>Список пассажиров появится после синхронизации.</p>
              </article>
            )}
          </div>
        )}

        {section === 'ИНВЕНТАРЬ' && (
          <BunkerInventoryCards inventory={inventory} missionContent={missionContent} />
        )}

        {section === 'АРХИВ' && (
          <article aria-label="Архив вагона">
            <h3>АРХИВ ВАГОНА</h3>
            {archive.length ? (
              <div className="bunker-player-list">
                {archive.map((entry) => {
                  const image = artwork(entry);
                  const label = bunkerArchiveLabel(entry.artifactKey);
                  return (
                    <article key={`${entry.scope}:${entry.artifactKey}`}>
                      {image && (
                        <BunkerResponsivePicture
                          asset={image}
                          className="bunker-player-archive__artwork"
                          testId="bunker-archive-artwork"
                        />
                      )}
                      <h3>{label.title}</h3>
                      <strong>{bunkerContentTypeLabel(entry.contentType)}</strong>
                      <p>{bunkerStatusLabel(entry.decryptionStatus)}</p>
                      <small>{bunkerStatusLabel(entry.scope)}</small>
                      <p>{label.hint}</p>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p>Архив вагона пока пуст. Найденные материалы появятся здесь автоматически.</p>
            )}
          </article>
        )}

        {section === 'СОСТОЯНИЕ' && (
          <article aria-label="Состояние вагона">
            <h3>СОСТОЯНИЕ ВАГОНА</h3>
            {isV2 && dashboard ? (
              <>
                <p>Питание · {bunkerStatusLabel(dashboard.wagonState.powerStatus)}</p>
                <p>Связь · {bunkerStatusLabel(dashboard.wagonState.communicationStatus)}</p>
                <p>Навигация · {bunkerStatusLabel(dashboard.wagonState.navigationStatus)}</p>
                <p>Техническая дверь · {bunkerStatusLabel(dashboard.wagonState.technicalDoorStatus)}</p>
                <p>Повреждение пути · {dashboard.wagonState.trackDamage}%</p>
                <p>Вода · {bunkerStatusLabel(dashboard.wagonState.waterStatus)}</p>
                <p>Маршрут · {dashboard.wagonState.routeChoice ?? 'не выбран'}</p>
                <p>Бонус маршрута · {signedMinutes(dashboard.wagonState.routeBonus)}</p>
                <p>Нестабильность питания · {dashboard.wagonState.powerInstability}</p>
                <p>Сектор 04 · {dashboard.wagonState.sector04Found ? 'найден' : 'не найден'}</p>
                <p>Координация · {dashboard.wagonState.coordinationBonus ? 'бонус активен' : 'обычный режим'}</p>
              </>
            ) : isV2 ? (
              <p>Состояние вагона синхронизируется…</p>
            ) : (
              <>
                <p>Питание · {bunkerStatusLabel(String(runtime.wagonState.powerStatus))}</p>
                <p>Связь · {bunkerStatusLabel(String(runtime.wagonState.communicationStatus))}</p>
                <p>Навигация · {bunkerStatusLabel(String(runtime.wagonState.navigationStatus))}</p>
              </>
            )}
          </article>
        )}

        {section === 'ТЕКУЩЕЕ ЗАДАНИЕ' && (
          <article aria-label="Текущее задание">
            {hasV2Mission ? (
              <>
                <h3>ТЕКУЩЕЕ ЗАДАНИЕ</h3>
                <p>Интерактивное задание находится в верхней части экрана.</p>
              </>
            ) : missionContent ? (
              <BunkerMissionBriefing
                content={missionContent}
                availableItemKeys={availableItems}
                missionAction={!isV2 ? runtime.missionAction : null}
                missionPlan={!isV2 ? runtime.currentMission?.plan : null}
                wagonId={wagon.id}
                showConsequences={isV2 || runtime.missionAction?.completed === true}
              />
            ) : (
              <>
                <h3>ТЕКУЩЕЕ ЗАДАНИЕ</h3>
                <p>Для текущего этапа активное задание не назначено.</p>
              </>
            )}
            {!isV2 && <BunkerAbilityActionCard runtime={runtime} onAbility={onAbility} />}
            {!isV2 && (
              <BunkerMissionActions
                state={questState}
                globalMissionState={runtime.game.state}
                globalAction={runtime.missionAction}
                inventory={inventory}
                wagonState={runtime.wagonState}
                submitting={missionSubmitting}
                feedback={missionFeedback}
                onGlobalMission={onGlobalMission}
                onMission={onMission}
                onFinalCode={onFinalCode}
              />
            )}
          </article>
        )}
      </div>
    </section>
  );
}
