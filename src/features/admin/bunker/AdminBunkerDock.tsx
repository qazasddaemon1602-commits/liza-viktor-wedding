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
import type { MissionOneOwnerReadModel as MissionOneOwnerPanelReadModel } from './MissionOneOwnerPanel';
import {
  getOwnerMissionOneReadModel,
  overrideMissionOneSelection,
  type MissionOneOwnerReadModel,
  type MissionOneRpcClient,
  type OverrideMissionOneSelectionInput,
} from '../../bunker/v2/m01.service';
import {
  broadcastBunkerRefresh,
  type BunkerRealtimeClient,
} from '../../bunker/bunker.realtime';

const EVENT_SLUG = 'liza-viktor';

export type AdminBunkerDockDependencies = {
  loadDashboard: () => Promise<AdminDashboard>;
  applyDistribution: (eventId: string, carriageCount: SupportedCarriageCount) => Promise<unknown>;
  bunkerControl?: AdminBunkerControlDependencies;
  loadMissionOne?: (eventId: string) => Promise<MissionOneOwnerReadModel>;
  overrideMissionOne?: (input: OverrideMissionOneSelectionInput) => Promise<unknown>;
  broadcastRefresh?: () => Promise<void>;
};

type AdminBunkerDockProps = {
  dependencies?: AdminBunkerDockDependencies;
  pollIntervalMs?: number;
};

function browserDependencies(): AdminBunkerDockDependencies | null {
  try {
    const client = getSupabaseClient() as unknown as AdminRpcClient
      & MissionOneRpcClient
      & BunkerRealtimeClient;
    return {
      loadDashboard: () => loadOwnerDashboard(client, EVENT_SLUG),
      applyDistribution: (eventId, carriageCount) => applyCarriageDistribution(
        client,
        eventId,
        carriageCount,
      ),
      loadMissionOne: (eventId) => getOwnerMissionOneReadModel(client, eventId),
      overrideMissionOne: (input) => overrideMissionOneSelection(client, input),
      broadcastRefresh: () => broadcastBunkerRefresh(client, EVENT_SLUG),
    };
  } catch {
    return null;
  }
}

function remainingSeconds(deadlineAt: string, serverNow: string): number {
  return Math.max(0, Math.ceil((Date.parse(deadlineAt) - Date.parse(serverNow)) / 1000));
}

function ownerPanelModel(
  model: MissionOneOwnerReadModel | null,
): MissionOneOwnerPanelReadModel | undefined {
  if (!model || model.contractVersion !== 2 || model.status !== 'active') return undefined;
  return {
    status: model.wagons.every((wagon) => wagon.status === 'completed') ? 'completed' : 'active',
    remainingSeconds: remainingSeconds(model.deadlineAt, model.serverNow),
    wagons: model.wagons,
  };
}

function commandId(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `m01-owner-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function AdminBunkerDock({
  dependencies,
  pollIntervalMs = 15_000,
}: AdminBunkerDockProps = {}) {
  const deps = useMemo(() => dependencies ?? browserDependencies(), [dependencies]);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [missionOneRead, setMissionOneRead] = useState<MissionOneOwnerReadModel | null>(null);
  const [lastSuccessAt, setLastSuccessAt] = useState<string | null>(null);
  const [availability, setAvailability] = useState<'loading' | 'current' | 'unavailable'>(
    deps ? 'loading' : 'unavailable',
  );
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

  const failClosed = useCallback(() => {
    dashboardRef.current = null;
    setDashboard(null);
    setLastSuccessAt(null);
    setAvailability('unavailable');
    setMissionOneRead(null);
  }, []);

  const loadMissionOne = useCallback(async (next: AdminDashboard) => {
    if (!deps?.loadMissionOne) return null;
    return deps.loadMissionOne(next.event.id);
  }, [deps]);

  const pollDashboard = useCallback(async () => {
    if (!deps || commandInFlightRef.current) return;
    const activeRequestId = activePollRequestRef.current;
    if (activeRequestId !== null && activeRequestId === latestRequestRef.current) return;
    const requestId = ++latestRequestRef.current;
    activePollRequestRef.current = requestId;

    try {
      const next = await deps.loadDashboard();
      const nextMissionOne = await loadMissionOne(next);
      if (mountedRef.current && requestId === latestRequestRef.current) {
        storeDashboard(next);
        setMissionOneRead(nextMissionOne);
      }
    } catch {
      if (mountedRef.current && requestId === latestRequestRef.current) {
        failClosed();
      }
    } finally {
      if (activePollRequestRef.current === requestId) {
        activePollRequestRef.current = null;
      }
    }
  }, [deps, failClosed, loadMissionOne, storeDashboard]);

  useEffect(() => {
    if (!deps) return undefined;
    mountedRef.current = true;
    void pollDashboard();
    const interval = window.setInterval(() => void pollDashboard(), pollIntervalMs);
    const recover = () => void pollDashboard();
    window.addEventListener('focus', recover);
    window.addEventListener('online', recover);

    return () => {
      mountedRef.current = false;
      latestRequestRef.current += 1;
      activePollRequestRef.current = null;
      window.clearInterval(interval);
      window.removeEventListener('focus', recover);
      window.removeEventListener('online', recover);
    };
  }, [deps, pollDashboard, pollIntervalMs]);

  const acceptDistribution = async (carriageCount: SupportedCarriageCount) => {
    if (!deps || commandInFlightRef.current || !dashboardRef.current) return;
    commandInFlightRef.current = true;
    latestRequestRef.current += 1;
    const eventId = dashboardRef.current.event.id;

    try {
      await deps.applyDistribution(eventId, carriageCount);
      const requestId = ++latestRequestRef.current;
      try {
        const fresh = await deps.loadDashboard();
        const freshMissionOne = await loadMissionOne(fresh);
        if (mountedRef.current && requestId === latestRequestRef.current) {
          storeDashboard(fresh);
          setMissionOneRead(freshMissionOne);
        }
      } catch (error) {
        if (mountedRef.current && requestId === latestRequestRef.current) {
          failClosed();
        }
        throw error;
      }
    } finally {
      commandInFlightRef.current = false;
    }
  };

  const applyMissionOneOverride = async (override: {
    wagonId: string;
    selectedGuestIds: string[];
    reason: string;
  }) => {
    if (!deps?.overrideMissionOne || !dashboardRef.current) return;
    const model = missionOneRead;
    const wagon = model?.contractVersion === 2 && model.status === 'active'
      ? model.wagons.find((candidate) => candidate.wagonId === override.wagonId)
      : undefined;
    if (!wagon) throw new Error('M01 wagon snapshot is unavailable');
    await deps.overrideMissionOne({
      eventId: dashboardRef.current.event.id,
      instanceId: wagon.instanceId,
      instanceVersion: wagon.instanceVersion,
      commandId: commandId(),
      selectedGuestIds: override.selectedGuestIds,
      reason: override.reason,
    });
    try {
      await deps.broadcastRefresh?.();
    } catch {
      // The authoritative read below still reconciles this owner console.
    }
    const next = await deps.loadMissionOne?.(dashboardRef.current.event.id);
    if (mountedRef.current && next) setMissionOneRead(next);
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

  if (!dashboard || availability !== 'current') {
    return (
      <aside id="admin-bunker" className="admin-bunker-dock" aria-label="Экстренный сюжетный поворот">
        <div className="admin-bunker-dock__freshness" role="status">
          <span>OWNER-ДОСТУП · ПРОВЕРЯЕМ</span>
        </div>
      </aside>
    );
  }

  return (
    <aside id="admin-bunker" className="admin-bunker-dock" aria-label="Экстренный сюжетный поворот">
      {lastSuccessAt && (
        <div className="admin-bunker-dock__freshness" role="status">
          <span>OWNER-ДАННЫЕ ПОДТВЕРЖДЕНЫ</span>
          <time dateTime={lastSuccessAt}>
            {new Intl.DateTimeFormat('ru-RU', {
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            }).format(new Date(lastSuccessAt))}
          </time>
        </div>
      )}
      <AdminBunkerControl
        eventId={dashboard.event.id}
        dependencies={deps.bunkerControl}
        dashboard={dashboard}
        onAcceptDistribution={acceptDistribution}
        bunkerContractVersion={missionOneRead?.contractVersion}
        missionOne={ownerPanelModel(missionOneRead)}
        onMissionOneOverride={deps.overrideMissionOne ? applyMissionOneOverride : undefined}
      />
    </aside>
  );
}
