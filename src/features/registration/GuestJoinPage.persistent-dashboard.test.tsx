import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GuestJoinPage } from './GuestJoinPage';

const restoredGuest = {
  id:'guest-31',firstName:'Иван',lastName:'Петров',affiliationType:'common',affiliationDetail:'',ticketNumber:'LV-031',
  carriage:{id:'carriage-3',number:3,label:'ВАГОН №3',accentHex:'#7E3F3C',visualMark:'03'},
};

const runtime = {
  contractVersion:2 as const,status:'active' as const,serverNow:'2026-08-30T19:10:00Z',state:'MISSION_05' as const,planVersion:1,runNonce:'run-1',
  viewer:{kind:'guest' as const,guest:{id:restoredGuest.id,realName:'Иван Петров'},wagon:{number:3,label:'ВАГОН №3'}},
  character:{profileKey:'mechanic',profileVersion:1,profession:'МЕХАНИК',health:'отличное',visibleSkill:'ремонт механизмов',specialAbility:'mechanical_fix',abilityDescription:'Ремонтирует механизм.',abilityUsesRemaining:1,status:'active' as const,m01Eligibility:'frozen_member' as const,hiddenTraitRevealed:false as const},
  currentMission:{instanceId:'m05',instanceVersion:1,code:'MISSION_05' as const,status:'active' as const,scope:'wagon' as const},
};

const dashboard = {
  contractVersion:2 as const,status:'active' as const,serverNow:'2026-08-30T19:10:00Z',
  wagon:{id:restoredGuest.carriage.id,number:3,label:'ВАГОН №3'},
  passengers:[{guestId:restoredGuest.id,realName:'Иван Петров',profession:'МЕХАНИК',visibleSkill:'ремонт механизмов',characterStatus:'active' as const,hiddenTraitRevealed:false as const}],
  inventory:[{itemKey:'water',available:2,used:1,transferred:0,lost:0}],
  archive:[],
  wagonState:{powerStatus:'stable' as const,communicationStatus:'working' as const,navigationStatus:'working' as const,technicalDoorStatus:'locked' as const,trackDamage:0,waterStatus:'stable' as const,routeChoice:null,routeBonus:0,powerInstability:0,sector04Found:false,coordinationBonus:false},
};

describe('GuestJoinPage persistent Bunker dashboard production wiring',()=>{
  it('loads the dashboard with the restored device identity and shows it during M05',async()=>{
    const registrationRpc=vi.fn(async(name:string)=>{
      if(name==='restore_guest')return{data:{status:'restored',guest:restoredGuest},error:null};
      if(name==='get_guest_active_carriage_calls')return{data:{status:'ok',carriage:restoredGuest.carriage,calls:[]},error:null};
      return{data:null,error:new Error(`Unexpected registration RPC ${name}`)};
    });
    const bunkerRpc=vi.fn(async(name:string,args:Record<string,unknown>)=>{
      if(name==='get_guest_bunker_state')return{data:{status:'idle',serverNow:runtime.serverNow},error:null};
      if(name==='get_guest_bunker_runtime')return{data:runtime,error:null};
      if(name==='get_guest_bunker_v2_dashboard')return{data:dashboard,error:null};
      return{data:null,error:new Error(`Unavailable mission projection ${name}`)};
    });

    render(<GuestJoinPage client={{rpc:registrationRpc}} bunkerClient={{rpc:bunkerRpc}} eventSlug="liza-viktor" deviceKey="lvw_device_31" revealDelayMs={0}/>);

    expect(await screen.findByLabelText('Игровой модуль Бункер')).toBeInTheDocument();
    const user=userEvent.setup();
    await user.click(screen.getByRole('button',{name:'ИНВЕНТАРЬ'}));
    expect(screen.getByRole('heading',{name:'Запас воды'})).toBeInTheDocument();
    expect(screen.getByText('Доступно: 2')).toBeInTheDocument();
    expect(bunkerRpc).toHaveBeenCalledWith('get_guest_bunker_v2_dashboard',{
      p_event_slug:'liza-viktor',
      p_device_key:'lvw_device_31',
    });
  });
});
