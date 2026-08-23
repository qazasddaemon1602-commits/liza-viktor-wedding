import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BunkerScreenGuard } from './BunkerScreenGuard';
async function flush(){await act(async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();});}
const state={status:'active' as const,startedAt:'2026-08-30T20:00:00Z',durationSeconds:1800,remainingSeconds:1800,soundEnabled:false,phase:'final' as const,unlocked:false,teams:[],characterCounts:{active:15,saved:12,excluded:3},globalGameState:'FINAL_30' as const,currentMission:{id:'final',state:'FINAL_30' as const,plan:null},serverNow:'2026-08-30T20:00:00Z'};
const final={contractVersion:2 as const,status:'active' as const,serverNow:'2026-08-30T20:00:00Z',deadlineAt:'2026-08-30T20:30:00Z',solved:2,total:5,wrongAttempts:0,unlocked:false,hintLevel:0,timeAdjustmentSeconds:0};
const results={contractVersion:2 as const,status:'completed' as const,serverNow:'2026-08-30T20:31:00Z',finishTimeSeconds:742,emergencyOpen:false,characters:{active:1,saved:16,excluded:3},archiveFound:4,resourcesRemaining:7,resourcesUsed:5,tradesCompleted:2,wrongAttempts:1,hintsUsed:1,skillsUsed:4,missionsCompleted:6,missionsTotal:6,coordinationScore:91};

afterEach(()=>{vi.useRealTimers();window.sessionStorage.clear();});

describe('BunkerScreenGuard final TV',()=>{
  it('uses the dedicated final scene and never generic map fragments',async()=>{render(<BunkerScreenGuard dependencies={{load:vi.fn().mockResolvedValue(state),loadFinal:vi.fn().mockResolvedValue(final)}}><div>base</div></BunkerScreenGuard>);await flush();expect(screen.getByRole('region',{name:'Финал · общий экран'})).toBeInTheDocument();expect(screen.getByText('2 / 5 ПАРАМЕТРОВ')).toBeInTheDocument();expect(screen.queryByText(/ФРАГМЕНТОВ/)).not.toBeInTheDocument();});

  it('uses BUNKER_OPEN for the Liza reveal without showing result statistics',async()=>{
    render(<BunkerScreenGuard dependencies={{load:vi.fn().mockResolvedValue({...state,phase:'completed',unlocked:true,globalGameState:'BUNKER_OPEN',currentMission:null}),loadResults:vi.fn().mockResolvedValue(results)}}><div>base</div></BunkerScreenGuard>);
    await flush();
    expect(screen.getByRole('region',{name:'Лиза встречает поезд · общий экран'})).toHaveTextContent('Сигнал принят. Поезд Виктора прибыл. Я ждала вас. — Лиза');
    expect(screen.queryByText('91 / 100')).not.toBeInTheDocument();
  });

  it('keeps result statistics exclusively at FINISHED',async()=>{
    render(<BunkerScreenGuard dependencies={{load:vi.fn().mockResolvedValue({...state,phase:'completed',unlocked:true,globalGameState:'FINISHED',currentMission:null}),loadResults:vi.fn().mockResolvedValue(results)}}><div>base</div></BunkerScreenGuard>);
    await flush();
    expect(screen.getByRole('region',{name:'Бункер открыт · итоги игры'})).toHaveTextContent('91 / 100');
    expect(screen.queryByRole('region',{name:'Лиза встречает поезд · общий экран'})).not.toBeInTheDocument();
  });

  it('connects the reveal scene to the existing door and reveal cues in order',async()=>{
    vi.useFakeTimers();
    const order:string[]=[];
    const audio={arm:vi.fn().mockResolvedValue(true),startAlarm:vi.fn(),stopAlarm:vi.fn(),startAmbience:vi.fn(),stopAmbience:vi.fn(),playDoorUnlock:vi.fn(()=>order.push('door')),playReveal:vi.fn(()=>order.push('reveal')),dispose:vi.fn()};
    render(<BunkerScreenGuard dependencies={{load:vi.fn().mockResolvedValue({...state,soundEnabled:true,phase:'completed',unlocked:true,globalGameState:'BUNKER_OPEN',currentMission:null}),loadResults:vi.fn().mockResolvedValue(results),audio}}><div>base</div></BunkerScreenGuard>);
    await flush();
    expect(order).toEqual(['door']);
    await act(async()=>{await vi.advanceTimersByTimeAsync(1600);});
    expect(order).toEqual(['door','reveal']);
    expect(audio.stopAmbience).toHaveBeenCalled();
  });
});
