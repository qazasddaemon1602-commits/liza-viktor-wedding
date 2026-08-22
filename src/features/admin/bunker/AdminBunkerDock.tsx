import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { getSupabaseClient } from '../../../lib/supabase';
import { applyCarriageDistribution,loadOwnerDashboard,type AdminDashboard,type AdminRpcClient } from '../admin.service';
import type { SupportedCarriageCount } from '../../carriages/carriageAllocator';
import { AdminBunkerControl,type AdminBunkerControlDependencies } from './AdminBunkerControl';
import { AdminBunkerTestDock,type AdminBunkerTestDockDependencies } from './AdminBunkerTestDock';
import type { MissionOneOwnerReadModel as M1Panel } from './MissionOneOwnerPanel';
import { MissionTwoOwnerPanel,type MissionTwoOwnerPanelModel } from './MissionTwoOwnerPanel';
import { MissionThreeOwnerPanel } from './MissionThreeOwnerPanel';
import { MissionFourOwnerPanel } from './MissionFourOwnerPanel';
import { MissionFiveOwnerPanel } from './MissionFiveOwnerPanel';
import { MissionSixOwnerPanel } from './MissionSixOwnerPanel';
import { UnknownPassengerOwnerPanel } from './UnknownPassengerOwnerPanel';
import { FinalOwnerPanel } from './FinalOwnerPanel';
import { resolveBunkerContractVersion } from './bunkerContractVersion';
import { getOwnerMissionOneReadModel,overrideMissionOneSelection,type MissionOneOwnerReadModel,type MissionOneRpcClient,type OverrideMissionOneSelectionInput } from '../../bunker/v2/m01.service';
import { getOwnerMissionTwoReadModel,type MissionTwoOwnerReadModel } from '../../bunker/v2/m02.service';
import { getOwnerMissionThreeReadModel,type MissionThreeOwnerReadModel } from '../../bunker/v2/m03.service';
import { getOwnerMissionFourReadModel,type MissionFourOwnerReadModel } from '../../bunker/v2/m04.service';
import { getOwnerMissionFiveReadModel,type MissionFiveOwnerReadModel } from '../../bunker/v2/m05.service';
import { getOwnerMissionSixReadModel,type MissionSixOwnerReadModel } from '../../bunker/v2/m06.service';
import { getOwnerUnknownPassengerReadModel,type UnknownPassengerOwnerReadModel } from '../../bunker/v2/unknownPassenger.service';
import { addFinalTime,emergencyOpenFinal,getOwnerFinalReadModel,giveFinalHint,type FinalOwnerReadModel } from '../../bunker/v2/final.service';
import type { MissionThreeScreenModel } from '../../bunker/v2/MissionThreeScreen';
import type { MissionFourScreenModel } from '../../bunker/v2/MissionFourScreen';
import type { MissionFiveScreenModel } from '../../bunker/v2/MissionFiveScreen';
import type { MissionSixScreenModel } from '../../bunker/v2/MissionSixScreen';
import type { UnknownPassengerScreenModel } from '../../bunker/v2/UnknownPassengerScreen';
import type { FinalScreenModel } from '../../bunker/v2/FinalScreen';
import { broadcastBunkerRefresh,subscribeToBunkerRefresh,type BunkerRealtimeClient } from '../../bunker/bunker.realtime';
import { isOwnerSessionExpired } from '../ownerSession';

const EVENT_SLUG='liza-viktor';
export type AdminBunkerDockDependencies={loadDashboard:()=>Promise<AdminDashboard>;applyDistribution:(eventId:string,count:SupportedCarriageCount)=>Promise<unknown>;bunkerControl?:AdminBunkerControlDependencies;testMode?:AdminBunkerTestDockDependencies;loadMissionOne?:(eventId:string)=>Promise<MissionOneOwnerReadModel>;overrideMissionOne?:(input:OverrideMissionOneSelectionInput)=>Promise<unknown>;loadMissionTwo?:(eventId:string)=>Promise<MissionTwoOwnerReadModel>;loadMissionThree?:(eventId:string)=>Promise<MissionThreeOwnerReadModel>;loadMissionFour?:(eventId:string)=>Promise<MissionFourOwnerReadModel>;loadMissionFive?:(eventId:string)=>Promise<MissionFiveOwnerReadModel>;loadMissionSix?:(eventId:string)=>Promise<MissionSixOwnerReadModel>;loadUnknownPassenger?:(eventId:string)=>Promise<UnknownPassengerOwnerReadModel>;loadFinal?:(eventId:string)=>Promise<FinalOwnerReadModel>;addFinalTime?:(eventId:string)=>Promise<unknown>;giveFinalHint?:(eventId:string)=>Promise<unknown>;emergencyOpenFinal?:(eventId:string)=>Promise<unknown>;broadcastRefresh?:()=>Promise<void>;subscribeRefresh?:(callback:()=>void)=>()=>void};
type Props={dependencies?:AdminBunkerDockDependencies;pollIntervalMs?:number};
function secs(deadline:string,serverNow:string){return Math.max(0,Math.ceil((Date.parse(deadline)-Date.parse(serverNow))/1000));}
function p1(m:MissionOneOwnerReadModel|null):M1Panel|undefined{return m&&m.contractVersion===2&&m.status==='active'?{status:m.wagons.every(w=>w.status==='completed')?'completed':'active',remainingSeconds:secs(m.deadlineAt,m.serverNow),wagons:m.wagons}:undefined;}
function p2(m:MissionTwoOwnerReadModel|null):MissionTwoOwnerPanelModel|undefined{return m&&m.contractVersion===2&&m.status==='active'?{status:'active',title:m.title,remainingSeconds:secs(m.deadlineAt,m.serverNow),wagons:m.wagons}:undefined;}
function p3(m:MissionThreeOwnerReadModel|null):MissionThreeScreenModel|undefined{return m&&m.contractVersion===2&&m.status==='active'?{title:m.title,remainingSeconds:secs(m.deadlineAt,m.serverNow),wagons:m.wagons}:undefined;}
function p4(m:MissionFourOwnerReadModel|null):MissionFourScreenModel|undefined{return m&&m.contractVersion===2&&m.status==='active'?{title:m.title,remainingSeconds:secs(m.deadlineAt,m.serverNow),groups:m.groups}:undefined;}
function p5(m:MissionFiveOwnerReadModel|null):MissionFiveScreenModel|undefined{return m&&m.contractVersion===2&&m.status==='active'?{title:m.title,remainingSeconds:secs(m.deadlineAt,m.serverNow),wagons:m.wagons}:undefined;}
function p6(m:MissionSixOwnerReadModel|null):MissionSixScreenModel|undefined{return m&&m.contractVersion===2&&m.status==='active'?{title:m.title,remainingSeconds:secs(m.deadlineAt,m.serverNow),fragmentsRevealed:m.fragmentsRevealed,fragmentsTotal:m.fragmentsTotal,wagons:m.wagons}:undefined;}
function ps(m:UnknownPassengerOwnerReadModel|null):UnknownPassengerScreenModel|undefined{return m&&m.contractVersion===2&&m.status==='active'?{title:m.title,dossierId:m.dossierId,sector:m.sector,remainingSeconds:secs(m.deadlineAt,m.serverNow)}:undefined;}
function pf(m:FinalOwnerReadModel|null):FinalScreenModel|undefined{return m&&m.contractVersion===2&&(m.status==='active'||m.status==='completed')?{remainingSeconds:secs(m.deadlineAt,m.serverNow),solved:m.solved,total:m.total,wrongAttempts:m.wrongAttempts,unlocked:m.unlocked,hintLevel:m.hintLevel,timeAdjustmentSeconds:m.timeAdjustmentSeconds}:undefined;}
function cid(){return globalThis.crypto?.randomUUID?.()??`owner-${Date.now()}`;}
function browserDependencies():AdminBunkerDockDependencies|null{try{const c=getSupabaseClient()as unknown as AdminRpcClient&MissionOneRpcClient&BunkerRealtimeClient;return{loadDashboard:()=>loadOwnerDashboard(c,EVENT_SLUG),applyDistribution:(id,n)=>applyCarriageDistribution(c,id,n),loadMissionOne:(id)=>getOwnerMissionOneReadModel(c,id),overrideMissionOne:(input)=>overrideMissionOneSelection(c,input),loadMissionTwo:(id)=>getOwnerMissionTwoReadModel(c,id),loadMissionThree:(id)=>getOwnerMissionThreeReadModel(c,id),loadMissionFour:(id)=>getOwnerMissionFourReadModel(c,id),loadMissionFive:(id)=>getOwnerMissionFiveReadModel(c,id),loadMissionSix:(id)=>getOwnerMissionSixReadModel(c,id),loadUnknownPassenger:(id)=>getOwnerUnknownPassengerReadModel(c,id),loadFinal:(id)=>getOwnerFinalReadModel(c,id),addFinalTime:(id)=>addFinalTime(c,id,120),giveFinalHint:(id)=>giveFinalHint(c,id),emergencyOpenFinal:(id)=>emergencyOpenFinal(c,id),broadcastRefresh:()=>broadcastBunkerRefresh(c,EVENT_SLUG),subscribeRefresh:(cb)=>subscribeToBunkerRefresh(c,EVENT_SLUG,cb)};}catch{return null;}}

export function AdminBunkerDock({dependencies,pollIntervalMs=15000}:Props={}){
 const deps=useMemo(()=>dependencies??browserDependencies(),[dependencies]);
 const[dashboard,setDashboard]=useState<AdminDashboard|null>(null),[m1,setM1]=useState<MissionOneOwnerReadModel|null>(null),[m2,setM2]=useState<MissionTwoOwnerReadModel|null>(null),[m3,setM3]=useState<MissionThreeOwnerReadModel|null>(null),[m4,setM4]=useState<MissionFourOwnerReadModel|null>(null),[m5,setM5]=useState<MissionFiveOwnerReadModel|null>(null),[m6,setM6]=useState<MissionSixOwnerReadModel|null>(null),[story,setStory]=useState<UnknownPassengerOwnerReadModel|null>(null),[final,setFinal]=useState<FinalOwnerReadModel|null>(null),[last,setLast]=useState<string|null>(null),[availability,setAvailability]=useState<'loading'|'current'|'stale'|'unavailable'>(deps?'loading':'unavailable');
 const ref=useRef<AdminDashboard|null>(null),mounted=useRef(false),active=useRef<number|null>(null),command=useRef(false),latest=useRef(0);
 const store=useCallback((d:AdminDashboard)=>{ref.current=d;setDashboard(d);setLast(new Date().toISOString());setAvailability('current');},[]);
 const fail=useCallback(()=>{ref.current=null;setDashboard(null);setLast(null);setAvailability('unavailable');setM1(null);setM2(null);setM3(null);setM4(null);setM5(null);setM6(null);setStory(null);setFinal(null);},[]);
 const handle=useCallback((e:unknown)=>{if(isOwnerSessionExpired(e)||!ref.current)fail();else setAvailability('stale');},[fail]);
 const reads=useCallback((d:AdminDashboard,id?:number)=>{const ok=()=>mounted.current&&(id===undefined||id===latest.current),load=<T,>(fn:((eventId:string)=>Promise<T>)|undefined,set:(value:T)=>void)=>{if(fn)void fn(d.event.id).then(v=>{if(ok())set(v);}).catch(()=>{});};load(deps?.loadMissionOne,setM1);load(deps?.loadMissionTwo,setM2);load(deps?.loadMissionThree,setM3);load(deps?.loadMissionFour,setM4);load(deps?.loadMissionFive,setM5);load(deps?.loadMissionSix,setM6);load(deps?.loadUnknownPassenger,setStory);load(deps?.loadFinal,setFinal);},[deps]);
 const poll=useCallback(async()=>{if(!deps||command.current)return;if(active.current!==null&&active.current===latest.current)return;const id=++latest.current;active.current=id;try{const d=await deps.loadDashboard();if(mounted.current&&id===latest.current)store(d);reads(d,id);}catch(e){if(mounted.current&&id===latest.current)handle(e);}finally{if(active.current===id)active.current=null;}},[deps,handle,reads,store]);
 const refresh=useCallback(()=>{if(ref.current)reads(ref.current);else void poll();},[poll,reads]);
 useEffect(()=>{if(!deps)return;mounted.current=true;void poll();const i=window.setInterval(()=>void poll(),pollIntervalMs),r=()=>void poll(),u=deps.subscribeRefresh?.(refresh);window.addEventListener('focus',r);window.addEventListener('online',r);return()=>{mounted.current=false;latest.current+=1;window.clearInterval(i);window.removeEventListener('focus',r);window.removeEventListener('online',r);u?.();};},[deps,poll,pollIntervalMs,refresh]);
 const accept=async(n:SupportedCarriageCount)=>{if(!deps||command.current||!ref.current)return;command.current=true;try{await deps.applyDistribution(ref.current.event.id,n);const id=++latest.current,d=await deps.loadDashboard();if(mounted.current&&id===latest.current)store(d);reads(d,id);}finally{command.current=false;}};
 const override=async(input:{wagonId:string;selectedGuestIds:string[];reason:string})=>{if(!deps?.overrideMissionOne||!ref.current)return;const w=m1?.contractVersion===2&&m1.status==='active'?m1.wagons.find(x=>x.wagonId===input.wagonId):undefined;if(!w)throw new Error('M01 wagon snapshot unavailable');await deps.overrideMissionOne({eventId:ref.current.event.id,instanceId:w.instanceId,instanceVersion:w.instanceVersion,commandId:cid(),selectedGuestIds:input.selectedGuestIds,reason:input.reason});try{await deps.broadcastRefresh?.();}catch{}refresh();};
 const finalAction=async(action:((eventId:string)=>Promise<unknown>)|undefined)=>{if(!action||!ref.current||command.current)return;command.current=true;try{await action(ref.current.event.id);try{await deps?.broadcastRefresh?.();}catch{}refresh();}finally{command.current=false;}};
 if(!deps||availability==='unavailable')return <aside id="admin-bunker" className="admin-bunker-dock"><strong>ДАННЫЕ ВЕДУЩЕГО НЕДОСТУПНЫ</strong><p>Пульт скрыт. Проверьте вход организатора и интернет.</p></aside>;
 if(!dashboard||availability==='loading')return <aside id="admin-bunker" className="admin-bunker-dock"><span>ПРОВЕРЯЕМ ДОСТУП ВЕДУЩЕГО…</span></aside>;
 const two=p2(m2),three=p3(m3),four=p4(m4),five=p5(m5),six=p6(m6),storyPanel=ps(story),finalPanel=pf(final),contract=resolveBunkerContractVersion([m1,m2,m3,m4,m5,m6,story,final]);
 return <aside id="admin-bunker" className="admin-bunker-dock">
   {last&&<div className="admin-bunker-dock__freshness"><span>{availability==='stale'?'СВЯЗЬ ВОССТАНАВЛИВАЕТСЯ · ПОКАЗАНЫ ПОСЛЕДНИЕ ДАННЫЕ':'ДАННЫЕ ВЕДУЩЕГО АКТУАЛЬНЫ'}</span></div>}
   <AdminBunkerControl eventId={dashboard.event.id} dependencies={deps.bunkerControl} dashboard={dashboard} onAcceptDistribution={accept} bunkerContractVersion={contract} missionOne={p1(m1)} onMissionOneOverride={deps.overrideMissionOne?override:undefined}/>
   {two&&<MissionTwoOwnerPanel model={two}/>} {three&&<MissionThreeOwnerPanel model={three}/>} {four&&<MissionFourOwnerPanel model={four}/>} {five&&<MissionFiveOwnerPanel model={five}/>} {six&&<MissionSixOwnerPanel model={six}/>} {storyPanel&&<UnknownPassengerOwnerPanel model={storyPanel}/>} {finalPanel&&<FinalOwnerPanel model={finalPanel} onAddTime={()=>finalAction(deps.addFinalTime)} onHint={()=>finalAction(deps.giveFinalHint)} onEmergencyOpen={()=>finalAction(deps.emergencyOpenFinal)}/>} 
   {(!dependencies||dependencies.testMode)&&<AdminBunkerTestDock eventId={dashboard.event.id} dependencies={dependencies?.testMode}/>} 
 </aside>;
}
