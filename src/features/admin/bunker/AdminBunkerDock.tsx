import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseClient } from '../../../lib/supabase';
import {
  applyCarriageDistribution,
  loadOwnerDashboard,
  type AdminDashboard,
  type AdminRpcClient,
} from '../admin.service';
import type { SupportedCarriageCount } from '../../carriages/carriageAllocator';
import {
  AdminBunkerControl,
  type AdminBunkerControlDependencies,
} from './AdminBunkerControl';
import {
  AdminBunkerTestDock,
  type AdminBunkerTestDockDependencies,
} from './AdminBunkerTestDock';
import type { MissionOneOwnerReadModel as MissionOneOwnerPanelReadModel } from './MissionOneOwnerPanel';
import {
  MissionTwoOwnerPanel,
  type MissionTwoOwnerPanelModel,
} from './MissionTwoOwnerPanel';
import { MissionThreeOwnerPanel } from './MissionThreeOwnerPanel';
import { MissionFourOwnerPanel } from './MissionFourOwnerPanel';
import { MissionFiveOwnerPanel } from './MissionFiveOwnerPanel';
import { MissionSixOwnerPanel } from './MissionSixOwnerPanel';
import { UnknownPassengerOwnerPanel } from './UnknownPassengerOwnerPanel';
import { FinalOwnerPanel } from './FinalOwnerPanel';
import { MissionHostScript } from './MissionHostScript';
import { bunkerMissionContent } from '../../bunker/v2/missionContent';
import { resolveBunkerContractVersion } from './bunkerContractVersion';

import {
  getOwnerMissionOneReadModel,
  overrideMissionOneSelection,
  type MissionOneOwnerReadModel,
  type MissionOneRpcClient,
  type OverrideMissionOneSelectionInput,
} from '../../bunker/v2/m01.service';
import {
  getOwnerMissionTwoReadModel,
  type MissionTwoOwnerReadModel,
} from '../../bunker/v2/m02.service';
import {
  getOwnerMissionThreeReadModel,
  type MissionThreeOwnerReadModel,
} from '../../bunker/v2/m03.service';
import {
  getOwnerMissionFourReadModel,
  type MissionFourOwnerReadModel,
} from '../../bunker/v2/m04.service';
import {
  getOwnerMissionFiveReadModel,
  type MissionFiveOwnerReadModel,
} from '../../bunker/v2/m05.service';
import {
  getOwnerMissionSixReadModel,
  type MissionSixOwnerReadModel,
} from '../../bunker/v2/m06.service';
import {
  getOwnerUnknownPassengerReadModel,
  type UnknownPassengerOwnerReadModel,
} from '../../bunker/v2/unknownPassenger.service';
import {
  addFinalTime,
  emergencyOpenFinal,
  getOwnerFinalReadModel,
  giveFinalHint,
  type FinalOwnerReadModel,
} from '../../bunker/v2/final.service';
import type { MissionThreeScreenModel } from '../../bunker/v2/MissionThreeScreen';
import type { MissionFourScreenModel } from '../../bunker/v2/MissionFourScreen';
import type { MissionFiveScreenModel } from '../../bunker/v2/MissionFiveScreen';
import type { MissionSixScreenModel } from '../../bunker/v2/MissionSixScreen';
import type { UnknownPassengerScreenModel } from '../../bunker/v2/UnknownPassengerScreen';
import type { FinalScreenModel } from '../../bunker/v2/FinalScreen';
import {
  broadcastBunkerRefresh,
  subscribeToBunkerRefresh,
  type BunkerRealtimeClient,
} from '../../bunker/bunker.realtime';
import { isOwnerSessionExpired } from '../ownerSession';

const EVENT_SLUG = 'liza-viktor';

type Availability = 'loading' | 'current' | 'stale' | 'unavailable';

export type AdminBunkerDockDependencies = {
  loadDashboard: () => Promise<AdminDashboard>;
  applyDistribution: (eventId: string, count: SupportedCarriageCount) => Promise<unknown>;
  bunkerControl?: AdminBunkerControlDependencies;
  testMode?: AdminBunkerTestDockDependencies;
  loadMissionOne?: (eventId: string) => Promise<MissionOneOwnerReadModel>;
  overrideMissionOne?: (input: OverrideMissionOneSelectionInput) => Promise<unknown>;
  loadMissionTwo?: (eventId: string) => Promise<MissionTwoOwnerReadModel>;
  loadMissionThree?: (eventId: string) => Promise<MissionThreeOwnerReadModel>;
  loadMissionFour?: (eventId: string) => Promise<MissionFourOwnerReadModel>;
  loadMissionFive?: (eventId: string) => Promise<MissionFiveOwnerReadModel>;
  loadMissionSix?: (eventId: string) => Promise<MissionSixOwnerReadModel>;
  loadUnknownPassenger?: (eventId: string) => Promise<UnknownPassengerOwnerReadModel>;
  loadFinal?: (eventId: string) => Promise<FinalOwnerReadModel>;
  addFinalTime?: (eventId: string) => Promise<unknown>;
  giveFinalHint?: (eventId: string) => Promise<unknown>;
  emergencyOpenFinal?: (eventId: string) => Promise<unknown>;
  broadcastRefresh?: () => Promise<void>;
  subscribeRefresh?: (callback: () => void) => () => void;
};

type Props = {
  dependencies?: AdminBunkerDockDependencies;
  pollIntervalMs?: number;
};

function remainingSeconds(deadlineAt: string, serverNow: string): number {
  return Math.max(0, Math.ceil((Date.parse(deadlineAt) - Date.parse(serverNow)) / 1000));
}

function missionOnePanel(
  model: MissionOneOwnerReadModel | null,
): MissionOneOwnerPanelReadModel | undefined {
  if (!model || model.contractVersion !== 2 || model.status !== 'active') return undefined;
  return {
    status: model.wagons.every((wagon) => wagon.status === 'completed') ? 'completed' : 'active',
    remainingSeconds: remainingSeconds(model.deadlineAt, model.serverNow),
    wagons: model.wagons,
  };
}

function missionTwoPanel(
  model: MissionTwoOwnerReadModel | null,
): MissionTwoOwnerPanelModel | undefined {
  if (!model || model.contractVersion !== 2 || model.status !== 'active') return undefined;
  return {
    status: 'active',
    title: model.title,
    remainingSeconds: remainingSeconds(model.deadlineAt, model.serverNow),
    wagons: model.wagons,
  };
}

function missionThreePanel(
  model: MissionThreeOwnerReadModel | null,
): MissionThreeScreenModel | undefined {
  if (!model || model.contractVersion !== 2 || model.status !== 'active') return undefined;
  return {
    title: model.title,
    remainingSeconds: remainingSeconds(model.deadlineAt, model.serverNow),
    wagons: model.wagons,
  };
}

function missionFourPanel(
  model: MissionFourOwnerReadModel | null,
): MissionFourScreenModel | undefined {
  if (!model || model.contractVersion !== 2 || model.status !== 'active') return undefined;
  return {
    title: model.title,
    remainingSeconds: remainingSeconds(model.deadlineAt, model.serverNow),
    groups: model.groups,
  };
}

function missionFivePanel(
  model: MissionFiveOwnerReadModel | null,
): MissionFiveScreenModel | undefined {
  if (!model || model.contractVersion !== 2 || model.status !== 'active') return undefined;
  return {
    title: model.title,
    remainingSeconds: remainingSeconds(model.deadlineAt, model.serverNow),
    wagons: model.wagons,
  };
}

function missionSixPanel(
  model: MissionSixOwnerReadModel | null,
): MissionSixScreenModel | undefined {
  if (!model || model.contractVersion !== 2 || model.status !== 'active') return undefined;
  return {
    title: model.title,
    remainingSeconds: remainingSeconds(model.deadlineAt, model.serverNow),
    fragmentsRevealed: model.fragmentsRevealed,
    fragmentsTotal: model.fragmentsTotal,
    wagons: model.wagons,
  };
}

function unknownPassengerPanel(
  model: UnknownPassengerOwnerReadModel | null,
): UnknownPassengerScreenModel | undefined {
  if (!model || model.contractVersion !== 2 || model.status !== 'active') return undefined;
  return {
    title: model.title,
    dossierId: model.dossierId,
    sector: model.sector,
    remainingSeconds: remainingSeconds(model.deadlineAt, model.serverNow),
  };
}

function finalPanel(model: FinalOwnerReadModel | null): FinalScreenModel | undefined {
  if (
    !model
    || model.contractVersion !== 2
    || (model.status !== 'active' && model.status !== 'completed')
  ) return undefined;
  return {
    remainingSeconds: remainingSeconds(model.deadlineAt, model.serverNow),
    solved: model.solved,
    total: model.total,
    wrongAttempts: model.wrongAttempts,
    unlocked: model.unlocked,
    hintLevel: model.hintLevel,
    timeAdjustmentSeconds: model.timeAdjustmentSeconds,
  };
}

function commandId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `owner-${Date.now()}`;
}

function browserDependencies(): AdminBunkerDockDependencies | null {
  try {
    const client = getSupabaseClient() as unknown as AdminRpcClient
      & MissionOneRpcClient
      & BunkerRealtimeClient;
    return {
      loadDashboard: () => loadOwnerDashboard(client, EVENT_SLUG),
      applyDistribution: (eventId, count) => applyCarriageDistribution(client, eventId, count),
      loadMissionOne: (eventId) => getOwnerMissionOneReadModel(client, eventId),
      overrideMissionOne: (input) => overrideMissionOneSelection(client, input),
      loadMissionTwo: (eventId) => getOwnerMissionTwoReadModel(client, eventId),
      loadMissionThree: (eventId) => getOwnerMissionThreeReadModel(client, eventId),
      loadMissionFour: (eventId) => getOwnerMissionFourReadModel(client, eventId),
      loadMissionFive: (eventId) => getOwnerMissionFiveReadModel(client, eventId),
      loadMissionSix: (eventId) => getOwnerMissionSixReadModel(client, eventId),
      loadUnknownPassenger: (eventId) => getOwnerUnknownPassengerReadModel(client, eventId),
      loadFinal: (eventId) => getOwnerFinalReadModel(client, eventId),
      addFinalTime: (eventId) => addFinalTime(client, eventId, 120),
      giveFinalHint: (eventId) => giveFinalHint(client, eventId),
      emergencyOpenFinal: (eventId) => emergencyOpenFinal(client, eventId),
      broadcastRefresh: () => broadcastBunkerRefresh(client, EVENT_SLUG),
      subscribeRefresh: (callback) => subscribeToBunkerRefresh(client, EVENT_SLUG, callback),
    };
  } catch {
    return null;
  }
}

export function AdminBunkerDock({
  dependencies,
  pollIntervalMs = 15_000,
}: Props = {}) {
  const deps = useMemo(() => dependencies ?? browserDependencies(), [dependencies]);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [missionOne, setMissionOne] = useState<MissionOneOwnerReadModel | null>(null);
  const [missionTwo, setMissionTwo] = useState<MissionTwoOwnerReadModel | null>(null);
  const [missionThree, setMissionThree] = useState<MissionThreeOwnerReadModel | null>(null);
  const [missionFour, setMissionFour] = useState<MissionFourOwnerReadModel | null>(null);
  const [missionFive, setMissionFive] = useState<MissionFiveOwnerReadModel | null>(null);
  const [missionSix, setMissionSix] = useState<MissionSixOwnerReadModel | null>(null);
  const [story, setStory] = useState<UnknownPassengerOwnerReadModel | null>(null);
  const [final, setFinal] = useState<FinalOwnerReadModel | null>(null);
  const [lastSuccessAt, setLastSuccessAt] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability>(deps ? 'loading' : 'unavailable');
  const [controlRevision, setControlRevision] = useState(0);

  const dashboardRef = useRef<AdminDashboard | null>(null);
  const mountedRef = useRef(false);
  const activePollRequestRef = useRef<number | null>(null);
  const commandInFlightRef = useRef(false);
  const latestRequestRef = useRef(0);

  const storeDashboard = useCallback((next: AdminDashboard) => {
    dashboardRef.current = next;
    setDashboard(next);
    setLastSuccessAt(new Date().toISOString());
    setAvailability('current');
  }, []);

  const clearProjections = useCallback(() => {
    setMissionOne(null);
    setMissionTwo(null);
    setMissionThree(null);
    setMissionFour(null);
    setMissionFive(null);
    setMissionSix(null);
    setStory(null);
    setFinal(null);
  }, []);

  const failClosed = useCallback(() => {
    dashboardRef.current = null;
    setDashboard(null);
    setLastSuccessAt(null);
    setAvailability('unavailable');
    clearProjections();
  }, [clearProjections]);

  const handleDashboardFailure = useCallback((error: unknown) => {
    if (isOwnerSessionExpired(error) || !dashboardRef.current) {
      failClosed();
      return;
    }
    setAvailability('stale');
  }, [failClosed]);

  const readProjections = useCallback((next: AdminDashboard, requestId?: number) => {
    const stillCurrent = () => mountedRef.current
      && (requestId === undefined || requestId === latestRequestRef.current);

    const load = <T,>(
      loader: ((eventId: string) => Promise<T>) | undefined,
      setter: (value: T) => void,
    ) => {
      if (!loader) return;
      void loader(next.event.id)
        .then((value) => {
          if (stillCurrent()) setter(value);
        })
        .catch(() => {
          // Mission projections are progressive enhancements. Keep the last valid
          // snapshot and authenticated dashboard; the next poll/realtime hint converges.
        });
    };

    load(deps?.loadMissionOne, setMissionOne);
    load(deps?.loadMissionTwo, setMissionTwo);
    load(deps?.loadMissionThree, setMissionThree);
    load(deps?.loadMissionFour, setMissionFour);
    load(deps?.loadMissionFive, setMissionFive);
    load(deps?.loadMissionSix, setMissionSix);
    load(deps?.loadUnknownPassenger, setStory);
    load(deps?.loadFinal, setFinal);
  }, [deps]);

  const pollDashboard = useCallback(async () => {
    if (!deps || commandInFlightRef.current) return;
    const activeRequestId = activePollRequestRef.current;
    if (activeRequestId !== null && activeRequestId === latestRequestRef.current) return;

    const requestId = ++latestRequestRef.current;
    activePollRequestRef.current = requestId;
    try {
      const next = await deps.loadDashboard();
      if (mountedRef.current && requestId === latestRequestRef.current) storeDashboard(next);
      readProjections(next, requestId);
    } catch (error) {
      if (mountedRef.current && requestId === latestRequestRef.current) {
        handleDashboardFailure(error);
      }
    } finally {
      if (activePollRequestRef.current === requestId) activePollRequestRef.current = null;
    }
  }, [deps, handleDashboardFailure, readProjections, storeDashboard]);

  const refreshProjections = useCallback(() => {
    if (dashboardRef.current) readProjections(dashboardRef.current);
    else void pollDashboard();
  }, [pollDashboard, readProjections]);

  useEffect(() => {
    if (!deps) return undefined;
    mountedRef.current = true;
    void pollDashboard();
    const interval = window.setInterval(() => void pollDashboard(), pollIntervalMs);
    const recover = () => void pollDashboard();
    const unsubscribeRefresh = deps.subscribeRefresh?.(refreshProjections);
    window.addEventListener('focus', recover);
    window.addEventListener('online', recover);

    return () => {
      mountedRef.current = false;
      latestRequestRef.current += 1;
      activePollRequestRef.current = null;
      window.clearInterval(interval);
      window.removeEventListener('focus', recover);
      window.removeEventListener('online', recover);
      unsubscribeRefresh?.();
    };
  }, [deps, pollDashboard, pollIntervalMs, refreshProjections]);

  const acceptDistribution = async (count: SupportedCarriageCount) => {
    if (!deps || commandInFlightRef.current || !dashboardRef.current) return;
    commandInFlightRef.current = true;
    try {
      await deps.applyDistribution(dashboardRef.current.event.id, count);
      const requestId = ++latestRequestRef.current;
      const fresh = await deps.loadDashboard();
      if (mountedRef.current && requestId === latestRequestRef.current) storeDashboard(fresh);
      readProjections(fresh, requestId);
    } finally {
      commandInFlightRef.current = false;
    }
  };

  const applyMissionOneOverride = async (input: {
    wagonId: string;
    selectedGuestIds: string[];
    reason: string;
  }) => {
    if (!deps?.overrideMissionOne || !dashboardRef.current) return;
    const wagon = missionOne?.contractVersion === 2 && missionOne.status === 'active'
      ? missionOne.wagons.find((candidate) => candidate.wagonId === input.wagonId)
      : undefined;
    if (!wagon) throw new Error('M01 wagon snapshot unavailable');

    await deps.overrideMissionOne({
      eventId: dashboardRef.current.event.id,
      instanceId: wagon.instanceId,
      instanceVersion: wagon.instanceVersion,
      commandId: commandId(),
      selectedGuestIds: input.selectedGuestIds,
      reason: input.reason,
    });
    try {
      await deps.broadcastRefresh?.();
    } catch {
      // The authoritative owner reread below still reconciles the console.
    }
    refreshProjections();
  };

  const runFinalAction = async (action: ((eventId: string) => Promise<unknown>) | undefined) => {
    if (!action || !dashboardRef.current) throw new Error('Final owner action unavailable');
    if (commandInFlightRef.current) throw new Error('Another owner command is in progress');
    commandInFlightRef.current = true;
    try {
      await action(dashboardRef.current.event.id);
      try {
        await deps?.broadcastRefresh?.();
      } catch {
        // Direct authoritative reads below are sufficient for owner convergence.
      }
      refreshProjections();
      setControlRevision((value) => value + 1);
    } finally {
      commandInFlightRef.current = false;
    }
  };

  if (!deps || availability === 'unavailable') {
    return (
      <aside id="admin-bunker" className="admin-bunker-dock" aria-label="Экстренный сюжетный поворот">
        <div className="admin-bunker-dock__unavailable" role="status">
          <strong>OWNER-ДАННЫЕ НЕДОСТУПНЫ</strong>
          <span>ПУЛЬТ СКРЫТ · ПРОВЕРЬТЕ OWNER-СЕССИЮ И СВЯЗЬ</span>
        </div>
      </aside>
    );
  }

  if (!dashboard || availability === 'loading') {
    return (
      <aside id="admin-bunker" className="admin-bunker-dock" aria-label="Экстренный сюжетный поворот">
        <div className="admin-bunker-dock__freshness" role="status">
          <span>OWNER-ДОСТУП · ПРОВЕРЯЕМ</span>
        </div>
      </aside>
    );
  }

  const contractVersion = resolveBunkerContractVersion([
    missionOne,
    missionTwo,
    missionThree,
    missionFour,
    missionFive,
    missionSix,
    story,
    final,
  ]);
  const fullV2ContractReadersAvailable = Boolean(
    deps.loadMissionTwo
    || deps.loadMissionThree
    || deps.loadMissionFour
    || deps.loadMissionFive
    || deps.loadMissionSix
    || deps.loadUnknownPassenger
    || deps.loadFinal,
  );
  const contractReady = contractVersion !== undefined || !fullV2ContractReadersAvailable;
  const effectiveContractVersion = contractVersion ?? 1;

  const two = missionTwoPanel(missionTwo);
  const three = missionThreePanel(missionThree);
  const four = missionFourPanel(missionFour);
  const five = missionFivePanel(missionFive);
  const six = missionSixPanel(missionSix);
  const storyPanel = unknownPassengerPanel(story);
  const ownerFinalPanel = finalPanel(final);
  const one = missionOnePanel(missionOne);
  const hostScript = one ? bunkerMissionContent('M01') : undefined;


  return (
    <aside id="admin-bunker" className="admin-bunker-dock" aria-label="Экстренный сюжетный поворот">
      {lastSuccessAt && (
        <div className="admin-bunker-dock__freshness" role="status">
          <span>
            {availability === 'stale'
              ? 'OWNER-ДАННЫЕ СОХРАНЕНЫ · ПЕРЕПОДКЛЮЧЕНИЕ'
              : 'OWNER-ДАННЫЕ ПОДТВЕРЖДЕНЫ'}
          </span>
          <time dateTime={lastSuccessAt}>
            {new Intl.DateTimeFormat('ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }).format(new Date(lastSuccessAt))}
          </time>
        </div>
      )}

      {contractReady ? (
        <AdminBunkerControl
          key={controlRevision}
          eventId={dashboard.event.id}
          dependencies={deps.bunkerControl}
          dashboard={dashboard}
          onAcceptDistribution={acceptDistribution}
          bunkerContractVersion={effectiveContractVersion}
          missionOne={one}
          onMissionOneOverride={deps.overrideMissionOne ? applyMissionOneOverride : undefined}
        />
      ) : (
        <div className="admin-bunker-dock__freshness" role="status">
          <span>ВЕРСИЯ БУНКЕРА · ПРОВЕРЯЕМ СЕРВЕРНЫЙ КОНТРАКТ</span>
        </div>
      )}

      {hostScript && one && (
        <MissionHostScript
          content={hostScript}
          statusLine={one.status === 'completed'
            ? 'Все вагоны завершили задание'
            : 'Задание идёт сейчас'}
        />
      )}

      {two && <MissionTwoOwnerPanel model={two} />}

      {three && <MissionThreeOwnerPanel model={three} />}
      {four && <MissionFourOwnerPanel model={four} />}
      {five && <MissionFiveOwnerPanel model={five} />}
      {six && <MissionSixOwnerPanel model={six} />}
      {storyPanel && <UnknownPassengerOwnerPanel model={storyPanel} />}
      {ownerFinalPanel && (
        <FinalOwnerPanel
          model={ownerFinalPanel}
          onAddTime={deps.addFinalTime ? () => runFinalAction(deps.addFinalTime) : undefined}
          onHint={deps.giveFinalHint ? () => runFinalAction(deps.giveFinalHint) : undefined}
          onEmergencyOpen={deps.emergencyOpenFinal
            ? () => runFinalAction(deps.emergencyOpenFinal)
            : undefined}
        />
      )}

      {(!dependencies || dependencies.testMode) && (
        <AdminBunkerTestDock
          eventId={dashboard.event.id}
          dependencies={dependencies?.testMode}
        />
      )}
    </aside>
  );
}
