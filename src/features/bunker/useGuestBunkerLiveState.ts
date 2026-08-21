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
    submitMission: (key, stage, answer) => submitBunkerMission(rpcClient, eventSlug, key, stage, answer),
    submitFinalCode: (key, code) => submitBunkerFinalCode(rpcClient, eventSlug, key, code),
    subscribeToRefresh: (callback) => subscribeToBunkerRefresh(realtimeClient, eventSlug, callback),
  };
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
    const intervalMs = state?.status === 'active' ? 2_000 : 5_000;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void reload();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [deps, enabled, reload, state?.status]);

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

  return {
    state,
    runtime,
    runtimeLoading,
    runtimeError,
    feedback,
    error,
    submitting,
    reload,
    submitMission,
    submitFinalCode,
  };
}
