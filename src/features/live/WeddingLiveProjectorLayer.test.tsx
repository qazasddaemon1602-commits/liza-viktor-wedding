import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GuestReactionScreenEvent } from './weddingLive.service';
import { WeddingLiveProjectorLayer } from './WeddingLiveProjectorLayer';

describe('WeddingLiveProjectorLayer', () => {
  it('renders over its children and aggregates equal reactions into one burst', () => {
    let listener: ((event: GuestReactionScreenEvent) => void) | undefined;
    const subscribe = (callback: (event: GuestReactionScreenEvent) => void) => {
      listener = callback;
      return () => { listener = undefined; };
    };

    render(
      <WeddingLiveProjectorLayer subscribe={subscribe} ttlMs={5000}>
        <div>ТЕКУЩАЯ СЦЕНА</div>
      </WeddingLiveProjectorLayer>,
    );

    expect(screen.getByText('ТЕКУЩАЯ СЦЕНА')).toBeInTheDocument();

    act(() => {
      listener?.({ id: '1', kind: 'guest_reaction', createdAt: '2026-08-24T00:00:00Z', reaction: 'fire' });
      listener?.({ id: '2', kind: 'guest_reaction', createdAt: '2026-08-24T00:00:01Z', reaction: 'fire' });
      listener?.({ id: '3', kind: 'guest_reaction', createdAt: '2026-08-24T00:00:02Z', reaction: 'clap' });
    });

    expect(screen.getByText('🔥')).toBeInTheDocument();
    expect(screen.getByText('×2')).toBeInTheDocument();
    expect(screen.getByText('👏')).toBeInTheDocument();
  });
});
