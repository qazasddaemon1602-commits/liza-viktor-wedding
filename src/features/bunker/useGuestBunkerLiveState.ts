import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getOrCreateDeviceKey } from '../../lib/deviceIdentity';
import { getSupabaseClient } from '../../lib/supabase';
import { subscribeToBunkerRefresh, type BunkerRealtimeClient } from './bunker.realtime';
import type { BunkerRpcClient } from './bunker.service';
import {
  getGuestBunkerQuest,
  submitBunkerFinalCode,
  submitBunkerMission,
} from './bunkerQuest.service';
import {
  getGuestBunkerRuntime,
  type GuestBunkerReadRuntime,
} from './bunkerRuntime.service';
import type { MissionOnePlayerReadModel } from './v2/MissionOnePlayer';
import {
  confirmMissionOneSelection,
  getGuestMissionOneReadModel,
  type ConfirmMissionOneSelectionInput,
  type MissionOneGuestReadModel,
} from './v2/m01.service';
import type {
  BunkerMissionStage,
  GuestBunkerQuestState,
  SubmitBunkerFinalResult,
  SubmitBunkerMissionResult,
} from './bunkerQuest.types';

export type GuestBunkerLiveDependencies = {
  getDeviceKey: () => string;
  load: (deviceKey: string) => Promise<GuestBunkerQuestState>;
  loadRuntime?: (deviceKey: string) => Promise<GuestBunkerReadRuntime>;
  loadMissionOne?: (deviceKey: string) => Promise<MissionOneGuestReadModel>;
  confirmMissionOne?: (
    deviceKey: string,
    input: Omit<ConfirmMissionOneSelectionInput, 'eventSlug' | 'deviceKey'>,
  ) => Promise<unknown>;
  submitMission: (
    deviceKey: string,
    stage: BunkerMissionStage,
    answer: string,
  ) => Promise<SubmitBunkerMissionResult>;
  submitFinalCode: (deviceKey: string, code: string) => Promise<SubmitBunkerFinalResult>;
  subscribeToRefresh?: (callback: () => void) => () => void;
};

type UseGuestBunkerLiveStateOptions = {
  eventSlug?: string;
  dependencies?: GuestBunkerLiveDependencies;
  enabled?: boolean;
};

function browserDependencies(eventSlug: string): GuestBunkerLiveDependencies {
  const client = getSupabaseClient();
  const rpcClient = client as unknown as BunkerRpcClient;
  const realtimeClient = client as unknown as BunkerRealtimeClient;
  let deviceKey: string | undefined;
  const getDeviceKey = () => {
    deviceKey ??= getOrCreateDeviceKey();
    return deviceKey;
  };
  return {
    getDeviceKey,
    load: (key) => getGuestBunkerQuest(rpcClient, eventSlug, key),
    loadRuntime: (key) => getGuestBunkerRuntime(rpcClient, eventSlug, key),
    loadMissionOne: (key) => getGuestMissionOneReadModel(rpcClient, eventSlug, key),
    confirmMissionOne: (key, input) => confirmMissionOneSelection(rpcClient, {
      eventSlug,
      deviceKey: key,
      ...input,
    }),
    submitMission: (key, stage, answer) => submitBunkerMission(rpcClient, eventSlug, key, stage, answer),
    submitFinalCode: (key, code) => submitBunkerFinalCode(rpcClient, eventSlug, key, code),
    subscribeToRefresh: (callback) => subscribeToBunkerRefresh(realtimeClient, eventSlug, callback),
  };
}

function missionOnePlayerModel(
  model: MissionOneGuestReadModel,
  connection: MissionOnePlayerReadModel['connection'] = 'online',
): MissionOnePlayerReadModel | undefined {
  if (model.status !== 'active' && model.status !== 'completed') return undefined;
  return {
    instanceId: model.instanceId,
    instanceVersion: model.instanceVersion,
    status: model.status,
    wagon: model.wagon,
    quota: model.quota,
    remainingSeconds: Math.max(
      0,
      Math.ceil((Date.parse(model.deadlineAt) - Date.parse(model.serverNow)) / 1000),
    ),
    connection,
    members: model.members,
    selectedGuestIds: model.selectedGuestIds,
  };
}

function commandId(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `m01-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useGuestBunkerLiveState({
  eventSlug = 'liza-viktor',
  dependencies,
  enabled = true,
}: UseGuestBunkerLiveStateOptions = {}) {
  const deps = useMemo<GuestBunkerLiveDependencies | null>(
    () => dependencies ?? (enabled ? browserDependencies(eventSlug) : null),
    [dependencies, enabled, eventSlug],
  );
  const [state, setState] = useState<GuestBunkerQuestState | null>(null);
  const [runtime, setRuntime] = useState<GuestBunkerReadRuntime | null>(null);
  const [missionOne, setMissionOne] = useState<MissionOnePlayerReadModel | undefined>();
  const [runtimeLoading, setRuntimeLoading] = useState(Boolean(enabled && deps?.loadRuntime));
  const [runtimeError, setRuntimeError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const reloadGeneration = useRef(0);

  const reload = useCallback(async () => {
    if (!enabled || !deps) return null;
    const generation = ++reloadGeneration.current;
    const isLatest = () => generation === reloadGeneration.current;
    const deviceKey = deps.getDeviceKey();
    if (deps.loadRuntime) setRuntimeLoading(true);

    if (deps.loadRuntime) {
      void Promise.resolve()
        .then(() => deps.loadRuntime!(deviceKey))
        .then((nextRuntime) => {
          if (!isLatest()) return;
          setRuntime(nextRuntime);
          setRuntimeError('');
        })
        .catch(() => {
          if (!isLatest()) return;
          setRuntimeError('Не удалось обновить защищённый архив. Показываем последние полученные данные.');
        })
        .finally(() => {
          if (isLatest()) setRuntimeLoading(false);
        });
    }

    if (deps.loadMissionOne) {
      void Promise.resolve()
        .then(() => deps.loadMissionOne!(deviceKey))
        .then((nextMissionOne) => {
          if (!isLatest()) return;
          setMissionOne(missionOnePlayerModel(nextMissionOne));
        })
        .catch(() => {
          if (!isLatest()) return;
          setMissionOne((current) => (
            current ? { ...current, connection: 'reconnecting' } : current
          ));
        });
    }

    try {
      const next = await deps.load(deviceKey);
      if (isLatest()) {
        setState(next);
        setError('');
      }
      return next;
    } catch {
      if (isLatest()) {
        setError('Не удалось обновить Бункер. Повторяем подключение автоматически.');
      }
      return null;
    }
  }, [deps, enabled]);

  useEffect(() => {
    if (!enabled || !deps) return;
    void reload();
    const unsubscribe = deps.subscribeToRefresh?.(() => { void reload(); });
    return () => {
      reloadGeneration.current += 1;
      unsubscribe?.();
    };
  }, [deps, enabled, reload]);

  useEffect(() => {
    if (!enabled || !deps) return;
    const intervalMs = state?.status === 'active' || runtime?.status === 'active' ? 2_000 : 5_000;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void reload();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [deps, enabled, reload, runtime?.status, state?.status]);

  useEffect(() => {
    if (!enabled || !deps) return;
    const refresh = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [deps, enabled, reload]);

  const submitMission = useCallback(async (stage: BunkerMissionStage, answer: string) => {
    if (!deps || submitting) return;
    setSubmitting(true);
    setFeedback('');
    try {
      const result = await deps.submitMission(deps.getDeviceKey(), stage, answer);
      setFeedback(
        result.status === 'completed'
          ? result.successCopy || 'Задание выполнено. Вагон синхронизирован.'
          : 'Ответ не подошёл. Попробуйте ещё раз вместе с вагоном.',
      );
      await reload();
    } catch {
      setFeedback('Ответ не отправился. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  }, [deps, reload, submitting]);

  const submitFinalCode = useCallback(async (code: string) => {
    if (!deps || submitting) return;
    setSubmitting(true);
    setFeedback('');
    try {
      const result = await deps.submitFinalCode(deps.getDeviceKey(), code);
      if (result.status === 'unlocked') {
        setFeedback('Доступ получен.');
      } else if (result.status === 'not_ready') {
        setFeedback('Не все вагоны получили свои фрагменты.');
      } else {
        setFeedback('Код не подошёл. Сверьте порядок вагонов и попробуйте снова.');
      }
      await reload();
    } catch {
      setFeedback('Код не отправился. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  }, [deps, reload, submitting]);

  const confirmMissionOne = useCallback(async (selectedGuestIds: string[]) => {
    if (!deps?.confirmMissionOne || !missionOne) {
      throw new Error('M01 confirmation is unavailable');
    }
    await deps.confirmMissionOne(deps.getDeviceKey(), {
      commandId: commandId(),
      instanceId: missionOne.instanceId,
      instanceVersion: missionOne.instanceVersion,
      selectedGuestIds,
    });
    await reload();
  }, [deps, missionOne, reload]);

  return {
    state,
    runtime,
    missionOne,
    runtimeLoading,
    runtimeError,
    feedback,
    error,
    submitting,
    reload,
    submitMission,
    submitFinalCode,
    confirmMissionOne,
  };
}
