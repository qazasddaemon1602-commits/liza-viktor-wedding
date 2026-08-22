import type { MkTournamentProjection } from './mk.types';

type ActiveProjection = Extract<MkTournamentProjection, { status: 'active' }>;

type MkSignupCardProps = {
  state: ActiveProjection;
  joining: boolean;
  onJoin: () => void;
};

export function MkSignupCard({ state, joining, onJoin }: MkSignupCardProps) {
  const ownStatus = state.ownRegistrationStatus;
  const limit = state.maxPlayers;

  if (ownStatus === 'active') {
    return (
      <section className="mk-signup-card mk-signup-card--confirmed" role="status" aria-live="polite">
        <p className="eyebrow">БОЕЦ ПОДТВЕРЖДЁН</p>
        <strong>ВЫ В ТУРНИРЕ · {state.activeCount} / {limit}</strong>
        <p>Ждите жеребьёвку. Имя и вагон уже взяты из вашей регистрации на свадьбе.</p>
        <a className="mk-primary-button" href="/join">ВЕРНУТЬСЯ К БИЛЕТУ</a>
      </section>
    );
  }

  if (ownStatus === 'waitlist') {
    return (
      <section className="mk-signup-card mk-signup-card--waitlist" role="status" aria-live="polite">
        <p className="eyebrow">{limit} / {limit}</p>
        <strong>ЛИСТ ОЖИДАНИЯ · №{state.waitlistPosition ?? '—'}</strong>
        <p>Если освободится место, админ сможет поднять вас в основную сетку.</p>
        <a className="mk-primary-button" href="/join">ВЕРНУТЬСЯ К БИЛЕТУ</a>
      </section>
    );
  }

  if (state.state !== 'registration') {
    return (
      <section className="mk-signup-card">
        <p className="eyebrow">РЕГИСТРАЦИЯ ЗАКРЫТА</p>
        <strong>{state.activeCount} / {limit} ИГРОКОВ</strong>
        <p>Сетка уже готовится или турнир начался. Смотреть турнир можно здесь же.</p>
      </section>
    );
  }

  return (
    <section className="mk-signup-card">
      <p className="eyebrow">ПОСЛЕДНИЙ КРУГ · {limit} МЕСТ</p>
      <strong>{state.activeCount} / {limit}</strong>
      <p>
        Первые {limit} зарегистрированных гостей попадают в основную сетку. Дальше — лист ожидания.
      </p>
      <button
        type="button"
        className="mk-primary-button"
        disabled={joining}
        onClick={onJoin}
      >
        {joining ? 'ДОБАВЛЯЕМ В СЕТКУ…' : 'УЧАСТВОВАТЬ В БИТВЕ'}
      </button>
    </section>
  );
}

