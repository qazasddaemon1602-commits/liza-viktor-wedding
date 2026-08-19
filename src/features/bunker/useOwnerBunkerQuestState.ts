import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import { broadcastBunkerRefresh, subscribeToBunkerRefresh, type BunkerRealtimeClient } from './bunker.realtime';
import type { BunkerRpcClient } from './bunker.service';
import {
  advanceBunkerPhase,
  beginBunkerQuest,
  forceCompleteBunkerTeamStage,
  getOwnerBunkerQuest,
  resetBunkerTeamStage,
  unlockBunker,
} from './bunkerQuest.service';
import type {
  BunkerMissionStage,
  BunkerPhase,
  OwnerBunkerQuestState,
} from './bunkerQuest.types';

export type OwnerBunkerQuestDependencies = {
  load: () => Promise<OwnerBunkerQuestState>;
  begin: () => Promise<OwnerBunkerQuestState>;
  advance: (phase: BunkerPhase) => Promise<OwnerBunkerQuestState>;
  resetStage: (carriageId: string, stage: BunkerMissionStage) => Promise<OwnerBunkerQuestState>;
  forceStage: (carriageId: string, stage: BunkerMissionStage) => Promise<OwnerBunkerQuestState>;
  unlock: () => Promise<OwnerBunkerQuestState>;
  broadcast: () => Promise<void>;
  subscribeToRefresh?: (callback: () => void) => () => void;
};

type Options = {
  eventSlug?: string;
  dependencies?: OwnerBunkerQuestDependencies;
  enabled?: boolean;
};

function browserDependencies(eventId: string, eventSlug: string): OwnerBunkerQuestDependencies {
  const client = getSupabaseClient();
  const rpcClient = client as unknown as BunkerRpcClient;
  const realtimeClient = client as unknown as BunkerRealtimeClient;
  return {
    load: () => getOwnerBunkerQuest(rpcClient, eventId),
    begin: () => beginBunkerQuest(rpcClient, eventId),
    advance: (phase) => advanceBunkerPhase(rpcClient, eventId, phase),
    resetStage: (carriageId, stage) => resetBunkerTeamStage(rpcClient, eventId, carriageId, stage),
    forceStage: (carriageId, stage) => forceCompleteBunkerTeamStage(rpcClient, eventId, carriageId, stage),
    unlock: () => unlockBunker(rpcClient, eventId),
    broadcast: () => broadcastBunkerRefresh(realtimeClient, eventSlug),
    subscribeToRefresh: (callback) => subscribeToBunkerRefresh(realtimeClient, eventSlug, callback),
  };
}

export function useOwnerBunkerQuestState(
  eventId: string | null,
  {
    eventSlug = 'liza-viktor',
    dependencies,
    enabled = true,
  }: Options = {},
) {
  const deps = useMemo<OwnerBunkerQuestDependencies | null>(
    () => dependencies ?? (enabled && eventId ? browserDependencies(eventId, eventSlug) : null),
    [dependencies, enabled, eventId, eventSlug],
  );
  const [state, setState] = useState<OwnerBunkerQuestState | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  const reload = useCallback(async () => {
    if (!enabled || !deps) return null;
    try {
      const next = await deps.load();
      setState(next);
      setError('');
      return next;
    } catch {
      setError('Не удалось обновить состояние квеста Бункера.');
      return null;
    }
  }, [deps, enabled]);

  useEffect(() => {
    if (!enabled || !deps) return;
    void reload();
    const unsubscribe = deps.subscribeToRefresh?.(() => { void reload(); });
    return () => unsubscribe?.();
  }, [deps, enabled, reload]);

  useEffect(() => {
    if (!enabled || !deps) return;
    const timer = window.setInterval(() => { void reload(); }, state?.status === 'active' ? 2_500 : 5_000);
    return () => window.clearInterval(timer);
  }, [deps, enabled, reload, state?.status]);

  const mutate = useCallback(async (
    label: string,
    action: () => Promise<OwnerBunkerQuestState>,
  ) => {
    if (!deps || busy) return;
    setBusy(label);
    setError('');
    setWarning('');
    try {
      const optimisticAuthoritative = await action();
      setState(optimisticAuthoritative);
      try {
        await deps.broadcast();
      } catch {
        setWarning('Команда сохранена, но сигнал синхронизации не отправился. Экраны обновятся через резервную проверку.');
      }
      await reload();
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : '';
      setError(message || 'Команда Бункера не выполнилась.');
    } finally {
      setBusy('');
    }
  }, [busy, deps, reload]);

  const begin = useCallback(
    () => mutate('begin', () => deps!.begin()),
    [deps, mutate],
  );
  const advance = useCallback(
    (phase: BunkerPhase) => mutate(`advance:${phase}`, () => deps!.advance(phase)),
    [deps, mutate],
  );
  const resetStage = useCallback(
    (carriageId: string, stage: BunkerMissionStage) => mutate(`reset:${carriageId}:${stage}`, () => deps!.resetStage(carriageId, stage)),
    [deps, mutate],
  );
  const forceStage = useCallback(
    (carriageId: string, stage: BunkerMissionStage) => mutate(`force:${carriageId}:${stage}`, () => deps!.forceStage(carriageId, stage)),
    [deps, mutate],
  );
  const unlock = useCallback(
    () => mutate('unlock', () => deps!.unlock()),
    [deps, mutate],
  );

  return {
    state,
    busy,
    error,
    warning,
    reload,
    begin,
    advance,
    resetStage,
    forceStage,
    unlock,
  };
}
