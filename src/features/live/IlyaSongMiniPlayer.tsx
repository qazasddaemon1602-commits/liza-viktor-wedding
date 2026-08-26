import { getWeddingMusicTrack, type IlyaSongScreenEvent } from './ilyaSong.service';
import { WeddingLiveAudioPlayer } from './WeddingLiveAudioPlayer';

type Props = {
  song: Extract<IlyaSongScreenEvent, { action: 'play' }>;
  onEnded?: () => void;
};

export function IlyaSongMiniPlayer({ song, onEnded }: Props) {
  const track = getWeddingMusicTrack(song.trackId);
  return (
    <aside className="ilya-song-mini-player" role="status" aria-label={`Сейчас играет: ${song.title}`}>
      <WeddingLiveAudioPlayer src={track.audioSource} eventKey={song.id} onEnded={onEnded} />
      <div className="ilya-song-mini-player__art" aria-hidden="true">♪</div>
      <div className="ilya-song-mini-player__copy">
        <span>СЕЙЧАС ИГРАЕТ</span>
        <strong>{song.title}</strong>
        <small>{song.artist}</small>
        <div className="ilya-song-mini-player__track" aria-hidden="true">
          <i style={{ animationDuration: `${song.durationMs}ms` }} />
        </div>
      </div>
      <div className="ilya-song-mini-player__bars" aria-hidden="true"><i /><i /><i /></div>
    </aside>
  );
}
