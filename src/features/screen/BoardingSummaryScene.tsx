import type { BoardingSummaryPresentation } from './arrivalAnnouncementQueue';
import { CarriageMapScreen } from './CarriageMapScreen';
import type { RegistrationCarriageMap } from './carriageMap.service';

type BoardingSummarySceneProps = {
  summary: BoardingSummaryPresentation;
  map: RegistrationCarriageMap | null;
};

function accessibleDistribution(summary: BoardingSummaryPresentation, map: RegistrationCarriageMap | null) {
  if (!map) return 'Карта состава обновляется.';
  return map.carriages
    .filter((carriage) => summary.carriageIds.includes(carriage.id))
    .map((carriage) => `${carriage.label} — ${carriage.guests.length} пассажира`)
    .join('. ');
}

export function BoardingSummaryScene({ summary, map }: BoardingSummarySceneProps) {
  return (
    <section className="boarding-summary-scene" aria-label="Сводка посадки">
      <header className="boarding-summary-scene__header">
        <p>ПОЕЗД ВИКТОРА · ПОСАДКА</p>
        <h1>СОСТАВ ПОПОЛНЕН · +{summary.count}</h1>
      </header>
      {map && <CarriageMapScreen map={map} variant="summary" />}
      <p className="sr-only" role="status" aria-live="assertive" aria-atomic="true">
        Состав пополнен: {summary.count} пассажира. {accessibleDistribution(summary, map)}
      </p>
    </section>
  );
}
