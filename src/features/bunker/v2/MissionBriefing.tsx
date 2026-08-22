import type { BunkerMissionContent } from './missionContent';

type MissionBriefingProps = {
  content: BunkerMissionContent;
};

/**
 * Сюжетный брифинг перед механикой задания.
 * Только презентация: ничего не отправляет и не меняет состояние задания.
 */
export function MissionBriefing({ content }: MissionBriefingProps) {
  return (
    <div className="bunker-mission-briefing" data-testid="bunker-mission-briefing">
      <section className="bunker-mission-briefing__block">
        <h3>ЧТО ПРОИСХОДИТ</h3>
        <p>{content.story}</p>
      </section>

      <section className="bunker-mission-briefing__block">
        <h3>ВАША ЦЕЛЬ</h3>
        <p>{content.goal}</p>
      </section>

      <section className="bunker-mission-briefing__block">
        <h3>ЧТО ДЕЛАТЬ</h3>
        <ol>
          {content.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </section>

      {content.items.length > 0 && (
        <section className="bunker-mission-briefing__block">
          <h3>ИСПОЛЬЗУЕТСЯ В ЗАДАНИИ</h3>
          <ul className="bunker-mission-briefing__items">
            {content.items.map((item) => (
              <li key={item.key}>
                <strong>{item.label}</strong>
                <span>{item.purpose}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
