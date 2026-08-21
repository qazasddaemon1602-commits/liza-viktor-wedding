import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getOrCreateDeviceKey } from '../../lib/deviceIdentity';
import { getSupabaseClient } from '../../lib/supabase';
import { broadcastBunkerRefresh, subscribeToBunkerRefresh, type BunkerRealtimeClient } from './bunker.realtime';
import type { BunkerRpcClient } from './bunker.service';
import { getGuestBunkerQuest, submitBunkerFinalCode, submitBunkerMission } from './bunkerQuest.service';
import { getGuestBunkerRuntime, type GuestBunkerReadRuntime } from './bunkerRuntime.service';
import type { MissionOnePlayerReadModel } from './v2/MissionOnePlayer';
import { confirmMissionOneSelection, getGuestMissionOneReadModel, type ConfirmMissionOneSelectionInput, type MissionOneGuestReadModel } from './v2/m01.service';
import type { MissionTwoPlayerReadModel } from './v2/MissionTwoPlayer';
import { getGuestMissionTwoReadModel, submitMissionTwoAnswers, useMissionTwoAbility as useMissionTwoAbilityCommand, type MissionTwoGuestReadModel } from './v2/m02.service';
import type { BunkerMissionStage, GuestBunkerQuestState, SubmitBunkerFinalResult, SubmitBunkerMissionResult } from './bunkerQuest.types';

export type GuestBunkerLiveDependencies = {
  getDeviceKey: () => string;
  load: (deviceKey: string) => Promise<GuestBunkerQuestState>;
  loadRuntime?: (deviceKey: string) => Promise<GuestBunkerReadRuntime>;
  loadMissionOne?: (deviceKey: string) => Promise<MissionOneGuestReadModel>;
  confirmMissionOne?: (deviceKey: string, input: Omit<ConfirmMissionOneSelectionInput, 'eventSlug' | 'deviceKey'>) => Promise<unknown>;
  loadMissionTwo?: (deviceKey: string) => Promise<MissionTwoGuestReadModel>;
  submitMissionTwo?: (deviceKey: string, input: { commandId: string; instanceId: string; answers: string[] }) => Promise<unknown>;
  useMissionTwoAbility?: (deviceKey: string, input: { commandId: string; instanceId: string; abilityKey: 'system_access' | 'terminal_hack' }) => Promise<unknown>;
  broadcastRefresh?: () => Promise<void>;
  submitMission: (deviceKey: string, stage: BunkerMissionStage, answer: string) => Promise<SubmitBunkerMissionResult>;
  submitFinalCode: (deviceKey: string, code: string) => Promise<SubmitBunkerFinalResult>;
  subscribeToRefresh?: (callback: () => void) => () => void;
};

type UseGuestBunkerLiveStateOptions = { eventSlug?: string; dependencies?: GuestBunkerLiveDependencies; enabled?: boolean };

function browserDependencies(eventSlug: string): GuestBunkerLiveDependencies {
  const client = getSupabaseClient();
  const rpcClient = client as unknown as BunkerRpcClient;
  const realtimeClient = client as unknown as BunkerRealtimeClient;
  let deviceKey: string | undefined;
  const getDeviceKey = () => { deviceKey ??= getOrCreateDeviceKey(); return deviceKey; };
  return {
    getDeviceKey,
    load: (key) => getGuestBunkerQuest(rpcClient, eventSlug, key),
    loadRuntime: (key) => getGuestBunkerRuntime(rpcClient, eventSlug, key),
    loadMissionOne: (key) => getGuestMissionOneReadModel(rpcClient, eventSlug, key),
    confirmMissionOne: (key, input) => confirmMissionOneSelection(rpcClient, { eventSlug, deviceKey: key, ...input }),
    loadMissionTwo: (key) => getGuestMissionTwoReadModel(rpcClient, eventSlug, key),
    submitMissionTwo: (key, input) => submitMissionTwoAnswers(rpcClient, { eventSlug, deviceKey: key, ...input }),
    useMissionTwoAbility: (key, input) => useMissionTwoAbilityCommand(rpcClient, { eventSlug, deviceKey: key, ...input }),
    submitMission: (key, stage, answer) => submitBunkerMission(rpcClient, eventSlug, key, stage, answer),
    submitFinalCode: (key, code) => submitBunkerFinalCode(rpcClient, eventSlug, key, code),
    broadcastRefresh: () => broadcastBunkerRefresh(realtimeClient, eventSlug),
    subscribeToRefresh: (callback) => subscribeToBunkerRefresh(realtimeClient, eventSlug, callback),
  };
}

function remaining(deadlineAt: string, serverNow: string): number {
  return Math.max(0, Math.ceil((Date.parse(deadlineAt) - Date.parse(serverNow)) / 1000));
}

function missionOnePlayerModel(model: MissionOneGuestReadModel, connection: MissionOnePlayerReadModel['connection'] = 'online'): MissionOnePlayerReadModel | undefined {
  if (model.status !== 'active' && model.status !== 'completed') return undefined;
  return { instanceId: model.instanceId, instanceVersion: model.instanceVersion, status: model.status, wagon: model.wagon, quota: model.quota, remainingSeconds: remaining(model.deadlineAt, model.serverNow), connection, members: model.members, selectedGuestIds: model.selectedGuestIds };
}

function missionTwoPlayerModel(model: MissionTwoGuestReadModel, connection: MissionTwoPlayerReadModel['connection'] = 'online'): MissionTwoPlayerReadModel | undefined {
  if (model.status !== 'active' && model.status !== 'completed') return undefined;
  return {
    instanceId: model.instanceId,
    instanceVersion: model.instanceVersion,
    status: model.status,
    remainingSeconds: remaining(model.deadlineAt, model.serverNow),
    title: model.title,
    subtitle: model.subtitle,
    intro: model.intro,
    evidence: model.evidence,
    questions: model.questions,
    attemptCount: model.attemptCount,
    attemptsRemaining: model.attemptsRemaining,
    selectedAnswers: model.selectedAnswers,
    connection,
    ability: model.ability,
    outcome: model.outcome,
    archiveUnlocked: model.archiveUnlocked,
  };
}

function commandId(prefix = 'bunker-v2'): string {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useGuestBunkerLiveState({ eventSlug = 'liza-viktor', dependencies, enabled = true }: UseGuestBunkerLiveStateOptions = {}) {
  const deps = useMemo<GuestBunkerLiveDependencies | null>(() => dependencies ?? (enabled ? browserDependencies(eventSlug) : null), [dependencies, enabled, eventSlug]);
  const [state, setState] = useState<GuestBunkerQuestState | null>(null);
  const [runtime, setRuntime] = useState<GuestBunkerReadRuntime | null>(null);
  const [missionOne, setMissionOne] = useState<MissionOnePlayerReadModel | undefined>();
  const [missionTwo, setMissionTwo] = useState<MissionTwoPlayerReadModel | undefined>();
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
      void Promise.resolve().then(() => deps.loadRuntime!(deviceKey)).then((nextRuntime) => {
        if (!isLatest()) return; setRuntime(nextRuntime); setRuntimeError('');
      }).catch(() => {
        if (!isLatest()) return; setRuntimeError('Не удалось обновить защищённый архив. Показываем последние полученные данные.');
      }).finally(() => { if (isLatest()) setRuntimeLoading(false); });
    }

    if (deps.loadMissionOne) {
      void Promise.resolve().then(() => deps.loadMissionOne!(deviceKey)).then((next) => {
        if (isLatest()) setMissionOne(missionOnePlayerModel(next));
      }).catch(() => {
        if (isLatest()) setMissionOne((current) => current ? { ...current, connection: 'reconnecting' } : current);
      });
    }

    if (deps.loadMissionTwo) {
      void Promise.resolve().then(() => deps.loadMissionTwo!(deviceKey)).then((next) => {
        if (isLatest()) setMissionTwo(missionTwoPlayerModel(next));
      }).catch(() => {
        if (isLatest()) setMissionTwo((current) => current ? { ...current, connection: 'reconnecting' } : current);
      });
    }

    try {
      const next = await deps.load(deviceKey);
      if (isLatest()) { setState(next); setError(''); }
      return next;
    } catch {
      if (isLatest()) setError('Не удалось обновить Бункер. Повторяем подключение автоматически.');
      return null;
    }
  }, [deps, enabled]);

  useEffect(() => {
    if (!enabled || !deps) return;
    void reload();
    const unsubscribe = deps.subscribeToRefresh?.(() => { void reload(); });
    return () => { reloadGeneration.current += 1; unsubscribe?.(); };
  }, [deps, enabled, reload]);

  useEffect(() => {
    if (!enabled || !deps) return;
    const intervalMs = state?.status === 'active' || runtime?.status === 'active' ? 2_000 : 5_000;
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void reload(); }, intervalMs);
    return () => window.clearInterval(timer);
  }, [deps, enabled, reload, runtime?.status, state?.status]);

  useEffect(() => {
    if (!enabled || !deps) return;
    const refresh = () => { if (document.visibilityState === 'visible') void reload(); };
    document.addEventListener('visibilitychange', refresh); window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    return () => { document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); };
  }, [deps, enabled, reload]);

  const broadcastCompletion = useCallback(async () => {
    try { await deps?.broadcastRefresh?.(); } catch { /* polling remains authoritative fallback */ }
  }, [deps]);

  const submitMission = useCallback(async (stage: BunkerMissionStage, answer: string) => {
    if (!deps || submitting) return;
    setSubmitting(true); setFeedback('');
    try {
      const result = await deps.submitMission(deps.getDeviceKey(), stage, answer);
      setFeedback(result.status === 'completed' ? result.successCopy || 'Задание выполнено. Вагон синхронизирован.' : 'Ответ не подошёл. Попробуйте ещё раз вместе с вагоном.');
      await reload();
    } catch { setFeedback('Ответ не отправился. Попробуйте ещё раз.'); }
    finally { setSubmitting(false); }
  }, [deps, reload, submitting]);

  const submitFinalCode = useCallback(async (code: string) => {
    if (!deps || submitting) return;
    setSubmitting(true); setFeedback('');
    try {
      const result = await deps.submitFinalCode(deps.getDeviceKey(), code);
      setFeedback(result.status === 'unlocked' ? 'Доступ получен.' : result.status === 'not_ready' ? 'Не все вагоны получили свои фрагменты.' : 'Код не подошёл. Сверьте порядок вагонов и попробуйте снова.');
      await reload();
    } catch { setFeedback('Код не отправился. Попробуйте ещё раз.'); }
    finally { setSubmitting(false); }
  }, [deps, reload, submitting]);

  const confirmMissionOne = useCallback(async (selectedGuestIds: string[]) => {
    if (!deps?.confirmMissionOne || !missionOne) throw new Error('M01 confirmation is unavailable');
    const deviceKey = deps.getDeviceKey();
    try {
      await deps.confirmMissionOne(deviceKey, { commandId: commandId('m01'), instanceId: missionOne.instanceId, instanceVersion: missionOne.instanceVersion, selectedGuestIds });
      await broadcastCompletion(); await reload();
    } catch (failure) {
      if (deps.loadMissionOne) {
        try {
          const next = missionOnePlayerModel(await deps.loadMissionOne(deviceKey)); setMissionOne(next);
          if (next?.status === 'completed' && next.instanceId === missionOne.instanceId) { await broadcastCompletion(); return; }
        } catch { setMissionOne((current) => current ? { ...current, connection: 'reconnecting' } : current); }
      }
      throw failure;
    }
  }, [broadcastCompletion, deps, missionOne, reload]);

  const submitMissionTwo = useCallback(async (answers: string[]) => {
    if (!deps?.submitMissionTwo || !missionTwo || submitting) throw new Error('M02 submission is unavailable');
    const deviceKey = deps.getDeviceKey();
    setSubmitting(true); setFeedback('');
    try {
      await deps.submitMissionTwo(deviceKey, { commandId: commandId('m02-answer'), instanceId: missionTwo.instanceId, answers });
      await broadcastCompletion(); await reload();
      setFeedback('Версия отправлена. Система сверяет данные чёрного ящика.');
    } catch (failure) {
      if (deps.loadMissionTwo) {
        try {
          const next = missionTwoPlayerModel(await deps.loadMissionTwo(deviceKey)); setMissionTwo(next);
          if (next?.status === 'completed' && next.instanceId === missionTwo.instanceId) { await broadcastCompletion(); return; }
        } catch { setMissionTwo((current) => current ? { ...current, connection: 'reconnecting' } : current); }
      }
      setFeedback('Версия не отправилась. Данные на экране сохранены — попробуйте ещё раз.');
      throw failure;
    } finally { setSubmitting(false); }
  }, [broadcastCompletion, deps, missionTwo, reload, submitting]);

  const useMissionTwoAbility = useCallback(async (abilityKey: 'system_access' | 'terminal_hack') => {
    if (!deps?.useMissionTwoAbility || !missionTwo || submitting) throw new Error('M02 ability is unavailable');
    setSubmitting(true);
    try {
      await deps.useMissionTwoAbility(deps.getDeviceKey(), { commandId: commandId('m02-ability'), instanceId: missionTwo.instanceId, abilityKey });
      await broadcastCompletion(); await reload();
    } finally { setSubmitting(false); }
  }, [broadcastCompletion, deps, missionTwo, reload, submitting]);

  return { state, runtime, missionOne, missionTwo, runtimeLoading, runtimeError, feedback, error, submitting, reload, submitMission, submitFinalCode, confirmMissionOne, submitMissionTwo, useMissionTwoAbility };
}
