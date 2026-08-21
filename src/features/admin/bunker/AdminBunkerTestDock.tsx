import { useCallback,useEffect,useMemo,useState } from 'react';
import { getSupabaseClient } from '../../../lib/supabase';
import { broadcastBunkerRefresh,type BunkerRealtimeClient } from '../../bunker/bunker.realtime';
import { accelerateTestTimer,fullEventReset,getOwnerTestModeState,prepareTestGame,resetBunkerProgress,resetGameAndRegistrations,seedTestGuests,setTestInventory,setTestWagonState,simulateTestStage,type OwnerTestModeState,type TestModeRpcClient } from '../../bunker/v2/testMode.service';
import { BunkerTestPanel } from './BunkerTestPanel';

export type AdminBunkerTestDockDependencies={
  loadState:(eventId:string)=>Promise<OwnerTestModeState>;
  seed:(eventId:string,count:number)=>Promise<unknown>;
  prepare:(eventId:string)=>Promise<unknown>;
  accelerate:(eventId:string)=>Promise<unknown>;
  simulate:(eventId:string)=>Promise<unknown>;
  setInventory:(eventId:string,input:{wagonNumber:number;itemKey:string;quantity:number})=>Promise<unknown>;
  setWagonState:(eventId:string,input:{wagonNumber:number;power:'stable'|'unstable'|'offline';communication:'working'|'degraded'|'offline';navigation:'working'|'degraded'|'offline'})=>Promise<unknown>;
  resetProgress:(eventId:string)=>Promise<unknown>;
  resetRegistrations:(eventId:string,confirmation:string)=>Promise<unknown>;
  fullReset:(eventId:string,confirmation:string)=>Promise<unknown>;
  broadcastRefresh?:()=>Promise<void>;
};
type Props={eventId:string;dependencies?:AdminBunkerTestDockDependencies;pollIntervalMs?:number};
function browserDependencies():AdminBunkerTestDockDependencies|null{try{const client=getSupabaseClient() as unknown as TestModeRpcClient&BunkerRealtimeClient;return{loadState:(eventId)=>getOwnerTestModeState(client,eventId),seed:(eventId,count)=>seedTestGuests(client,eventId,count),prepare:(eventId)=>prepareTestGame(client,eventId),accelerate:(eventId)=>accelerateTestTimer(client,eventId,60),simulate:(eventId)=>simulateTestStage(client,eventId),setInventory:(eventId,input)=>setTestInventory(client,eventId,input.wagonNumber,input.itemKey,input.quantity),setWagonState:(eventId,input)=>setTestWagonState(client,eventId,input.wagonNumber,input),resetProgress:(eventId)=>resetBunkerProgress(client,eventId),resetRegistrations:(eventId,confirmation)=>resetGameAndRegistrations(client,eventId,confirmation),fullReset:(eventId,confirmation)=>fullEventReset(client,eventId,confirmation),broadcastRefresh:()=>broadcastBunkerRefresh(client,'liza-viktor')};}catch{return null;}}
export function AdminBunkerTestDock({eventId,dependencies,pollIntervalMs=5000}:Props){const deps=useMemo(()=>dependencies??browserDependencies(),[dependencies]);const[state,setState]=useState<OwnerTestModeState|null>(null),[error,setError]=useState('');const reload=useCallback(async()=>{if(!deps)return;try{const next=await deps.loadState(eventId);setState(next);setError('');}catch{setError('Не удалось обновить состояние репетиции. Боевые данные не изменены.');}},[deps,eventId]);useEffect(()=>{void reload();if(!deps)return;const interval=window.setInterval(()=>void reload(),pollIntervalMs);return()=>window.clearInterval(interval);},[deps,pollIntervalMs,reload]);const run=useCallback(async(action:()=>Promise<unknown>)=>{await action();try{await deps?.broadcastRefresh?.();}catch{}await reload();},[deps,reload]);if(!deps)return null;if(!state)return <section className="admin-bunker-test-panel" aria-label="Репетиция игры"><h2>РЕПЕТИЦИЯ ИГРЫ</h2><p role="status">{error||'Проверяем тестовый режим…'}</p></section>;return <><BunkerTestPanel state={{gameMode:state.gameMode,globalState:state.globalState}} onSeed={(count)=>run(()=>deps.seed(eventId,count))} onPrepare={()=>run(()=>deps.prepare(eventId))} onAccelerate={()=>run(()=>deps.accelerate(eventId))} onSimulate={()=>run(()=>deps.simulate(eventId))} onSetInventory={(input)=>run(()=>deps.setInventory(eventId,input))} onSetWagonState={(input)=>run(()=>deps.setWagonState(eventId,input))} onResetProgress={()=>run(()=>deps.resetProgress(eventId))} onResetRegistrations={(confirmation)=>run(()=>deps.resetRegistrations(eventId,confirmation))} onFullReset={(confirmation)=>run(()=>deps.fullReset(eventId,confirmation))}/>{error&&<p className="admin-bunker-test-panel__error" role="alert">{error}</p>}<p className="admin-bunker-test-panel__summary">Тестовых/зарегистрированных гостей: {state.guestCount} · активных вагонов: {state.wagonCount}</p></>;}
