import { useState } from 'react';
import type { ActiveGuestBunkerRuntime } from './bunkerRuntime.service';
import { BunkerResponsivePicture, type BunkerAsset } from './BunkerResponsivePicture';

const SECTIONS = [
  'МОЙ ВАГОН', 'ПЕРСОНАЖ', 'ПАССАЖИРЫ', 'ИНВЕНТАРЬ',
  'АРХИВ', 'СОСТОЯНИЕ', 'ТЕКУЩЕЕ ЗАДАНИЕ',
] as const;
type Section = typeof SECTIONS[number];

const ITEM_STATUS: Record<string, string> = {
  available: 'ДОСТУПНО', used: 'ИСПОЛЬЗОВАНО', transferred: 'ПЕРЕДАНО', lost: 'ПОТЕРЯНО',
};

function rows(value: unknown[]): Record<string, unknown>[] {
  return value.filter((entry): entry is Record<string, unknown> => (
    typeof entry === 'object' && entry !== null && !Array.isArray(entry)
  ));
}

type ArchiveEntry = {
  artifactKey: string;
  contentType: string;
  decryptionStatus: string;
  scope: string;
};

type CurrentMission = { id: string };

function nonEmptyText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function archiveEntries(value: unknown[]): ArchiveEntry[] {
  return rows(value).flatMap((entry) => {
    const artifactKey = nonEmptyText(entry.artifactKey);
    const contentType = nonEmptyText(entry.contentType);
    const decryptionStatus = nonEmptyText(entry.decryptionStatus);
    const scope = nonEmptyText(entry.scope);
    return artifactKey && contentType && decryptionStatus && scope
      ? [{ artifactKey, contentType, decryptionStatus, scope }]
      : [];
  });
}

function currentMission(value: unknown): CurrentMission | null {
  const entry = rows([value])[0];
  const id = entry ? nonEmptyText(entry.id) : null;
  return id ? { id } : null;
}

function archiveArtwork(entry: ArchiveEntry): BunkerAsset | null {
  const key = entry.artifactKey.toLocaleLowerCase('en-US');
  const contentType = entry.contentType.toLocaleLowerCase('en-US');
  if (key.includes('bk17') || key.includes('bk-17')) return 'archive-bk17';
  if (contentType === 'card' || key.includes('card')) return 'archive-card';
  if (contentType === 'document' || key.includes('document')) return 'archive-document';
  return null;
}

type BunkerPlayerDashboardProps = {
  runtime: ActiveGuestBunkerRuntime;
  connectionError?: string;
};

export function BunkerPlayerDashboard({ runtime, connectionError = '' }: BunkerPlayerDashboardProps) {
  const [section, setSection] = useState<Section>('МОЙ ВАГОН');
  const inventory = rows(runtime.inventory);
  const passengers = rows(runtime.passengers);
  const archive = archiveEntries(runtime.archive);
  const mission = currentMission(runtime.currentMission);

  return (
    <section className="bunker-player-dashboard" aria-label="Игровой модуль Бункер">
      <header className="bunker-player-dashboard__header">
        <div>
          <p className="bunker-player-dashboard__index">ПОСЛЕДНИЙ ВАГОН · {runtime.wagon.label}</p>
          <h2 className="bunker-player-dashboard__guest-name">
            {runtime.guest.realName.toLocaleUpperCase('ru-RU')}
          </h2>
        </div>
        <span className="bunker-player-dashboard__state">{runtime.game.state}</span>
      </header>

      <BunkerResponsivePicture
        asset="tunnel-relief-wide"
        mobileAsset="tunnel-relief-mobile"
        className="bunker-player-dashboard__relief"
        testId="bunker-tunnel-relief"
        sizes="(max-width: 640px) calc(100vw - 1.3rem), min(72rem, calc(100vw - 5rem))"
        loading="eager"
      />

      {connectionError && (
        <p className="bunker-player-dashboard__connection" role="alert">{connectionError}</p>
      )}

      {runtime.guest.joinedLate && (
        <p className="bunker-player-dashboard__late" role="status">
          Вы присоединились к составу после отправления. Некоторые решения уже были приняты вашим вагоном.
        </p>
      )}

      {runtime.character.status === 'excluded' && (
        <p className="bunker-player-dashboard__continuity" role="status">
          Персонаж исключён из истории, но вы продолжаете участвовать: обсуждайте решения вагона и выполняйте текущие задания.
        </p>
      )}

      {runtime.character.status === 'saved' && (
        <p className="bunker-player-dashboard__continuity" role="status">
          Персонаж спасён по итогам истории, но вы продолжаете участвовать: обсуждайте решения вагона и выполняйте текущие задания.
        </p>
      )}

      {mission && (
        <button
          className="bunker-player-dashboard__primary-action"
          type="button"
          onClick={() => setSection('ТЕКУЩЕЕ ЗАДАНИЕ')}
        >
          ОТКРЫТЬ ТЕКУЩЕЕ ЗАДАНИЕ
        </button>
      )}

      <nav className="bunker-player-dashboard__nav" aria-label="Разделы игры">
        {SECTIONS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={section === item}
            onClick={() => setSection(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      <div className="bunker-player-dashboard__content">
        {section === 'МОЙ ВАГОН' && (
          <article>
            <p className="bunker-player-dashboard__index">СОСТАВ</p>
            <h3>{runtime.wagon.label.toLocaleUpperCase('ru-RU')}</h3>
            <p>{passengers.length} пассажиров · решения команды синхронизируются автоматически.</p>
          </article>
        )}

        {section === 'ПЕРСОНАЖ' && (
          <article className="bunker-player-character">
            <p className="bunker-player-dashboard__index">ВАША РОЛЬ</p>
            <h3>{runtime.character.profession}</h3>
            <dl>
              <div><dt>Здоровье</dt><dd>{runtime.character.health}</dd></div>
              <div><dt>Навык</dt><dd>{runtime.character.visibleSkill}</dd></div>
              <div><dt>Скрытая характеристика</dt><dd>{runtime.character.hiddenTrait ?? 'ДАННЫЕ НЕДОСТУПНЫ'}</dd></div>
            </dl>
            <div className="bunker-player-character__ability">
              <span>ОСОБАЯ СПОСОБНОСТЬ</span>
              <p>{runtime.character.abilityDescription}</p>
              <small>При подходящей ситуации система уведомит вас.</small>
            </div>
          </article>
        )}

        {section === 'ПАССАЖИРЫ' && (
          <div className="bunker-player-list">
            {passengers.map((passenger) => (
              <article key={String(passenger.guestId)}>
                <h3>{String(passenger.realName)}</h3>
                <strong>{String(passenger.profession)}</strong>
                <p>{String(passenger.visibleSkill)}</p>
                <small>{passenger.hiddenTraitRevealed ? String(passenger.hiddenTrait) : 'СКРЫТАЯ ХАРАКТЕРИСТИКА · ???'}</small>
              </article>
            ))}
          </div>
        )}

        {section === 'ИНВЕНТАРЬ' && (
          <div className="bunker-player-list">
            {inventory.map((item) => (
              <article key={String(item.id)}>
                <h3>{String(item.itemKey).toLocaleUpperCase('ru-RU')}</h3>
                <strong>{ITEM_STATUS[String(item.status)] ?? String(item.status).toLocaleUpperCase('ru-RU')}</strong>
                <p>Количество: {String(item.quantity)}</p>
              </article>
            ))}
          </div>
        )}

        {section === 'АРХИВ' && (
          <article aria-label="Архив вагона">
            <h3>АРХИВ ВАГОНА</h3>
            {archive.length === 0 ? (
              <p>Архив вагона пока пуст. Полученные материалы появятся здесь после синхронизации.</p>
            ) : (
              <div className="bunker-player-list">
                {archive.map((entry) => {
                  const artwork = archiveArtwork(entry);
                  return (
                    <article key={`${entry.scope}:${entry.artifactKey}`}>
                      {artwork && (
                        <BunkerResponsivePicture
                          asset={artwork}
                          className="bunker-player-archive__artwork"
                          testId="bunker-archive-artwork"
                          sizes="(max-width: 760px) calc(100vw - 3.3rem), 24rem"
                        />
                      )}
                      <h3>{entry.artifactKey.toLocaleUpperCase('ru-RU')}</h3>
                      <strong>{entry.contentType.toLocaleUpperCase('ru-RU')}</strong>
                      <p>{entry.decryptionStatus.toLocaleUpperCase('ru-RU')}</p>
                      <small>{entry.scope.toLocaleUpperCase('ru-RU')}</small>
                    </article>
                  );
                })}
              </div>
            )}
          </article>
        )}

        {section === 'СОСТОЯНИЕ' && (
          <article><h3>СОСТОЯНИЕ ВАГОНА</h3><p>ПИТАНИЕ · {String(runtime.wagonState.powerStatus).toLocaleUpperCase('ru-RU')}</p><p>СВЯЗЬ · {String(runtime.wagonState.communicationStatus).toLocaleUpperCase('ru-RU')}</p><p>НАВИГАЦИЯ · {String(runtime.wagonState.navigationStatus).toLocaleUpperCase('ru-RU')}</p></article>
        )}

        {section === 'ТЕКУЩЕЕ ЗАДАНИЕ' && (
          <article aria-label="Текущее задание">
            <h3>ТЕКУЩЕЕ ЗАДАНИЕ</h3>
            <dl className="bunker-player-mission-meta">
              <div><dt>Текущий этап</dt><dd>{runtime.game.state}</dd></div>
              {mission && <div><dt>Идентификатор задания</dt><dd>{mission.id}</dd></div>}
            </dl>
            {!mission && <p>Для текущего этапа активное задание не назначено.</p>}
          </article>
        )}
      </div>
    </section>
  );
}
