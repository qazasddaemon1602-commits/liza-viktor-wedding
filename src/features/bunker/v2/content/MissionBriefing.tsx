import type { BunkerMissionContent } from './missionContent';

type Props = { content: BunkerMissionContent };

export function MissionBriefing({ content }: Props) {
  return (
    <section className="bunker-mission-briefing" aria-label="Брифинг задания">
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
        <ol>{content.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      </article>
      {content.items.length > 0 && (
        <article>
          <h3>ПРЕДМЕТЫ В ЗАДАНИИ</h3>
          <ul>
            {content.items.map((item) => <li key={item.key}>{item.key}: {item.purpose}</li>)}
          </ul>
        </article>
      )}
    </section>
  );
}
