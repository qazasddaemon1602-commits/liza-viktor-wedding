import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BunkerScreenGuard } from './BunkerScreenGuard';
async function flush(){await act(async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();});}
function base(state:'MISSION_03'|'MISSION_04'){return{status:'active' as const,startedAt:'2026-08-30T18:20:00.000Z',durationSeconds:1800,remainingSeconds:1200,soundEnabled:false,phase:'mission_a' as const,unlocked:false,teams:[],characterCounts:{active:15,saved:12,excluded:3},globalGameState:state,currentMission:{id:state,state,plan:null},serverNow:'2026-08-30T18:20:00.000Z'};}
const m03={contractVersion:2 as const,status:'active' as const,serverNow:'2026-08-30T18:20:00.000Z',deadlineAt:'2026-08-30T18:26:00.000Z',title:'Аварийный запас',wagons:[{wagonId:'w1',label:'ВАГОН №1',status:'active' as const,solvedCount:0}]};
const m04={contractVersion:2 as const,status:'active' as const,serverNow:'2026-08-30T18:30:00.000Z',deadlineAt:'2026-08-30T18:35:00.000Z',title:'Межвагонная связь',groups:[{groupKey:'g1',labels:['ВАГОН №1','ВАГОН №2'],phase:'exchange' as const,answeredWagons:0,totalWagons:2,tradeCount:0}]};

describe('BunkerScreenGuard M03/M04',()=>{
 it('renders dedicated M03 public projection',async()=>{render(<BunkerScreenGuard dependencies={{load:vi.fn().mockResolvedValue(base('MISSION_03')),loadMissionThree:vi.fn().mockResolvedValue(m03)}}><div>base</div></BunkerScreenGuard>);await flush();expect(screen.getByRole('region',{name:'Задание 3 · общий экран'})).toBeInTheDocument();});
 it('renders dedicated M04 public projection',async()=>{render(<BunkerScreenGuard dependencies={{load:vi.fn().mockResolvedValue(base('MISSION_04')),loadMissionFour:vi.fn().mockResolvedValue(m04)}}><div>base</div></BunkerScreenGuard>);await flush();expect(screen.getByRole('region',{name:'Задание 4 · общий экран'})).toBeInTheDocument();});
});
