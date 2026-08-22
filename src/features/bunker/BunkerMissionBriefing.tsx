import type { BunkerMissionContent } from './v2/content/missionContent';

type Props = {
  content: BunkerMissionContent;
};

export function BunkerMissionBriefing({ content }: Props) {
  return (
    <section className="bunker-mission-briefing" aria-label="Описание текущего задания">
      <article>
        <h3>ЧТО ПРОИСХОДИТ</h3>
        <p>{content.story}</p>
      </article>

      <article>
        <h3>ВАША ЦЕЛЬ</h3>
        <p>{content.goal}</p>
      </article>

      <article>
        <h3>ЧТО ДЕЛАТЬ</h3>
        <ol>
          {content.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </article>

      {content.items.length > 0 && (
        <article>
          <h3>ПРЕДМЕТЫ И РОЛИ</h3>
          <ul>
            {content.items.map((item) => (
              <li key={item.key}>
                <strong>{item.key.toUpperCase()}</strong>
                <span>{item.purpose}</span>
              </li>
            ))}
          </ul>
        </article>
      )}
    </section>
  );
}
