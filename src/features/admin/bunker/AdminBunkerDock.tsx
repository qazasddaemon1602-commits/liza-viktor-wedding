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

const EVENT_SLUG = 'liza-viktor';

export type AdminBunkerDockDependencies = {
  loadDashboard: () => Promise<AdminDashboard>;
  applyDistribution: (eventId: string, carriageCount: SupportedCarriageCount) => Promise<unknown>;
  bunkerControl?: AdminBunkerControlDependencies;
};

type AdminBunkerDockProps = {
  dependencies?: AdminBunkerDockDependencies;
  pollIntervalMs?: number;
};

function browserDependencies(): AdminBunkerDockDependencies | null {
  try {
    const client = getSupabaseClient() as unknown as AdminRpcClient;
    return {
      loadDashboard: () => loadOwnerDashboard(client, EVENT_SLUG),
      applyDistribution: (eventId, carriageCount) => applyCarriageDistribution(
        client,
        eventId,
        carriageCount,
      ),
    };
  } catch {
    return null;
  }
}

export function AdminBunkerDock({
  dependencies,
  pollIntervalMs = 15_000,
}: AdminBunkerDockProps = {}) {
  const deps = useMemo(() => dependencies ?? browserDependencies(), [dependencies]);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
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
  }, []);

  const pollDashboard = useCallback(async () => {
    if (!deps || commandInFlightRef.current) return;
    const activeRequestId = activePollRequestRef.current;
    if (activeRequestId !== null && activeRequestId === latestRequestRef.current) return;
    const requestId = ++latestRequestRef.current;
    activePollRequestRef.current = requestId;

    try {
      const next = await deps.loadDashboard();
      if (mountedRef.current && requestId === latestRequestRef.current) {
        storeDashboard(next);
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
  }, [deps, failClosed, storeDashboard]);

  useEffect(() => {
    if (!deps) return undefined;
    mountedRef.current = true;
    void pollDashboard();
    const interval = window.setInterval(() => void pollDashboard(), pollIntervalMs);

    return () => {
      mountedRef.current = false;
      latestRequestRef.current += 1;
      activePollRequestRef.current = null;
      window.clearInterval(interval);
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
        if (mountedRef.current && requestId === latestRequestRef.current) {
          storeDashboard(fresh);
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
      />
    </aside>
  );
}
