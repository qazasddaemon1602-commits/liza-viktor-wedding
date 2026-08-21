import { type ReactNode, useEffect, useRef, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import { BunkerEmergencyScene } from './BunkerEmergencyScene';
import { BunkerQuestScene, phaseForGlobalGameState } from './BunkerQuestScene';
import { createBunkerAudioController, type BunkerAudioController } from './bunkerAudio';
import { setBunkerPresentationProtected } from './bunkerProtection';
import { subscribeToBunkerRefresh, type BunkerRealtimeClient } from './bunker.realtime';
import { getBunkerScreenState, type BunkerRpcClient, type BunkerScreenState } from './bunker.service';
import { getMissionOneScreenReadModel, type MissionOneRpcClient, type MissionOneScreenReadModel as MissionOneServiceScreenReadModel } from './v2/m01.service';
import type { MissionOneScreenReadModel } from './v2/MissionOneScreen';
import { getMissionTwoScreenReadModel, type MissionTwoScreenReadModel as MissionTwoServiceScreenReadModel } from './v2/m02.service';
import type { MissionTwoScreenModel } from './v2/MissionTwoScreen';

export type BunkerScreenGuardDependencies = {
  load: () => Promise<BunkerScreenState>;
  loadMissionOne?: () => Promise<MissionOneServiceScreenReadModel>;
  loadMissionTwo?: () => Promise<MissionTwoServiceScreenReadModel>;
  subscribe?: (callback: () => void) => () => void;
  audio?: BunkerAudioController;
};
type Props = { eventSlug?: string; dependencies?: BunkerScreenGuardDependencies; children: ReactNode };

function browserDependencies(eventSlug: string): BunkerScreenGuardDependencies | null {
  try {
    const client = getSupabaseClient();
    const rpcClient = client as unknown as BunkerRpcClient & MissionOneRpcClient;
    const realtimeClient = client as unknown as BunkerRealtimeClient;
    return {
      load: () => getBunkerScreenState(rpcClient, eventSlug),
      loadMissionOne: () => getMissionOneScreenReadModel(rpcClient, eventSlug),
      loadMissionTwo: () => getMissionTwoScreenReadModel(rpcClient, eventSlug),
      subscribe: (callback) => subscribeToBunkerRefresh(realtimeClient, eventSlug, callback),
      audio: createBunkerAudioController(),
    };
  } catch { return null; }
}

type TimedM01 = { model: Extract<MissionOneServiceScreenReadModel, { status: 'active' }>; receivedAt: number };
type TimedM02 = { model: Extract<MissionTwoServiceScreenReadModel, { status: 'active' | 'completed' }>; receivedAt: number };
function remaining(deadlineAt: string, serverNow: string, receivedAt: number, nowMs: number): number {
  const initial = (Date.parse(deadlineAt) - Date.parse(serverNow)) / 1000;
  return Math.max(0, Math.ceil(initial - (nowMs - receivedAt) / 1000));
}
function missionOneScreenModel(value: TimedM01 | null, nowMs: number): MissionOneScreenReadModel | undefined {
  if (!value) return undefined;
  return { title: value.model.title, publicSummary: value.model.publicSummary, remainingSeconds: remaining(value.model.deadlineAt, value.model.serverNow, value.receivedAt, nowMs), wagons: value.model.wagons };
}
function missionTwoScreenModel(value: TimedM02 | null, nowMs: number): MissionTwoScreenModel | undefined {
  if (!value) return undefined;
  return { title: value.model.title, subtitle: value.model.subtitle, remainingSeconds: remaining(value.model.deadlineAt, value.model.serverNow, value.receivedAt, nowMs), wagons: value.model.wagons };
}
function remainingFromState(state: Extract<BunkerScreenState, { status: 'active' }>, nowMs: number, serverOffsetMs: number): number {
  const startedMs = Date.parse(state.startedAt); if (!Number.isFinite(startedMs)) return state.remainingSeconds;
  return Math.max(0, Math.ceil(state.durationSeconds - (nowMs + serverOffsetMs - startedMs) / 1000));
}

export function BunkerScreenGuard({ eventSlug='liza-viktor', dependencies, children }: Props) {
  const [browserDeps,setBrowserDeps]=useState<BunkerScreenGuardDependencies|null>(null); const deps=dependencies??browserDeps;
  const [state,setState]=useState<BunkerScreenState|null>(null); const [missionOne,setMissionOne]=useState<TimedM01|null>(null); const [missionTwo,setMissionTwo]=useState<TimedM02|null>(null); const [contractVersion,setContractVersion]=useState<1|2|null>(null);
  const [nowMs,setNowMs]=useState(()=>Date.now()); const [motionPreference,setMotionPreference]=useState<'full'|'reduced'>(()=>typeof window!=='undefined'&&typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches?'reduced':'full');
  const serverOffsetRef=useRef(0); const latestServerMsRef=useRef(Number.NEGATIVE_INFINITY); const previousUnlockRef=useRef<boolean|null>(null);
  const applyServerState=(next:BunkerScreenState)=>{const receivedAt=Date.now(),serverMs=Date.parse(next.serverNow);if(Number.isFinite(serverMs)&&serverMs<latestServerMsRef.current)return false;if(Number.isFinite(serverMs))latestServerMsRef.current=serverMs;serverOffsetRef.current=Number.isFinite(serverMs)?serverMs-receivedAt:0;setState(next);setNowMs(receivedAt);return true;};
  useEffect(()=>{if(dependencies){setBrowserDeps(null);return;}const next=browserDependencies(eventSlug);setBrowserDeps(next);return()=>next?.audio?.dispose();},[dependencies,eventSlug]);
  useEffect(()=>{if(typeof window.matchMedia!=='function')return;const query=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setMotionPreference(query.matches?'reduced':'full');update();query.addEventListener?.('change',update);return()=>query.removeEventListener?.('change',update);},[]);
  const applyM01=(next:MissionOneServiceScreenReadModel|null)=>{if(!next)return;setContractVersion(next.contractVersion);setMissionOne(next.status==='active'?{model:next,receivedAt:Date.now()}:null);};
  const applyM02=(next:MissionTwoServiceScreenReadModel|null)=>{if(!next)return;setContractVersion(next.contractVersion);setMissionTwo(next.status==='active'||next.status==='completed'?{model:next,receivedAt:Date.now()}:null);};
  const refresh=()=>{if(!deps)return;void deps.load().then((next)=>{applyServerState(next);}).catch(()=>{});void Promise.resolve(deps.loadMissionOne?.()??null).then(applyM01).catch(()=>{});void Promise.resolve(deps.loadMissionTwo?.()??null).then(applyM02).catch(()=>{});}; const refreshRef=useRef(refresh);refreshRef.current=refresh;
  useEffect(()=>{if(!deps)return;const reload=()=>refreshRef.current();reload();const unsubscribe=deps.subscribe?.(reload);window.addEventListener('focus',reload);window.addEventListener('online',reload);return()=>{unsubscribe?.();window.removeEventListener('focus',reload);window.removeEventListener('online',reload);};},[deps]);
  const remainingSeconds=state?.status==='active'?remainingFromState(state,nowMs,serverOffsetRef.current):0; const bunkerActive=state?.status==='active'; const activePhase=state?.status==='active'?phaseForGlobalGameState(state.globalGameState,state.phase??'emergency'):null; const emergencyPhase=bunkerActive&&activePhase==='emergency';
  useEffect(()=>{setBunkerPresentationProtected(bunkerActive);return()=>setBunkerPresentationProtected(false);},[bunkerActive]);
  useEffect(()=>{if(!bunkerActive||remainingSeconds<=0)return;const interval=window.setInterval(()=>setNowMs(Date.now()),250);return()=>window.clearInterval(interval);},[bunkerActive,remainingSeconds<=0]);
  useEffect(()=>{if(!deps)return;const interval=window.setInterval(()=>refreshRef.current(),bunkerActive?2000:1500);return()=>window.clearInterval(interval);},[deps,bunkerActive]);
  useEffect(()=>{const audio=deps?.audio;if(!audio)return;if(!emergencyPhase||remainingSeconds<=0||state?.status!=='active'||!state.soundEnabled){audio.stopAlarm();return;}audio.startAlarm();void audio.arm();return()=>audio.stopAlarm();},[deps,emergencyPhase,remainingSeconds<=0,state?.status==='active'?state.soundEnabled:false]);
  useEffect(()=>{const audio=deps?.audio;if(!audio)return;if(!bunkerActive||state?.status!=='active'||!state.soundEnabled){audio.stopAmbience();return;}audio.startAmbience();void audio.arm();return()=>audio.stopAmbience();},[deps,bunkerActive,state?.status==='active'?state.soundEnabled:false]);
  useEffect(()=>{const audio=deps?.audio;if(!bunkerActive||state?.status!=='active'){previousUnlockRef.current=null;return;}const finalPhase=activePhase==='final'||activePhase==='completed',was=previousUnlockRef.current;if(finalPhase&&state.soundEnabled&&was===false&&state.unlocked){audio?.playDoorUnlock();void audio?.arm();}previousUnlockRef.current=state.unlocked;},[deps,bunkerActive,activePhase,state?.status==='active'?state.unlocked:false,state?.status==='active'?state.soundEnabled:false]);
  return <>{children}{bunkerActive&&state?.status==='active'&&activePhase==='emergency'&&<BunkerEmergencyScene remainingSeconds={remainingSeconds} motionPreference={motionPreference}/>} {bunkerActive&&state?.status==='active'&&activePhase!=='emergency'&&<BunkerQuestScene key={state.globalGameState??activePhase} state={state} remainingSeconds={remainingSeconds} motionPreference={motionPreference} missionOne={missionOneScreenModel(missionOne,nowMs)} missionTwo={missionTwoScreenModel(missionTwo,nowMs)} bunkerContractVersion={contractVersion??undefined}/>}</>;
}
