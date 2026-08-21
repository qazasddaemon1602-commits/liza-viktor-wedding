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
import type { MissionThreePlayerReadModel } from './v2/MissionThreePlayer';
import { commitMissionThreeAbility as commitMissionThreeAbilityCommand, confirmMissionThree as confirmMissionThreeCommand, getGuestMissionThreeReadModel, type MissionThreeGuestReadModel } from './v2/m03.service';
import type { MissionFourPlayerReadModel } from './v2/MissionFourPlayer';
import { getGuestMissionFourReadModel, proposeMissionFourTrade as proposeMissionFourTradeCommand, respondMissionFourTrade as respondMissionFourTradeCommand, sendMissionFourMessage as sendMissionFourMessageCommand, submitMissionFourAnswer as submitMissionFourAnswerCommand, type MissionFourGuestReadModel } from './v2/m04.service';
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
  loadMissionThree?: (deviceKey: string) => Promise<MissionThreeGuestReadModel>;
  confirmMissionThree?: (deviceKey: string, input: { commandId: string; instanceId: string; instanceVersion: number; selectedProblems: string[] }) => Promise<unknown>;
  useMissionThreeAbility?: (deviceKey: string, input: { commandId: string; instanceId: string; problemKey: string }) => Promise<unknown>;
  loadMissionFour?: (deviceKey: string) => Promise<MissionFourGuestReadModel>;
  sendMissionFourMessage?: (deviceKey: string, input: { commandId: string; instanceId: string; message: string }) => Promise<unknown>;
  proposeMissionFourTrade?: (deviceKey: string, input: { commandId: string; instanceId: string; targetWagonNumber: number; itemKey: string; quantity: number }) => Promise<unknown>;
  respondMissionFourTrade?: (deviceKey: string, input: { commandId: string; instanceId: string; transferId: string; response: 'accept' | 'reject' }) => Promise<unknown>;
  submitMissionFourAnswer?: (deviceKey: string, input: { commandId: string; instanceId: string; answer: string }) => Promise<unknown>;
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
    loadMissionThree: (key) => getGuestMissionThreeReadModel(rpcClient, eventSlug, key),
    confirmMissionThree: (key, input) => confirmMissionThreeCommand(rpcClient, { eventSlug, deviceKey: key, ...input }),
    useMissionThreeAbility: (key, input) => commitMissionThreeAbilityCommand(rpcClient, { eventSlug, deviceKey: key, ...input }),
    loadMissionFour: (key) => getGuestMissionFourReadModel(rpcClient, eventSlug, key),
    sendMissionFourMessage: (key, input) => sendMissionFourMessageCommand(rpcClient, { eventSlug, deviceKey: key, ...input }),
    proposeMissionFourTrade: (key, input) => proposeMissionFourTradeCommand(rpcClient, { eventSlug, deviceKey: key, ...input }),
    respondMissionFourTrade: (key, input) => respondMissionFourTradeCommand(rpcClient, { eventSlug, deviceKey: key, ...input }),
    submitMissionFourAnswer: (key, input) => submitMissionFourAnswerCommand(rpcClient, { eventSlug, deviceKey: key, ...input }),
    submitMission: (key, stage, answer) => submitBunkerMission(rpcClient, eventSlug, key, stage, answer),
    submitFinalCode: (key, code) => submitBunkerFinalCode(rpcClient, eventSlug, key, code),
    broadcastRefresh: () => broadcastBunkerRefresh(realtimeClient, eventSlug),
    subscribeToRefresh: (callback) => subscribeToBunkerRefresh(realtimeClient, eventSlug, callback),
  };
}

function remaining(deadlineAt: string, serverNow: string): number { return Math.max(0, Math.ceil((Date.parse(deadlineAt) - Date.parse(serverNow)) / 1000)); }
function missionOnePlayerModel(model: MissionOneGuestReadModel, connection: MissionOnePlayerReadModel['connection'] = 'online'): MissionOnePlayerReadModel | undefined {
  if (model.status !== 'active' && model.status !== 'completed') return undefined;
  return { instanceId:model.instanceId,instanceVersion:model.instanceVersion,status:model.status,wagon:model.wagon,quota:model.quota,remainingSeconds:remaining(model.deadlineAt,model.serverNow),connection,members:model.members,selectedGuestIds:model.selectedGuestIds };
}
function missionTwoPlayerModel(model: MissionTwoGuestReadModel, connection: MissionTwoPlayerReadModel['connection'] = 'online'): MissionTwoPlayerReadModel | undefined {
  if (model.status !== 'active' && model.status !== 'completed') return undefined;
  return { instanceId:model.instanceId,instanceVersion:model.instanceVersion,status:model.status,remainingSeconds:remaining(model.deadlineAt,model.serverNow),title:model.title,subtitle:model.subtitle,intro:model.intro,evidence:model.evidence,questions:model.questions,attemptCount:model.attemptCount,attemptsRemaining:model.attemptsRemaining,selectedAnswers:model.selectedAnswers,connection,ability:model.ability,outcome:model.outcome,archiveUnlocked:model.archiveUnlocked };
}
function missionThreePlayerModel(model: MissionThreeGuestReadModel, connection: MissionThreePlayerReadModel['connection'] = 'online'): MissionThreePlayerReadModel | undefined {
  if (model.status !== 'active' && model.status !== 'completed') return undefined;
  return { instanceId:model.instanceId,instanceVersion:model.instanceVersion,status:model.status,remainingSeconds:remaining(model.deadlineAt,model.serverNow),title:model.title,intro:model.intro,memberRole:model.memberRole,problems:model.problems,inventory:model.inventory,selectedProblems:model.selectedProblems,ability:model.ability,pendingCommitments:model.pendingCommitments,connection,outcome:model.outcome };
}
function missionFourPlayerModel(model: MissionFourGuestReadModel, connection: MissionFourPlayerReadModel['connection'] = 'online'): MissionFourPlayerReadModel | undefined {
  if (model.status !== 'active' && model.status !== 'completed') return undefined;
  return { instanceId:model.instanceId,status:model.status,remainingSeconds:remaining(model.deadlineAt,model.serverNow),title:model.title,interactionPhase:model.interactionPhase,group:model.group,viewer:model.viewer,messageQuota:model.messageQuota,messagesRemaining:model.messagesRemaining,messages:model.messages,inventory:model.inventory,trades:model.trades,answer:model.answer,ability:model.ability,connection };
}
function commandId(prefix='bunker-v2'){return globalThis.crypto?.randomUUID?.()??`${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;}

export function useGuestBunkerLiveState({ eventSlug='liza-viktor', dependencies, enabled=true }: UseGuestBunkerLiveStateOptions = {}) {
  const deps=useMemo<GuestBunkerLiveDependencies|null>(()=>dependencies??(enabled?browserDependencies(eventSlug):null),[dependencies,enabled,eventSlug]);
  const[state,setState]=useState<GuestBunkerQuestState|null>(null); const[runtime,setRuntime]=useState<GuestBunkerReadRuntime|null>(null);
  const[missionOne,setMissionOne]=useState<MissionOnePlayerReadModel|undefined>(); const[missionTwo,setMissionTwo]=useState<MissionTwoPlayerReadModel|undefined>(); const[missionThree,setMissionThree]=useState<MissionThreePlayerReadModel|undefined>(); const[missionFour,setMissionFour]=useState<MissionFourPlayerReadModel|undefined>();
  const[runtimeLoading,setRuntimeLoading]=useState(Boolean(enabled&&deps?.loadRuntime)); const[runtimeError,setRuntimeError]=useState(''); const[feedback,setFeedback]=useState(''); const[error,setError]=useState(''); const[submitting,setSubmitting]=useState(false); const reloadGeneration=useRef(0);

  const reload=useCallback(async()=>{
    if(!enabled||!deps)return null; const generation=++reloadGeneration.current; const latest=()=>generation===reloadGeneration.current; const deviceKey=deps.getDeviceKey(); if(deps.loadRuntime)setRuntimeLoading(true);
    if(deps.loadRuntime)void Promise.resolve().then(()=>deps.loadRuntime!(deviceKey)).then(next=>{if(latest()){setRuntime(next);setRuntimeError('');}}).catch(()=>{if(latest())setRuntimeError('Не удалось обновить защищённый архив. Показываем последние полученные данные.');}).finally(()=>{if(latest())setRuntimeLoading(false);});
    const project=<T,>(loader:(key:string)=>Promise<T>,apply:(next:T)=>void,reconnect:()=>void)=>{void Promise.resolve().then(()=>loader(deviceKey)).then(next=>{if(latest())apply(next);}).catch(()=>{if(latest())reconnect();});};
    if(deps.loadMissionOne)project(deps.loadMissionOne,next=>setMissionOne(missionOnePlayerModel(next)),()=>setMissionOne(current=>current?{...current,connection:'reconnecting'}:current));
    if(deps.loadMissionTwo)project(deps.loadMissionTwo,next=>setMissionTwo(missionTwoPlayerModel(next)),()=>setMissionTwo(current=>current?{...current,connection:'reconnecting'}:current));
    if(deps.loadMissionThree)project(deps.loadMissionThree,next=>setMissionThree(missionThreePlayerModel(next)),()=>setMissionThree(current=>current?{...current,connection:'reconnecting'}:current));
    if(deps.loadMissionFour)project(deps.loadMissionFour,next=>setMissionFour(missionFourPlayerModel(next)),()=>setMissionFour(current=>current?{...current,connection:'reconnecting'}:current));
    try{const next=await deps.load(deviceKey);if(latest()){setState(next);setError('');}return next;}catch{if(latest())setError('Не удалось обновить Бункер. Повторяем подключение автоматически.');return null;}
  },[deps,enabled]);

  useEffect(()=>{if(!enabled||!deps)return;void reload();const unsubscribe=deps.subscribeToRefresh?.(()=>{void reload();});return()=>{reloadGeneration.current+=1;unsubscribe?.();};},[deps,enabled,reload]);
  useEffect(()=>{if(!enabled||!deps)return;const intervalMs=state?.status==='active'||runtime?.status==='active'?2000:5000;const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void reload();},intervalMs);return()=>window.clearInterval(timer);},[deps,enabled,reload,runtime?.status,state?.status]);
  useEffect(()=>{if(!enabled||!deps)return;const refresh=()=>{if(document.visibilityState==='visible')void reload();};document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);return()=>{document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);};},[deps,enabled,reload]);
  const broadcastCompletion=useCallback(async()=>{try{await deps?.broadcastRefresh?.();}catch{/* polling fallback */}},[deps]);
  const authoritative=useCallback(async(action:()=>Promise<unknown>,successCopy?:string)=>{if(submitting)throw new Error('Bunker command is already in progress');setSubmitting(true);setFeedback('');try{await action();await broadcastCompletion();await reload();if(successCopy)setFeedback(successCopy);}finally{setSubmitting(false);}},[broadcastCompletion,reload,submitting]);

  const submitMission=useCallback(async(stage:BunkerMissionStage,answer:string)=>{if(!deps||submitting)return;setSubmitting(true);setFeedback('');try{const result=await deps.submitMission(deps.getDeviceKey(),stage,answer);setFeedback(result.status==='completed'?result.successCopy||'Задание выполнено. Вагон синхронизирован.':'Ответ не подошёл. Попробуйте ещё раз вместе с вагоном.');await reload();}catch{setFeedback('Ответ не отправился. Попробуйте ещё раз.');}finally{setSubmitting(false);}},[deps,reload,submitting]);
  const submitFinalCode=useCallback(async(code:string)=>{if(!deps||submitting)return;setSubmitting(true);setFeedback('');try{const result=await deps.submitFinalCode(deps.getDeviceKey(),code);setFeedback(result.status==='unlocked'?'Доступ получен.':result.status==='not_ready'?'Не все вагоны получили свои фрагменты.':'Код не подошёл. Сверьте порядок вагонов и попробуйте снова.');await reload();}catch{setFeedback('Код не отправился. Попробуйте ещё раз.');}finally{setSubmitting(false);}},[deps,reload,submitting]);
  const confirmMissionOne=useCallback(async(selectedGuestIds:string[])=>{if(!deps?.confirmMissionOne||!missionOne)throw new Error('M01 confirmation is unavailable');const key=deps.getDeviceKey();try{await deps.confirmMissionOne(key,{commandId:commandId('m01'),instanceId:missionOne.instanceId,instanceVersion:missionOne.instanceVersion,selectedGuestIds});await broadcastCompletion();await reload();}catch(failure){if(deps.loadMissionOne){try{const next=missionOnePlayerModel(await deps.loadMissionOne(key));setMissionOne(next);if(next?.status==='completed'&&next.instanceId===missionOne.instanceId){await broadcastCompletion();return;}}catch{setMissionOne(current=>current?{...current,connection:'reconnecting'}:current);}}throw failure;}},[broadcastCompletion,deps,missionOne,reload]);
  const submitMissionTwo=useCallback((answers:string[])=>{if(!deps?.submitMissionTwo||!missionTwo)throw new Error('M02 submission is unavailable');const key=deps.getDeviceKey();return authoritative(()=>deps.submitMissionTwo!(key,{commandId:commandId('m02-answer'),instanceId:missionTwo.instanceId,answers}),'Версия отправлена. Система сверяет данные чёрного ящика.');},[authoritative,deps,missionTwo]);
  const useMissionTwoAbility=useCallback((abilityKey:'system_access'|'terminal_hack')=>{if(!deps?.useMissionTwoAbility||!missionTwo)throw new Error('M02 ability is unavailable');const key=deps.getDeviceKey();return authoritative(()=>deps.useMissionTwoAbility!(key,{commandId:commandId('m02-ability'),instanceId:missionTwo.instanceId,abilityKey}));},[authoritative,deps,missionTwo]);
  const confirmMissionThree=useCallback((selectedProblems:string[])=>{if(!deps?.confirmMissionThree||!missionThree)throw new Error('M03 confirmation is unavailable');const key=deps.getDeviceKey();return authoritative(()=>deps.confirmMissionThree!(key,{commandId:commandId('m03-confirm'),instanceId:missionThree.instanceId,instanceVersion:missionThree.instanceVersion,selectedProblems}),'Распределение запаса сохранено.');},[authoritative,deps,missionThree]);
  const useMissionThreeAbility=useCallback((problemKey:string)=>{if(!deps?.useMissionThreeAbility||!missionThree)throw new Error('M03 ability is unavailable');const key=deps.getDeviceKey();return authoritative(()=>deps.useMissionThreeAbility!(key,{commandId:commandId('m03-ability'),instanceId:missionThree.instanceId,problemKey}),'Способность предложена капитану. Она потратится только если проблему выберут.');},[authoritative,deps,missionThree]);
  const sendMissionFourMessage=useCallback((message:string)=>{if(!deps?.sendMissionFourMessage||!missionFour)throw new Error('M04 message is unavailable');const key=deps.getDeviceKey();return authoritative(()=>deps.sendMissionFourMessage!(key,{commandId:commandId('m04-message'),instanceId:missionFour.instanceId,message}));},[authoritative,deps,missionFour]);
  const proposeMissionFourTrade=useCallback((input:{targetWagonNumber:number;itemKey:string;quantity:number})=>{if(!deps?.proposeMissionFourTrade||!missionFour)throw new Error('M04 trade is unavailable');const key=deps.getDeviceKey();return authoritative(()=>deps.proposeMissionFourTrade!(key,{commandId:commandId('m04-trade'),instanceId:missionFour.instanceId,...input}));},[authoritative,deps,missionFour]);
  const respondMissionFourTrade=useCallback((transferId:string,response:'accept'|'reject')=>{if(!deps?.respondMissionFourTrade||!missionFour)throw new Error('M04 trade response is unavailable');const key=deps.getDeviceKey();return authoritative(()=>deps.respondMissionFourTrade!(key,{commandId:commandId('m04-trade-response'),instanceId:missionFour.instanceId,transferId,response}));},[authoritative,deps,missionFour]);
  const submitMissionFourAnswer=useCallback((answer:string)=>{if(!deps?.submitMissionFourAnswer||!missionFour)throw new Error('M04 answer is unavailable');const key=deps.getDeviceKey();return authoritative(()=>deps.submitMissionFourAnswer!(key,{commandId:commandId('m04-answer'),instanceId:missionFour.instanceId,answer}));},[authoritative,deps,missionFour]);

  return {state,runtime,missionOne,missionTwo,missionThree,missionFour,runtimeLoading,runtimeError,feedback,error,submitting,reload,submitMission,submitFinalCode,confirmMissionOne,submitMissionTwo,useMissionTwoAbility,confirmMissionThree,useMissionThreeAbility,sendMissionFourMessage,proposeMissionFourTrade,respondMissionFourTrade,submitMissionFourAnswer};
}
