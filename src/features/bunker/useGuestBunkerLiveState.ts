import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getOrCreateDeviceKey } from '../../lib/deviceIdentity';
import { getSupabaseClient } from '../../lib/supabase';
import { broadcastBunkerRefresh, subscribeToBunkerRefresh, type BunkerRealtimeClient } from './bunker.realtime';
import type { BunkerRpcClient } from './bunker.service';
import { getGuestBunkerQuest, submitBunkerFinalCode, submitBunkerMission } from './bunkerQuest.service';
import { getGuestBunkerRuntime, type GuestBunkerReadRuntime } from './bunkerRuntime.service';
import type { BunkerMissionStage, GuestBunkerQuestState, SubmitBunkerFinalResult, SubmitBunkerMissionResult } from './bunkerQuest.types';
import type { MissionOnePlayerReadModel } from './v2/MissionOnePlayer';
import { confirmMissionOneSelection, getGuestMissionOneReadModel, type ConfirmMissionOneSelectionInput, type MissionOneGuestReadModel } from './v2/m01.service';
import type { MissionTwoPlayerReadModel } from './v2/MissionTwoPlayer';
import { getGuestMissionTwoReadModel, submitMissionTwoAnswers, useMissionTwoAbility as useM02AbilityCommand, type MissionTwoGuestReadModel } from './v2/m02.service';
import type { MissionThreePlayerReadModel } from './v2/MissionThreePlayer';
import { commitMissionThreeAbility as useM03AbilityCommand, confirmMissionThree as confirmM03Command, getGuestMissionThreeReadModel, type MissionThreeGuestReadModel } from './v2/m03.service';
import type { MissionFourPlayerReadModel } from './v2/MissionFourPlayer';
import { getGuestMissionFourReadModel, proposeMissionFourTrade as proposeM04TradeCommand, respondMissionFourTrade as respondM04TradeCommand, sendMissionFourMessage as sendM04MessageCommand, submitMissionFourAnswer as submitM04AnswerCommand, type MissionFourGuestReadModel } from './v2/m04.service';
import type { MissionFivePlayerReadModel } from './v2/MissionFivePlayer';
import { castMissionFiveVote as castM05VoteCommand, getGuestMissionFiveReadModel, useMissionFiveAbility as useM05AbilityCommand, type MissionFiveGuestReadModel } from './v2/m05.service';
import type { MissionSixPlayerReadModel } from './v2/MissionSixPlayer';
import { castMissionSixVote as castM06VoteCommand, getGuestMissionSixReadModel, revealMissionSixFragment as revealM06FragmentCommand, useMissionSixAbility as useM06AbilityCommand, type MissionSixGuestReadModel } from './v2/m06.service';
import type { UnknownPassengerPlayerModel } from './v2/UnknownPassengerPlayer';
import { getGuestUnknownPassengerReadModel, type UnknownPassengerGuestReadModel } from './v2/unknownPassenger.service';
import type { FinalPlayerModel } from './v2/FinalPlayer';
import { getGuestFinalReadModel, requestFinalAccess as requestFinalAccessCommand, type FinalGuestReadModel, type FinalValues } from './v2/final.service';
import { getGuestBunkerV2Dashboard, type BunkerV2DashboardReadModel } from './v2/dashboard.service';

export type GuestBunkerLiveDependencies = {
  getDeviceKey: () => string;
  load: (deviceKey: string) => Promise<GuestBunkerQuestState>;
  loadRuntime?: (deviceKey: string) => Promise<GuestBunkerReadRuntime>;
  loadDashboard?: (deviceKey: string) => Promise<BunkerV2DashboardReadModel>;
  loadMissionOne?: (deviceKey: string) => Promise<MissionOneGuestReadModel>;
  confirmMissionOne?: (deviceKey: string, input: Omit<ConfirmMissionOneSelectionInput, 'eventSlug' | 'deviceKey'>) => Promise<unknown>;
  loadMissionTwo?: (deviceKey: string) => Promise<MissionTwoGuestReadModel>;
  submitMissionTwo?: (deviceKey: string, input: { commandId: string; instanceId: string; answers: string[] }) => Promise<unknown>;
  useMissionTwoAbility?: (deviceKey: string, input: { commandId: string; instanceId: string; abilityKey: 'system_access' | 'terminal_hack' }) => Promise<unknown>;
  loadMissionThree?: (deviceKey: string) => Promise<MissionThreeGuestReadModel>;
  confirmMissionThree?: (deviceKey: string, input: { commandId: string; instanceId: string; instanceVersion: number; selectedProblems: string[] }) => Promise<unknown>;
  useMissionThreeAbility?: (deviceKey: string, input: { commandId: string; instanceId: string; problemKey: string }) => Promise<unknown>;
  loadMissionFour?: (deviceKey: string) => Promise<MissionFourGuestReadModel>;
  sendMissionFourMessage?: (deviceKey: string, input: { commandId: string; instanceId: string; message: string }) => Promise<unknown>;
  proposeMissionFourTrade?: (deviceKey: string, input: { commandId: string; instanceId: string; targetWagonNumber: number; itemKey: string; quantity: number }) => Promise<unknown>;
  respondMissionFourTrade?: (deviceKey: string, input: { commandId: string; instanceId: string; transferId: string; response: 'accept' | 'reject' }) => Promise<unknown>;
  submitMissionFourAnswer?: (deviceKey: string, input: { commandId: string; instanceId: string; answer: string }) => Promise<unknown>;
  loadMissionFive?: (deviceKey: string) => Promise<MissionFiveGuestReadModel>;
  castMissionFiveVote?: (deviceKey: string, input: { commandId: string; instanceId: string; vote: 'A' | 'B' }) => Promise<unknown>;
  useMissionFiveAbility?: (deviceKey: string, input: { commandId: string; instanceId: string }) => Promise<unknown>;
  loadMissionSix?: (deviceKey: string) => Promise<MissionSixGuestReadModel>;
  revealMissionSixFragment?: (deviceKey: string, input: { commandId: string; instanceId: string; fragmentKey: string }) => Promise<unknown>;
  castMissionSixVote?: (deviceKey: string, input: { commandId: string; instanceId: string; vote: 'A' | 'B' | 'C' }) => Promise<unknown>;
  useMissionSixAbility?: (deviceKey: string, input: { commandId: string; instanceId: string }) => Promise<unknown>;
  loadUnknownPassenger?: (deviceKey: string) => Promise<UnknownPassengerGuestReadModel>;
  loadFinal?: (deviceKey: string) => Promise<FinalGuestReadModel>;
  requestFinalAccess?: (deviceKey: string, input: { commandId: string; values: FinalValues }) => Promise<unknown>;
  broadcastRefresh?: () => Promise<void>;
  submitMission: (deviceKey: string, stage: BunkerMissionStage, answer: string) => Promise<SubmitBunkerMissionResult>;
  submitFinalCode: (deviceKey: string, code: string) => Promise<SubmitBunkerFinalResult>;
  subscribeToRefresh?: (callback: () => void) => () => void;
};

type Options = { eventSlug?: string; dependencies?: GuestBunkerLiveDependencies; enabled?: boolean };
type ActiveDashboard = Extract<BunkerV2DashboardReadModel, { status: 'active' }>;

function browserDependencies(eventSlug: string): GuestBunkerLiveDependencies {
  const client = getSupabaseClient();
  const rpc = client as unknown as BunkerRpcClient;
  const realtime = client as unknown as BunkerRealtimeClient;
  let deviceKey: string | undefined;
  const getDeviceKey = () => {
    deviceKey ??= getOrCreateDeviceKey();
    return deviceKey;
  };

  return {
    getDeviceKey,
    load: (key) => getGuestBunkerQuest(rpc, eventSlug, key),
    loadRuntime: (key) => getGuestBunkerRuntime(rpc, eventSlug, key),
    loadDashboard: (key) => getGuestBunkerV2Dashboard(rpc, eventSlug, key),
    loadMissionOne: (key) => getGuestMissionOneReadModel(rpc, eventSlug, key),
    confirmMissionOne: (key, input) => confirmMissionOneSelection(rpc, { eventSlug, deviceKey: key, ...input }),
    loadMissionTwo: (key) => getGuestMissionTwoReadModel(rpc, eventSlug, key),
    submitMissionTwo: (key, input) => submitMissionTwoAnswers(rpc, { eventSlug, deviceKey: key, ...input }),
    useMissionTwoAbility: (key, input) => useM02AbilityCommand(rpc, { eventSlug, deviceKey: key, ...input }),
    loadMissionThree: (key) => getGuestMissionThreeReadModel(rpc, eventSlug, key),
    confirmMissionThree: (key, input) => confirmM03Command(rpc, { eventSlug, deviceKey: key, ...input }),
    useMissionThreeAbility: (key, input) => useM03AbilityCommand(rpc, { eventSlug, deviceKey: key, ...input }),
    loadMissionFour: (key) => getGuestMissionFourReadModel(rpc, eventSlug, key),
    sendMissionFourMessage: (key, input) => sendM04MessageCommand(rpc, { eventSlug, deviceKey: key, ...input }),
    proposeMissionFourTrade: (key, input) => proposeM04TradeCommand(rpc, { eventSlug, deviceKey: key, ...input }),
    respondMissionFourTrade: (key, input) => respondM04TradeCommand(rpc, { eventSlug, deviceKey: key, ...input }),
    submitMissionFourAnswer: (key, input) => submitM04AnswerCommand(rpc, { eventSlug, deviceKey: key, ...input }),
    loadMissionFive: (key) => getGuestMissionFiveReadModel(rpc, eventSlug, key),
    castMissionFiveVote: (key, input) => castM05VoteCommand(rpc, { eventSlug, deviceKey: key, ...input }),
    useMissionFiveAbility: (key, input) => useM05AbilityCommand(rpc, { eventSlug, deviceKey: key, ...input }),
    loadMissionSix: (key) => getGuestMissionSixReadModel(rpc, eventSlug, key),
    revealMissionSixFragment: (key, input) => revealM06FragmentCommand(rpc, { eventSlug, deviceKey: key, ...input }),
    castMissionSixVote: (key, input) => castM06VoteCommand(rpc, { eventSlug, deviceKey: key, ...input }),
    useMissionSixAbility: (key, input) => useM06AbilityCommand(rpc, { eventSlug, deviceKey: key, ...input }),
    loadUnknownPassenger: (key) => getGuestUnknownPassengerReadModel(rpc, eventSlug, key),
    loadFinal: (key) => getGuestFinalReadModel(rpc, eventSlug, key),
    requestFinalAccess: (key, input) => requestFinalAccessCommand(rpc, { eventSlug, deviceKey: key, ...input }),
    submitMission: (key, stage, answer) => submitBunkerMission(rpc, eventSlug, key, stage, answer),
    submitFinalCode: (key, code) => submitBunkerFinalCode(rpc, eventSlug, key, code),
    broadcastRefresh: () => broadcastBunkerRefresh(realtime, eventSlug),
    subscribeToRefresh: (callback) => subscribeToBunkerRefresh(realtime, eventSlug, callback),
  };
}

function remaining(deadlineAt: string, serverNow: string) {
  return Math.max(0, Math.ceil((Date.parse(deadlineAt) - Date.parse(serverNow)) / 1000));
}
function m01(m: MissionOneGuestReadModel, connection: MissionOnePlayerReadModel['connection'] = 'online'): MissionOnePlayerReadModel | undefined {
  return m.status === 'active' || m.status === 'completed' ? { instanceId: m.instanceId, instanceVersion: m.instanceVersion, status: m.status, wagon: m.wagon, quota: m.quota, remainingSeconds: remaining(m.deadlineAt, m.serverNow), connection, members: m.members, selectedGuestIds: m.selectedGuestIds } : undefined;
}
function m02(m: MissionTwoGuestReadModel, connection: MissionTwoPlayerReadModel['connection'] = 'online'): MissionTwoPlayerReadModel | undefined {
  return m.status === 'active' || m.status === 'completed' ? { instanceId: m.instanceId, instanceVersion: m.instanceVersion, status: m.status, remainingSeconds: remaining(m.deadlineAt, m.serverNow), title: m.title, subtitle: m.subtitle, intro: m.intro, evidence: m.evidence, questions: m.questions, attemptCount: m.attemptCount, attemptsRemaining: m.attemptsRemaining, selectedAnswers: m.selectedAnswers, connection, ability: m.ability, outcome: m.outcome, archiveUnlocked: m.archiveUnlocked } : undefined;
}
function m03(m: MissionThreeGuestReadModel, connection: MissionThreePlayerReadModel['connection'] = 'online'): MissionThreePlayerReadModel | undefined {
  return m.status === 'active' || m.status === 'completed' ? { instanceId: m.instanceId, instanceVersion: m.instanceVersion, status: m.status, remainingSeconds: remaining(m.deadlineAt, m.serverNow), title: m.title, intro: m.intro, memberRole: m.memberRole, problems: m.problems, inventory: m.inventory, selectedProblems: m.selectedProblems, ability: m.ability, pendingCommitments: m.pendingCommitments, connection, outcome: m.outcome } : undefined;
}
function m04(m: MissionFourGuestReadModel, connection: MissionFourPlayerReadModel['connection'] = 'online'): MissionFourPlayerReadModel | undefined {
  return m.status === 'active' || m.status === 'completed' ? { instanceId: m.instanceId, status: m.status, remainingSeconds: remaining(m.deadlineAt, m.serverNow), title: m.title, interactionPhase: m.interactionPhase, group: m.group, viewer: m.viewer, messageQuota: m.messageQuota, messagesRemaining: m.messagesRemaining, messages: m.messages, inventory: m.inventory, trades: m.trades, answer: m.answer, ability: m.ability, connection } : undefined;
}
function m05(m: MissionFiveGuestReadModel, connection: MissionFivePlayerReadModel['connection'] = 'online'): MissionFivePlayerReadModel | undefined {
  return m.status === 'active' || m.status === 'completed' ? { instanceId: m.instanceId, status: m.status, remainingSeconds: remaining(m.deadlineAt, m.serverNow), title: m.title, intro: m.intro, routes: m.routes, selectedVote: m.selectedVote, voteCounts: m.voteCounts, ability: m.ability, connection, outcome: m.outcome } : undefined;
}
function m06(m: MissionSixGuestReadModel, connection: MissionSixPlayerReadModel['connection'] = 'online'): MissionSixPlayerReadModel | undefined {
  return m.status === 'active' || m.status === 'completed' ? { instanceId: m.instanceId, status: m.status, remainingSeconds: remaining(m.deadlineAt, m.serverNow), title: m.title, intro: m.intro, viewer: m.viewer, privateFragment: m.privateFragment, fragmentShared: m.fragmentShared, revealedFragments: m.revealedFragments, fragmentsRevealed: m.fragmentsRevealed, fragmentsTotal: m.fragmentsTotal, options: m.options, selectedVote: m.selectedVote, wagonConsensus: m.wagonConsensus, ability: m.ability, connection, outcome: m.outcome } : undefined;
}
function unknown(m: UnknownPassengerGuestReadModel): UnknownPassengerPlayerModel | undefined {
  return m.status === 'active' ? { remainingSeconds: remaining(m.deadlineAt, m.serverNow), title: m.title, dossierId: m.dossierId, lead: m.lead, sector: m.sector, accessCode: m.accessCode, recoveredBy: m.recoveredBy, storyPoints: m.storyPoints } : undefined;
}
function finalModel(m: FinalGuestReadModel, connection: FinalPlayerModel['connection'] = 'online'): FinalPlayerModel | undefined {
  return m.status === 'active' || m.status === 'completed' ? { remainingSeconds: remaining(m.deadlineAt, m.serverNow), title: m.title, wagon: m.wagon, fragments: m.fragments, terminal: m.terminal, hint: m.hint, connection, timeAdjustmentSeconds: m.timeAdjustmentSeconds } : undefined;
}
function commandId(prefix = 'bunker-v2') {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useGuestBunkerLiveState({ eventSlug = 'liza-viktor', dependencies, enabled = true }: Options = {}) {
  const deps = useMemo<GuestBunkerLiveDependencies | null>(() => dependencies ?? (enabled ? browserDependencies(eventSlug) : null), [dependencies, enabled, eventSlug]);
  const [state, setState] = useState<GuestBunkerQuestState | null>(null);
  const [runtime, setRuntime] = useState<GuestBunkerReadRuntime | null>(null);
  const [dashboard, setDashboard] = useState<ActiveDashboard>();
  const [dashboardError, setDashboardError] = useState('');
  const [missionOne, setMissionOne] = useState<MissionOnePlayerReadModel>();
  const [missionTwo, setMissionTwo] = useState<MissionTwoPlayerReadModel>();
  const [missionThree, setMissionThree] = useState<MissionThreePlayerReadModel>();
  const [missionFour, setMissionFour] = useState<MissionFourPlayerReadModel>();
  const [missionFive, setMissionFive] = useState<MissionFivePlayerReadModel>();
  const [missionSix, setMissionSix] = useState<MissionSixPlayerReadModel>();
  const [unknownPassenger, setUnknownPassenger] = useState<UnknownPassengerPlayerModel>();
  const [final, setFinal] = useState<FinalPlayerModel>();
  const [runtimeLoading, setRuntimeLoading] = useState(Boolean(enabled && deps?.loadRuntime));
  const [runtimeError, setRuntimeError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const generation = useRef(0);
  const runtimeStage = useRef<string | null>(null);
  const runtimeRunNonce = useRef<string | null>(null);

  const clearNonCurrent = useCallback((stage: string | null) => {
    if (stage !== 'MISSION_01') setMissionOne(undefined);
    if (stage !== 'MISSION_02') setMissionTwo(undefined);
    if (stage !== 'MISSION_03') setMissionThree(undefined);
    if (stage !== 'MISSION_04') setMissionFour(undefined);
    if (stage !== 'MISSION_05') setMissionFive(undefined);
    if (stage !== 'MISSION_06') setMissionSix(undefined);
    if (stage !== 'UNKNOWN_PASSENGER') setUnknownPassenger(undefined);
    if (stage !== 'FINAL_30') setFinal(undefined);
  }, []);

  const reload = useCallback(async () => {
    if (!enabled || !deps) return null;
    const request = ++generation.current;
    const latest = () => request === generation.current;
    const key = deps.getDeviceKey();

    if (deps.loadRuntime) setRuntimeLoading(true);
    if (deps.loadRuntime) {
      void Promise.resolve(deps.loadRuntime(key)).then((next) => {
        if (!latest()) return;
        setRuntime(next);
        setRuntimeError('');
        if (next.status === 'active' && 'contractVersion' in next && next.contractVersion === 2) {
          runtimeStage.current = next.state;
          clearNonCurrent(next.state);
        } else {
          runtimeStage.current = null;
        }
      }).catch(() => {
        if (latest()) setRuntimeError('Не удалось обновить защищённый архив. Показываем последние полученные данные.');
      }).finally(() => {
        if (latest()) setRuntimeLoading(false);
      });
    }

    if (deps.loadDashboard) {
      void Promise.resolve(deps.loadDashboard(key)).then((next) => {
        if (!latest()) return;
        setDashboard(next.status === 'active' ? next : undefined);
        setDashboardError('');
      }).catch(() => {
        if (!latest()) return;
        setDashboardError('Не удалось обновить данные вагона. Показываем последние полученные данные.');
      });
    }

    const projection = <T, R>(
      stage: string,
      loader: ((key: string) => Promise<T>) | undefined,
      map: (value: T) => R | undefined,
      setter: (value: R | undefined | ((current: R | undefined) => R | undefined)) => void,
      reconnect?: (current: R) => R,
    ) => {
      if (!loader) return;
      void Promise.resolve(loader(key)).then((next) => {
        if (!latest()) return;
        if (runtimeStage.current && runtimeStage.current !== stage) {
          setter(undefined);
          return;
        }
        setter(map(next));
      }).catch(() => {
        if (!latest() || (runtimeStage.current && runtimeStage.current !== stage) || !reconnect) return;
        setter((current: R | undefined) => current ? reconnect(current) : current);
      });
    };

    projection('MISSION_01', deps.loadMissionOne, m01, setMissionOne, (current) => ({ ...current, connection: 'reconnecting' as const }));
    projection('MISSION_02', deps.loadMissionTwo, m02, setMissionTwo, (current) => ({ ...current, connection: 'reconnecting' as const }));
    projection('MISSION_03', deps.loadMissionThree, m03, setMissionThree, (current) => ({ ...current, connection: 'reconnecting' as const }));
    projection('MISSION_04', deps.loadMissionFour, m04, setMissionFour, (current) => ({ ...current, connection: 'reconnecting' as const }));
    projection('MISSION_05', deps.loadMissionFive, m05, setMissionFive, (current) => ({ ...current, connection: 'reconnecting' as const }));
    projection('MISSION_06', deps.loadMissionSix, m06, setMissionSix, (current) => ({ ...current, connection: 'reconnecting' as const }));
    projection('UNKNOWN_PASSENGER', deps.loadUnknownPassenger, unknown, setUnknownPassenger);
    projection('FINAL_30', deps.loadFinal, finalModel, setFinal, (current) => ({ ...current, connection: 'reconnecting' as const }));

    try {
      const next = await deps.load(key);
      if (latest()) {
        setState(next);
        setError('');
      }
      return next;
    } catch {
      if (latest()) setError('Не удалось обновить Бункер. Повторяем подключение автоматически.');
      return null;
    }
  }, [clearNonCurrent, deps, enabled]);

  useEffect(() => {
    const activeV2 = runtime?.status === 'active' && 'contractVersion' in runtime && runtime.contractVersion === 2;
    if (!activeV2) {
      runtimeRunNonce.current = null;
      setDashboard(undefined);
      setDashboardError('');
      return;
    }
    if (runtimeRunNonce.current && runtimeRunNonce.current !== runtime.runNonce) {
      setDashboard(undefined);
      setDashboardError('');
    }
    runtimeRunNonce.current = runtime.runNonce;
  }, [runtime]);

  useEffect(() => {
    if (!enabled || !deps) return;
    void reload();
    const unsubscribe = deps.subscribeToRefresh?.(() => void reload());
    return () => {
      generation.current += 1;
      unsubscribe?.();
    };
  }, [deps, enabled, reload]);

  useEffect(() => {
    if (!enabled || !deps) return;
    const milliseconds = state?.status === 'active' || runtime?.status === 'active' ? 2000 : 5000;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void reload();
    }, milliseconds);
    return () => window.clearInterval(interval);
  }, [deps, enabled, reload, runtime?.status, state?.status]);

  useEffect(() => {
    if (!enabled || !deps) return;
    const recover = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', recover);
    window.addEventListener('focus', recover);
    window.addEventListener('online', recover);
    return () => {
      document.removeEventListener('visibilitychange', recover);
      window.removeEventListener('focus', recover);
      window.removeEventListener('online', recover);
    };
  }, [deps, enabled, reload]);

  const broadcast = useCallback(async () => {
    try { await deps?.broadcastRefresh?.(); } catch { /* polling recovers automatically */ }
  }, [deps]);

  const authoritative = useCallback(async (action: () => Promise<unknown>, copy?: string): Promise<void> => {
    if (submitting) throw new Error('Bunker command is already in progress');
    setSubmitting(true);
    setFeedback('');
    try {
      await action();
      await broadcast();
      await reload();
      if (copy) setFeedback(copy);
    } finally {
      setSubmitting(false);
    }
  }, [broadcast, reload, submitting]);

  const submitMission = useCallback(async (stage: BunkerMissionStage, answer: string) => {
    if (!deps || submitting) return;
    setSubmitting(true);
    try {
      const result = await deps.submitMission(deps.getDeviceKey(), stage, answer);
      setFeedback(result.status === 'completed' ? result.successCopy || 'Задание выполнено.' : 'Ответ не подошёл.');
      await reload();
    } catch {
      setFeedback('Ответ не отправился.');
    } finally {
      setSubmitting(false);
    }
  }, [deps, reload, submitting]);

  const submitFinalCode = useCallback(async (code: string) => {
    if (!deps || submitting) return;
    setSubmitting(true);
    try {
      const result = await deps.submitFinalCode(deps.getDeviceKey(), code);
      setFeedback(result.status === 'unlocked' ? 'Доступ получен.' : result.status === 'not_ready' ? 'Не все вагоны готовы.' : 'Код не подошёл.');
      await reload();
    } catch {
      setFeedback('Код не отправился.');
    } finally {
      setSubmitting(false);
    }
  }, [deps, reload, submitting]);

  const confirmMissionOne = useCallback((ids: string[]) => {
    if (!deps?.confirmMissionOne || !missionOne) throw new Error('M01 unavailable');
    return authoritative(() => deps.confirmMissionOne!(deps.getDeviceKey(), { commandId: commandId('m01'), instanceId: missionOne.instanceId, instanceVersion: missionOne.instanceVersion, selectedGuestIds: ids }));
  }, [authoritative, deps, missionOne]);
  const submitMissionTwo = useCallback((answers: string[]) => {
    if (!deps?.submitMissionTwo || !missionTwo) throw new Error('M02 unavailable');
    return authoritative(() => deps.submitMissionTwo!(deps.getDeviceKey(), { commandId: commandId('m02'), instanceId: missionTwo.instanceId, answers }));
  }, [authoritative, deps, missionTwo]);
  const useMissionTwoAbility = useCallback((abilityKey: 'system_access' | 'terminal_hack') => {
    if (!deps?.useMissionTwoAbility || !missionTwo) throw new Error('M02 ability unavailable');
    return authoritative(() => deps.useMissionTwoAbility!(deps.getDeviceKey(), { commandId: commandId('m02-ability'), instanceId: missionTwo.instanceId, abilityKey }));
  }, [authoritative, deps, missionTwo]);
  const confirmMissionThree = useCallback((selectedProblems: string[]) => {
    if (!deps?.confirmMissionThree || !missionThree) throw new Error('M03 unavailable');
    return authoritative(() => deps.confirmMissionThree!(deps.getDeviceKey(), { commandId: commandId('m03'), instanceId: missionThree.instanceId, instanceVersion: missionThree.instanceVersion, selectedProblems }));
  }, [authoritative, deps, missionThree]);
  const useMissionThreeAbility = useCallback((problemKey: string) => {
    if (!deps?.useMissionThreeAbility || !missionThree) throw new Error('M03 ability unavailable');
    return authoritative(() => deps.useMissionThreeAbility!(deps.getDeviceKey(), { commandId: commandId('m03-ability'), instanceId: missionThree.instanceId, problemKey }));
  }, [authoritative, deps, missionThree]);
  const sendMissionFourMessage = useCallback((message: string) => {
    if (!deps?.sendMissionFourMessage || !missionFour) throw new Error('M04 unavailable');
    return authoritative(() => deps.sendMissionFourMessage!(deps.getDeviceKey(), { commandId: commandId('m04-message'), instanceId: missionFour.instanceId, message }));
  }, [authoritative, deps, missionFour]);
  const proposeMissionFourTrade = useCallback((input: { targetWagonNumber: number; itemKey: string; quantity: number }) => {
    if (!deps?.proposeMissionFourTrade || !missionFour) throw new Error('M04 trade unavailable');
    return authoritative(() => deps.proposeMissionFourTrade!(deps.getDeviceKey(), { commandId: commandId('m04-trade'), instanceId: missionFour.instanceId, ...input }));
  }, [authoritative, deps, missionFour]);
  const respondMissionFourTrade = useCallback((transferId: string, response: 'accept' | 'reject') => {
    if (!deps?.respondMissionFourTrade || !missionFour) throw new Error('M04 response unavailable');
    return authoritative(() => deps.respondMissionFourTrade!(deps.getDeviceKey(), { commandId: commandId('m04-response'), instanceId: missionFour.instanceId, transferId, response }));
  }, [authoritative, deps, missionFour]);
  const submitMissionFourAnswer = useCallback((answer: string) => {
    if (!deps?.submitMissionFourAnswer || !missionFour) throw new Error('M04 answer unavailable');
    return authoritative(() => deps.submitMissionFourAnswer!(deps.getDeviceKey(), { commandId: commandId('m04-answer'), instanceId: missionFour.instanceId, answer }));
  }, [authoritative, deps, missionFour]);
  const castMissionFiveVote = useCallback((vote: 'A' | 'B') => {
    if (!deps?.castMissionFiveVote || !missionFive) throw new Error('M05 unavailable');
    return authoritative(() => deps.castMissionFiveVote!(deps.getDeviceKey(), { commandId: commandId('m05-vote'), instanceId: missionFive.instanceId, vote }));
  }, [authoritative, deps, missionFive]);
  const useMissionFiveAbility = useCallback(() => {
    if (!deps?.useMissionFiveAbility || !missionFive) throw new Error('M05 ability unavailable');
    return authoritative(() => deps.useMissionFiveAbility!(deps.getDeviceKey(), { commandId: commandId('m05-ability'), instanceId: missionFive.instanceId }));
  }, [authoritative, deps, missionFive]);
  const revealMissionSixFragment = useCallback(() => {
    if (!deps?.revealMissionSixFragment || !missionSix) throw new Error('M06 reveal unavailable');
    return authoritative(() => deps.revealMissionSixFragment!(deps.getDeviceKey(), { commandId: commandId('m06-fragment'), instanceId: missionSix.instanceId, fragmentKey: missionSix.privateFragment.key }));
  }, [authoritative, deps, missionSix]);
  const castMissionSixVote = useCallback((vote: 'A' | 'B' | 'C') => {
    if (!deps?.castMissionSixVote || !missionSix) throw new Error('M06 unavailable');
    return authoritative(() => deps.castMissionSixVote!(deps.getDeviceKey(), { commandId: commandId('m06-vote'), instanceId: missionSix.instanceId, vote }));
  }, [authoritative, deps, missionSix]);
  const useMissionSixAbility = useCallback(() => {
    if (!deps?.useMissionSixAbility || !missionSix) throw new Error('M06 ability unavailable');
    return authoritative(() => deps.useMissionSixAbility!(deps.getDeviceKey(), { commandId: commandId('m06-ability'), instanceId: missionSix.instanceId }));
  }, [authoritative, deps, missionSix]);
  const requestFinalAccess = useCallback((values: FinalValues) => {
    if (!deps?.requestFinalAccess || !final) throw new Error('Final unavailable');
    return authoritative(() => deps.requestFinalAccess!(deps.getDeviceKey(), { commandId: commandId('final-access'), values }), 'Версия отправлена. Терминал сохранил все подтверждённые параметры.');
  }, [authoritative, deps, final]);

  return {
    state,
    runtime,
    dashboard,
    dashboardError,
    missionOne,
    missionTwo,
    missionThree,
    missionFour,
    missionFive,
    missionSix,
    unknownPassenger,
    final,
    runtimeLoading,
    runtimeError,
    feedback,
    error,
    submitting,
    reload,
    submitMission,
    submitFinalCode,
    confirmMissionOne,
    submitMissionTwo,
    useMissionTwoAbility,
    confirmMissionThree,
    useMissionThreeAbility,
    sendMissionFourMessage,
    proposeMissionFourTrade,
    respondMissionFourTrade,
    submitMissionFourAnswer,
    castMissionFiveVote,
    useMissionFiveAbility,
    revealMissionSixFragment,
    castMissionSixVote,
    useMissionSixAbility,
    requestFinalAccess,
  };
}
