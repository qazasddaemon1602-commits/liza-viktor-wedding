import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AdminDashboard } from '../admin.service';
import type { AdminBunkerControlDependencies } from './AdminBunkerControl';
import { AdminBunkerDock } from './AdminBunkerDock';
import type { MissionTwoOwnerReadModel } from '../../bunker/v2/m02.service';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const dashboard: AdminDashboard = {
  status: 'owner',
  event: {
    id: 'event-1',
    slug: 'liza-viktor',
    name: 'Лиза & Виктор',
    weddingDate: '2026-08-30',
    eventDate: '2026-08-30',
    expectedGuestCount: 40,
    registrationOpen: true,
    compositionLocked: true,
    nextTicketSequence: 1,
  },
  state: null,
  carriages: [],
  guests: [],
  recentActions: [],
};

function controlDependencies(): AdminBunkerControlDependencies {
  return {
    load: vi.fn().mockResolvedValue({
      status: 'idle',
      durationSeconds: 1800,
      soundEnabled: true,
      serverNow: '2026-08-30T12:00:00.000Z',
    }),
    prepare: vi.fn(),
    distribute: vi.fn(),
    prepareV2: vi.fn(),
    transitionV2: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    setSound: vi.fn(),
    broadcastRefresh: vi.fn().mockResolvedValue(undefined),
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('AdminBunkerDock contract race', () => {
  it('does not expose a V1 launch path while a full V2 contract read is unresolved', async () => {
    const m02 = deferred<MissionTwoOwnerReadModel>();
    render(
      <AdminBunkerDock
        dependencies={{
          loadDashboard: vi.fn().mockResolvedValue(dashboard),
          applyDistribution: vi.fn(),
          bunkerControl: controlDependencies(),
          loadMissionTwo: vi.fn().mockReturnValue(m02.promise),
        }}
      />,
    );
    await flush();

    expect(screen.getByText('ВЕРСИЯ БУНКЕРА · ПРОВЕРЯЕМ СЕРВЕРНЫЙ КОНТРАКТ')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'БУНКЕР' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ЭКСТРЕННОЕ СООБЩЕНИЕ/ })).not.toBeInTheDocument();

    m02.resolve({
      contractVersion: 2,
      status: 'idle',
      serverNow: '2026-08-30T12:00:01.000Z',
    });
    await flush();

    expect(await screen.findByRole('heading', { name: 'БУНКЕР' })).toBeInTheDocument();
    expect(screen.queryByText('ВЕРСИЯ БУНКЕРА · ПРОВЕРЯЕМ СЕРВЕРНЫЙ КОНТРАКТ')).not.toBeInTheDocument();
  });
});
