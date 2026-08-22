import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BunkerScreenGuard } from './BunkerScreenGuard';
async function flush(){await act(async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();});}
const state={status:'active' as const,startedAt:'2026-08-30T20:00:00Z',durationSeconds:1800,remainingSeconds:1800,soundEnabled:false,phase:'final' as const,unlocked:false,teams:[],characterCounts:{active:15,saved:12,excluded:3},globalGameState:'FINAL_30' as const,currentMission:{id:'final',state:'FINAL_30' as const,plan:null},serverNow:'2026-08-30T20:00:00Z'};
const final={contractVersion:2 as const,status:'active' as const,serverNow:'2026-08-30T20:00:00Z',deadlineAt:'2026-08-30T20:30:00Z',solved:2,total:5,wrongAttempts:0,unlocked:false,hintLevel:0,timeAdjustmentSeconds:0};
describe('BunkerScreenGuard final TV',()=>{it('uses the dedicated final scene and never generic map fragments',async()=>{render(<BunkerScreenGuard dependencies={{load:vi.fn().mockResolvedValue(state),loadFinal:vi.fn().mockResolvedValue(final)}}><div>base</div></BunkerScreenGuard>);await flush();expect(screen.getByRole('region',{name:'Финал · общий экран'})).toBeInTheDocument();expect(screen.getByText('2 / 5 ПАРАМЕТРОВ')).toBeInTheDocument();expect(screen.queryByText(/ФРАГМЕНТОВ/)).not.toBeInTheDocument();});});
