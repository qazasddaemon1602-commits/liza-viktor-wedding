import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RegisteredGuest } from '../registration/registration.types';
import { GuestHub } from './GuestHub';

const guest: RegisteredGuest = { id:'g1', firstName:'Анна', lastName:'Петрова', affiliationType:'common', affiliationDetail:'', ticketNumber:'LV-1', carriage:{ id:'w1', number:1, label:'ВАГОН №1', accentHex:'#333333', visualMark:'I' } };
function runtime(state: 'MISSION_03' | 'MISSION_04') {
  return { contractVersion:2 as const,status:'active' as const,serverNow:'2026-08-30T18:20:00.000Z',state,planVersion:1,runNonce:'run',viewer:{kind:'guest' as const,guest:{id:'g1',realName:'Анна Петрова'},wagon:{number:1,label:'ВАГОН №1'}},character:{profileKey:'paramedic',profileVersion:1,profession:'Фельдшер',health:'Здорова',visibleSkill:'Медицина',specialAbility:'stabilize_person',abilityDescription:'Помощь',abilityUsesRemaining:1,status:'saved' as const,m01Eligibility:'frozen_member' as const,hiddenTraitRevealed:true as const,hiddenTrait:'Факт'},currentMission:{instanceId:state==='MISSION_03'?'m3':'m4',instanceVersion:1,code:state,status:'active' as const,scope:state==='MISSION_04'?'group' as const:'wagon' as const}};
}
const m03={instanceId:'m3',instanceVersion:1,status:'active' as const,remainingSeconds:360,title:'Аварийный запас',intro:'Приоритеты',memberRole:'captain' as const,problems:[{key:'injury',title:'Ранен пассажир',risk:'Риск',itemKey:'medkit'},{key:'communication',title:'Связь',risk:'Риск',itemKey:'radio'},{key:'power',title:'Питание',risk:'Риск',itemKey:'generator'},{key:'mechanism',title:'Механизм',risk:'Риск',itemKey:'tools'},{key:'water',title:'Вода',risk:'Риск',itemKey:'water'}],inventory:[{itemKey:'medkit',quantity:1,status:'available'}],selectedProblems:[],ability:null,pendingCommitments:[],connection:'online' as const};
const m04={instanceId:'m4',status:'active' as const,remainingSeconds:300,title:'Межвагонная связь',interactionPhase:'exchange' as const,group:{key:'g',wagons:[{id:'w1',number:1,label:'ВАГОН №1'},{id:'w2',number:2,label:'ВАГОН №2'}]},viewer:{wagonId:'w1',wagonNumber:1,isOperator:true},messageQuota:3,messagesRemaining:3,messages:[],inventory:[],trades:[],answer:{options:['СВЯЗЬ','ПИТАНИЕ','МАРШРУТ'],selected:null,answeredWagons:0,totalWagons:2},ability:null,connection:'online' as const};

describe('GuestHub M03/M04',()=>{
  it('renders M03 for a V2 guest without leaving Bunker',()=>{render(<GuestHub guest={guest} activeCall={null} bunkerRuntime={runtime('MISSION_03')} bunkerMissionThree={m03} quizState={{status:'idle',history:[]}} onQuizVote={vi.fn()}/>);expect(screen.getByRole('region',{name:'Задание 3 · Аварийный запас'})).toBeInTheDocument();});
  it('renders M04 for a V2 guest without leaving Bunker',()=>{render(<GuestHub guest={guest} activeCall={null} bunkerRuntime={runtime('MISSION_04')} bunkerMissionFour={m04} quizState={{status:'idle',history:[]}} onQuizVote={vi.fn()}/>);expect(screen.getByRole('region',{name:'Задание 4 · Межвагонная связь'})).toBeInTheDocument();});
});
