import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { BunkerV2ActiveGuestRuntime } from '../bunker/v2/contracts';
import type { BunkerV2DashboardReadModel } from '../bunker/v2/dashboard.service';
import type { RegisteredGuest } from '../registration/registration.types';
import { GuestHub } from './GuestHub';

const guest: RegisteredGuest = {
  id:'g1', firstName:'Анна', lastName:'Петрова', affiliationType:'common', affiliationDetail:'',
  ticketNumber:'LV-1', carriage:{ id:'w1', number:1, label:'ВАГОН №1', accentHex:'#333333', visualMark:'I' },
};

const runtime: BunkerV2ActiveGuestRuntime = {
  contractVersion:2,status:'active',serverNow:'2026-08-30T19:10:00Z',state:'MISSION_05',planVersion:1,runNonce:'run',
  viewer:{kind:'guest',guest:{id:'g1',realName:'Анна Петрова'},wagon:{number:1,label:'ВАГОН №1'}},
  character:{profileKey:'architect',profileVersion:1,profession:'АРХИТЕКТОР',health:'хорошее',visibleSkill:'чтение чертежей',specialAbility:'plan_analysis',abilityDescription:'Анализирует план.',abilityUsesRemaining:1,status:'active',m01Eligibility:'frozen_member',hiddenTraitRevealed:false},
  currentMission:{instanceId:'m05',instanceVersion:1,code:'MISSION_05',status:'active',scope:'wagon'},
};

const dashboard: Extract<BunkerV2DashboardReadModel,{status:'active'}> = {
  contractVersion:2,status:'active',serverNow:'2026-08-30T19:10:00Z',wagon:{id:'w1',number:1,label:'ВАГОН №1'},
  passengers:[{guestId:'g1',realName:'Анна Петрова',profession:'АРХИТЕКТОР',visibleSkill:'чтение чертежей',characterStatus:'active',hiddenTraitRevealed:false}],
  inventory:[{itemKey:'water',available:2,used:0,transferred:0,lost:0}],
  archive:[],
  wagonState:{powerStatus:'stable',communicationStatus:'working',navigationStatus:'working',technicalDoorStatus:'locked',trackDamage:0,waterStatus:'stable',routeChoice:null,routeBonus:0,powerInstability:0,sector04Found:false,coordinationBonus:false},
};

describe('GuestHub persistent Bunker dashboard',()=>{
  it('passes the durable dashboard and its recoverable connection warning into the Bunker phone UI',async()=>{
    const user=userEvent.setup();
    render(<GuestHub guest={guest} activeCall={null} bunkerRuntime={runtime} bunkerDashboard={dashboard} bunkerDashboardError="Не удалось обновить данные вагона. Показываем последние полученные данные." quizState={{status:'idle',history:[]}} onQuizVote={vi.fn()}/>);
    expect(screen.getByRole('alert')).toHaveTextContent(/последние полученные данные/i);
    await user.click(screen.getByRole('button',{name:'ИНВЕНТАРЬ'}));
    expect(screen.getByRole('heading',{name:'Запас воды'})).toBeInTheDocument();
    expect(screen.getByText('Доступно: 2')).toBeInTheDocument();
  });
});
