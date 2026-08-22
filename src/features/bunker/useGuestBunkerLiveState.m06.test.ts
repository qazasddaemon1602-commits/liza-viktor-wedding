import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGuestBunkerLiveState, type GuestBunkerLiveDependencies } from './useGuestBunkerLiveState';

const m06 = {
  contractVersion: 2 as const, status: 'active' as const,
  serverNow: '2026-08-30T18:50:00.000Z', deadlineAt: '2026-08-30T18:58:00.000Z',
  instanceId: 'm6', instanceVersion: 1, title: 'Общий протокол', intro: 'Соберите фрагменты.',
  viewer: { wagonId:'w1', wagonNumber:1, canVote:true },
  privateFragment: { key:'f1', label:'Фрагмент вагона 01', body:'TUNNEL B' }, fragmentShared:false,
  revealedFragments: [], fragmentsRevealed:0, fragmentsTotal:2,
  options:[{key:'A' as const,title:'Протокол A',summary:'A'},{key:'B' as const,title:'Протокол B',summary:'B'},{key:'C' as const,title:'Протокол C',summary:'C'}],
  selectedVote:null, wagonConsensus:[{wagonId:'w1',label:'ВАГОН №1',votesA:0,votesB:0,votesC:0,required:2,consensus:null}], ability:null,
};
function deps(overrides:Partial<GuestBunkerLiveDependencies>):GuestBunkerLiveDependencies{return{getDeviceKey:()=> 'device',load:vi.fn().mockResolvedValue({status:'idle',serverNow:m06.serverNow}),loadRuntime:vi.fn().mockResolvedValue({status:'idle',serverNow:m06.serverNow}),submitMission:vi.fn(),submitFinalCode:vi.fn(),subscribeToRefresh:()=>vi.fn(),...overrides}as GuestBunkerLiveDependencies;}

describe('useGuestBunkerLiveState M06',()=>{
 it('loads protocol and forwards fragment/vote commands',async()=>{const loadMissionSix=vi.fn().mockResolvedValue(m06),revealMissionSixFragment=vi.fn().mockResolvedValue({status:'accepted'}),castMissionSixVote=vi.fn().mockResolvedValue({status:'accepted'});const dependencies=deps({loadMissionSix,revealMissionSixFragment,castMissionSixVote});const{result}=renderHook(()=>useGuestBunkerLiveState({dependencies}));await waitFor(()=>expect(result.current.missionSix).toMatchObject({title:'Общий протокол',remainingSeconds:480}));await act(async()=>result.current.revealMissionSixFragment());await act(async()=>result.current.castMissionSixVote('B'));expect(revealMissionSixFragment).toHaveBeenCalledWith('device',expect.objectContaining({instanceId:'m6',fragmentKey:'f1',commandId:expect.any(String)}));expect(castMissionSixVote).toHaveBeenCalledWith('device',expect.objectContaining({instanceId:'m6',vote:'B'}));});
});
