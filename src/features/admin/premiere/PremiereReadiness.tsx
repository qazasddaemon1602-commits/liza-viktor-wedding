export type PremiereReadinessInputs = {
  expected: number;
  registered: number;
  quietMinutes: number;
  projector?: boolean;
  video?: boolean;
  audio?: boolean;
  minimumFraction?: number;
  quietMinutesRequired?: number;
};

export type PremiereReadinessState =
  | 'waiting'
  | 'main_group_ready'
  | 'technical_not_ready'
  | 'ready';

export type PremiereReadinessResult = {
  state: PremiereReadinessState;
  mainGroupReady: boolean;
  technicalReady: boolean;
  autoStart: false;
  minimumGuests: number;
  quietMinutesRequired: number;
};

export function getPremiereReadiness(inputs: PremiereReadinessInputs): PremiereReadinessResult {
  const expected = Math.max(1, Math.floor(inputs.expected));
  const fraction = Math.min(1, Math.max(0.5, inputs.minimumFraction ?? 0.75));
  const minimumGuests = Math.ceil(expected * fraction);
  const quietMinutesRequired = Math.max(0, inputs.quietMinutesRequired ?? 5);
  const mainGroupReady = inputs.registered >= minimumGuests
    && inputs.quietMinutes >= quietMinutesRequired;

  const technicalValues = [inputs.projector, inputs.video, inputs.audio];
  const technicalAssessed = technicalValues.every((value) => value !== undefined);
  const technicalFailed = technicalValues.some((value) => value === false);
  const technicalReady = technicalValues.every((value) => value === true);

  let state: PremiereReadinessState = 'waiting';
  if (mainGroupReady) {
    if (!technicalAssessed) state = 'main_group_ready';
    else if (technicalFailed) state = 'technical_not_ready';
    else if (technicalReady) state = 'ready';
  }

  return {
    state,
    mainGroupReady,
    technicalReady,
    autoStart: false,
    minimumGuests,
    quietMinutesRequired,
  };
}

function technicalLabel(value: boolean | undefined, ready: string, missing: string) {
  if (value === true) return ready;
  if (value === false) return missing;
  return 'НЕ ПРОВЕРЕНО';
}

export function PremiereReadiness({ inputs }: { inputs: PremiereReadinessInputs }) {
  const readiness = getPremiereReadiness(inputs);

  const headline = readiness.state === 'ready'
    ? 'ПРЕМЬЕРА ГОТОВА'
    : readiness.state === 'technical_not_ready'
      ? 'ТЕХНИКА ЕЩЁ НЕ ГОТОВА'
      : readiness.mainGroupReady
        ? 'ОСНОВНОЙ СОСТАВ СОБРАН'
        : 'ЖДЁМ ОСНОВНОЙ СОСТАВ';

  return (
    <section className="premiere-readiness" aria-label="Готовность премьеры">
      <div className="premiere-readiness-heading">
        <div>
          <p className="eyebrow">ГОТОВНОСТЬ К ПРЕМЬЕРЕ</p>
          <h3>{headline}</h3>
        </div>
        <strong className={`premiere-readiness-state premiere-readiness-state--${readiness.state}`}>
          {readiness.state === 'ready' ? 'ГОТОВО' : 'ПРОВЕРКА'}
        </strong>
      </div>

      <div className="premiere-readiness-grid">
        <div>
          <span>Зарегистрировано</span>
          <strong>{inputs.registered} / ~{inputs.expected}</strong>
        </div>
        <div>
          <span>Последний гость</span>
          <strong>{Math.max(0, Math.floor(inputs.quietMinutes))} мин назад</strong>
        </div>
        <div>
          <span>Экран / проектор</span>
          <strong>{technicalLabel(inputs.projector, 'НА СВЯЗИ', 'НЕТ СВЯЗИ')}</strong>
        </div>
        <div>
          <span>Видео</span>
          <strong>{technicalLabel(inputs.video, 'ГОТОВО', 'НЕ ГОТОВО')}</strong>
        </div>
        <div>
          <span>Звук</span>
          <strong>{technicalLabel(inputs.audio, 'ГОТОВ', 'НЕ ГОТОВ')}</strong>
        </div>
      </div>

      {readiness.mainGroupReady && (
        <p className="premiere-readiness-main">ОСНОВНОЙ СОСТАВ СОБРАН</p>
      )}
      <p className="premiere-readiness-note">
        Это только рекомендация — запуск только вручную из панели владельца.
      </p>
    </section>
  );
}
