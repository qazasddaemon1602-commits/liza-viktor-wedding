import { useMemo } from 'react';
import { broadcastBunkerRefresh, subscribeToBunkerRefresh, type BunkerRealtimeClient } from '../bunker/bunker.realtime';
import type { BunkerRpcClient } from '../bunker/bunker.service';
import { submitGuestBunkerGlobalMission } from '../bunker/bunkerGlobalMission.service';
import { getGuestBunkerQuest,submitBunkerFinalCode,submitBunkerMission } from '../bunker/bunkerQuest.service';
import { getGuestBunkerRuntime, useGuestBunkerAbility } from '../bunker/bunkerRuntime.service';
import { getGuestBunkerV2Dashboard } from '../bunker/v2/dashboard.service';
import { confirmMissionOneSelection,getGuestMissionOneReadModel } from '../bunker/v2/m01.service';
import { getGuestMissionTwoReadModel,submitMissionTwoAnswers,useMissionTwoAbility } from '../bunker/v2/m02.service';
import { commitMissionThreeAbility,confirmMissionThree,getGuestMissionThreeReadModel } from '../bunker/v2/m03.service';
import { getGuestMissionFourReadModel,proposeMissionFourTrade,respondMissionFourTrade,sendMissionFourMessage,submitMissionFourAnswer } from '../bunker/v2/m04.service';
import { castMissionFiveVote,getGuestMissionFiveReadModel,useMissionFiveAbility } from '../bunker/v2/m05.service';
import { castMissionSixVote,getGuestMissionSixReadModel,revealMissionSixFragment,useMissionSixAbility } from '../bunker/v2/m06.service';
import { getGuestUnknownPassengerReadModel } from '../bunker/v2/unknownPassenger.service';
import { getGuestFinalReadModel,requestFinalAccess } from '../bunker/v2/final.service';
import { subscribeToCarriageCallRefresh,type CarriageCallRealtimeClient } from '../carriages/carriageCalls.realtime';
import { getGuestActiveCarriageCalls,type CarriageCallRpcClient } from '../carriages/carriageCalls.service';
import { subscribeToQuizRefresh,type QuizRealtimeClient } from '../quiz/quiz.realtime';
import { getGuestQuizState,submitGuestQuizVote,type QuizRpcClient } from '../quiz/quiz.service';
import { getOrCreateDeviceKey } from '../../lib/deviceIdentity';
import { getSupabaseClient } from '../../lib/supabase';
import { JoinPage,type JoinPageDependencies } from './JoinPage';
import { recoverGuest,registerGuest,restoreGuest,type RegistrationRpcClient } from './registration.service';

const DEFAULT_EVENT_SLUG='liza-viktor';
type Props={client?:RegistrationRpcClient;realtimeClient?:CarriageCallRealtimeClient;quizClient?:QuizRpcClient;quizRealtimeClient?:QuizRealtimeClient;bunkerClient?:BunkerRpcClient;bunkerRealtimeClient?:BunkerRealtimeClient;eventSlug?:string;deviceKey?:string;revealDelayMs?:number};

export function GuestJoinPage({client,realtimeClient,quizClient,quizRealtimeClient,bunkerClient,bunkerRealtimeClient,eventSlug=DEFAULT_EVENT_SLUG,deviceKey,revealDelayMs}:Props){
  const dependencies=useMemo<JoinPageDependencies>(()=>{
    const browser=client?null:getSupabaseClient();
    const registration:RegistrationRpcClient=client??{rpc:async(name,args)=>{const{data,error}=await browser!.rpc(name as never,args as never);return{data,error};}};
    const calls=registration as unknown as CarriageCallRpcClient;
    const quiz=quizClient??(browser as unknown as QuizRpcClient|null)??undefined;
    const bunker=bunkerClient??(browser as unknown as BunkerRpcClient|null)??undefined;
    const callsRt=realtimeClient??(browser as unknown as CarriageCallRealtimeClient|null)??undefined;
    const quizRt=quizRealtimeClient??(browser as unknown as QuizRealtimeClient|null)??undefined;
    const bunkerRt=bunkerRealtimeClient??(browser as unknown as BunkerRealtimeClient|null)??undefined;
    let cached=deviceKey;
    const getDeviceKey=()=>{cached??=getOrCreateDeviceKey();return cached;};
    return{
      getDeviceKey,
      restore:(key)=>restoreGuest(registration,eventSlug,key),
      register:(draft,confirm)=>registerGuest(registration,eventSlug,getDeviceKey(),draft,confirm),
      recover:(key,code)=>recoverGuest(registration,eventSlug,key,code),
      loadCarriageCalls:(key)=>getGuestActiveCarriageCalls(calls,eventSlug,key),
      subscribeToCarriageCalls:callsRt?(id,cb)=>subscribeToCarriageCallRefresh(callsRt,id,cb):undefined,
      quiz:quiz?{getDeviceKey,load:(key)=>getGuestQuizState(quiz,eventSlug,key),vote:(key,q,c)=>submitGuestQuizVote(quiz,eventSlug,key,q,c),subscribeToRefresh:quizRt?(cb)=>subscribeToQuizRefresh(quizRt,eventSlug,cb):undefined}:undefined,
      bunker:bunker?{
        getDeviceKey,
        load:(key)=>getGuestBunkerQuest(bunker,eventSlug,key),
        loadRuntime:(key)=>getGuestBunkerRuntime(bunker,eventSlug,key),
        loadDashboard:(key)=>getGuestBunkerV2Dashboard(bunker,eventSlug,key),
        loadMissionOne:(key)=>getGuestMissionOneReadModel(bunker,eventSlug,key),
        confirmMissionOne:(key,input)=>confirmMissionOneSelection(bunker,{eventSlug,deviceKey:key,...input}),
        loadMissionTwo:(key)=>getGuestMissionTwoReadModel(bunker,eventSlug,key),
        submitMissionTwo:(key,input)=>submitMissionTwoAnswers(bunker,{eventSlug,deviceKey:key,...input}),
        useMissionTwoAbility:(key,input)=>useMissionTwoAbility(bunker,{eventSlug,deviceKey:key,...input}),
        loadMissionThree:(key)=>getGuestMissionThreeReadModel(bunker,eventSlug,key),
        confirmMissionThree:(key,input)=>confirmMissionThree(bunker,{eventSlug,deviceKey:key,...input}),
        useMissionThreeAbility:(key,input)=>commitMissionThreeAbility(bunker,{eventSlug,deviceKey:key,...input}),
        loadMissionFour:(key)=>getGuestMissionFourReadModel(bunker,eventSlug,key),
        sendMissionFourMessage:(key,input)=>sendMissionFourMessage(bunker,{eventSlug,deviceKey:key,...input}),
        proposeMissionFourTrade:(key,input)=>proposeMissionFourTrade(bunker,{eventSlug,deviceKey:key,...input}),
        respondMissionFourTrade:(key,input)=>respondMissionFourTrade(bunker,{eventSlug,deviceKey:key,...input}),
        submitMissionFourAnswer:(key,input)=>submitMissionFourAnswer(bunker,{eventSlug,deviceKey:key,...input}),
        loadMissionFive:(key)=>getGuestMissionFiveReadModel(bunker,eventSlug,key),
        castMissionFiveVote:(key,input)=>castMissionFiveVote(bunker,{eventSlug,deviceKey:key,...input}),
        useMissionFiveAbility:(key,input)=>useMissionFiveAbility(bunker,{eventSlug,deviceKey:key,...input}),
        loadMissionSix:(key)=>getGuestMissionSixReadModel(bunker,eventSlug,key),
        revealMissionSixFragment:(key,input)=>revealMissionSixFragment(bunker,{eventSlug,deviceKey:key,...input}),
        castMissionSixVote:(key,input)=>castMissionSixVote(bunker,{eventSlug,deviceKey:key,...input}),
        useMissionSixAbility:(key,input)=>useMissionSixAbility(bunker,{eventSlug,deviceKey:key,...input}),
        loadUnknownPassenger:(key)=>getGuestUnknownPassengerReadModel(bunker,eventSlug,key),
        loadFinal:(key)=>getGuestFinalReadModel(bunker,eventSlug,key),
        requestFinalAccess:(key,input)=>requestFinalAccess(bunker,{eventSlug,deviceKey:key,...input}),
        submitMission:(key,stage,answer)=>submitBunkerMission(bunker,eventSlug,key,stage,answer),
        submitFinalCode:(key,code)=>submitBunkerFinalCode(bunker,eventSlug,key,code),
        submitGlobalMission:(key,missionState,payload)=>submitGuestBunkerGlobalMission(bunker,eventSlug,key,missionState,payload),
        useAbility:(key,clientActionId)=>useGuestBunkerAbility(bunker,eventSlug,key,clientActionId),
        broadcastRefresh:bunkerRt?()=>broadcastBunkerRefresh(bunkerRt,eventSlug):undefined,
        subscribeToRefresh:bunkerRt?(cb)=>subscribeToBunkerRefresh(bunkerRt,eventSlug,cb):undefined,
      }:undefined,
    };
  },[bunkerClient,bunkerRealtimeClient,client,deviceKey,eventSlug,quizClient,quizRealtimeClient,realtimeClient]);
  return <JoinPage dependencies={dependencies} revealDelayMs={revealDelayMs}/>;
}
