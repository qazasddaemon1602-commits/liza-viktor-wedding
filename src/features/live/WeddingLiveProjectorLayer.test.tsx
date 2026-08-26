import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { IlyaSongScreenEvent } from './ilyaSong.service';
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

  it('shows a compact Ilya song player on play and removes it on stop', () => {
    let songListener: ((event: IlyaSongScreenEvent) => void) | undefined;

    render(
      <WeddingLiveProjectorLayer
        subscribe={() => () => undefined}
        subscribeIlyaSong={(callback) => {
          songListener = callback;
          return () => { songListener = undefined; };
        }}
      >
        <div>ТЕКУЩАЯ СЦЕНА</div>
      </WeddingLiveProjectorLayer>,
    );

    act(() => {
      songListener?.({
        id: 'song-play-1',
        kind: 'ilya_song',
        createdAt: '2026-08-26T18:00:00Z',
        action: 'play',
        trackId: 'last-route',
        title: 'Последний маршрут',
        artist: 'Свадебный плейлист',
        durationMs: 227440,
      });
    });

    const player = screen.getByRole('status', { name: 'Сейчас играет: Последний маршрут' });
    expect(player).toHaveTextContent('СЕЙЧАС ИГРАЕТ');
    expect(player).toHaveTextContent('Последний маршрут');
    expect(player).toHaveTextContent('Свадебный плейлист');
    expect(player.querySelector('audio')).toHaveAttribute('src', '/audio/live/last-route.mp3');

    act(() => {
      songListener?.({
        id: 'song-stop-1',
        kind: 'ilya_song',
        createdAt: '2026-08-26T18:01:00Z',
        action: 'stop',
      });
    });

    expect(screen.queryByRole('status', { name: 'Сейчас играет: Последний маршрут' })).not.toBeInTheDocument();
  });
});
