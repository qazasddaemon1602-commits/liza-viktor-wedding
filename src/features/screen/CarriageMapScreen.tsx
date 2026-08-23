import type { CSSProperties } from 'react';
import type {
  RegistrationCarriageMap,
  RegistrationCarriageMapCarriage,
} from './carriageMap.service';

type CarriageMapScreenProps = {
  map: RegistrationCarriageMap;
  variant?: 'compact' | 'full';
};

function seatDensity(guestCount: number): 'standard' | 'dense' | 'packed' {
  if (guestCount > 28) return 'packed';
  if (guestCount > 16) return 'dense';
  return 'standard';
}

function visualSeatCapacity(guestCount: number): number {
  if (guestCount >= 40) return 40;
  const withBreathingRoom = guestCount + 2;
  const nearestEven = Math.ceil(withBreathingRoom / 2) * 2;
  return Math.max(8, Math.min(40, nearestEven));
}

function CarriagePlan({ carriage }: { carriage: RegistrationCarriageMapCarriage }) {
  const seatCapacity = visualSeatCapacity(carriage.guests.length);
  const seatColumns = seatCapacity / 2;
  const emptySeatIndexes = Array.from(
    { length: seatCapacity - carriage.guests.length },
    (_, index) => carriage.guests.length + index + 1,
  );

  return (
    <article
      className="carriage-map__carriage"
      role="group"
      aria-label={carriage.label}
      data-seat-density={seatDensity(seatCapacity)}
      style={{
        '--carriage-map-accent': carriage.accentHex,
        '--seat-columns': seatColumns,
      } as CSSProperties}
    >
      <header className="carriage-map__carriage-head">
        <span className="carriage-map__mark" aria-hidden="true">{carriage.visualMark}</span>
        <strong>{carriage.label}</strong>
        <span>{carriage.guests.length} ПАСС.</span>
      </header>

      <div className="carriage-map__body">
        <span className="carriage-map__coupler carriage-map__coupler--left" aria-hidden="true" />
        <span className="carriage-map__coupler carriage-map__coupler--right" aria-hidden="true" />
        <div className="carriage-map__seats">
          <span className="carriage-map__aisle" data-testid="carriage-aisle" aria-hidden="true">
            <i />
          </span>

          {carriage.guests.map((guest) => {
            const seatColumn = Math.ceil(guest.seatIndex / 2);
            const seatRow = guest.seatIndex % 2 === 1 ? 1 : 3;
            return (
              <span
                key={guest.id}
                className="carriage-map__seat carriage-map__seat--occupied"
                role="img"
                data-seat-index={guest.seatIndex}
                aria-label={`Гость ${guest.initials}, место ${guest.seatIndex}, вагон ${carriage.number}`}
                style={{
                  '--seat-column': seatColumn,
                  '--seat-row': seatRow,
                } as CSSProperties}
              >
                {guest.initials}
              </span>
            );
          })}

          {emptySeatIndexes.map((seatIndex) => (
            <span
              key={`empty-${seatIndex}`}
              className="carriage-map__seat carriage-map__seat--empty"
              data-testid="empty-seat"
              aria-hidden="true"
              style={{
                '--seat-column': Math.ceil(seatIndex / 2),
                '--seat-row': seatIndex % 2 === 1 ? 1 : 3,
              } as CSSProperties}
            />
          ))}

          {carriage.guests.length === 0 && (
            <span className="carriage-map__vacant">СВОБОДНО</span>
          )}
        </div>
      </div>
    </article>
  );
}

export function CarriageMapScreen({ map, variant = 'full' }: CarriageMapScreenProps) {
  return (
    <section
      className={`carriage-map carriage-map--${variant} wedding-editorial-surface`}
      aria-label="Карта вагонов"
      data-variant={variant}
    >
      <header className="carriage-map__header">
        <div>
          <p className="carriage-map__eyebrow">ПОЕЗД ВИКТОРА · ПОСАДОЧНАЯ ВЕДОМОСТЬ</p>
          <h2>КАРТА СОСТАВА</h2>
        </div>
        <p className="carriage-map__progress">
          ЗАРЕГИСТРИРОВАНО {map.registeredGuestCount} ИЗ {map.expectedGuestCount}
        </p>
      </header>

      {map.carriages.length > 0 ? (
        <div
          className="carriage-map__grid"
          data-carriage-count={map.carriages.length}
        >
          {map.carriages.map((carriage) => (
            <CarriagePlan key={carriage.id} carriage={carriage} />
          ))}
        </div>
      ) : (
        <div className="carriage-map__empty" role="status">
          СОСТАВ ПОКА НЕ СФОРМИРОВАН
        </div>
      )}

      <footer className="carriage-map__footer">
        <span>ЛИЗА × ВИКТОР · 30 АВГУСТА 2026</span>
        {map.unassignedCount > 0 && (
          <strong>ОЖИДАЮТ НАЗНАЧЕНИЯ: {map.unassignedCount}</strong>
        )}
        <span>TYUMEN · SPECIAL SERVICE</span>
      </footer>
    </section>
  );
}
