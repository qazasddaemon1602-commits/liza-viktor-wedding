import type { BunkerMissionContent } from '../../bunker/v2/missionContent';

type MissionHostScriptProps = {
  content: BunkerMissionContent;
  /** Опциональный статус текущей миссии из owner read-model. */
  statusLine?: string;
};

/**
 * Сценарий ведущего для текущей миссии Бункера.
 * Только чтение контентного слоя: команд и RPC здесь нет.
 */
export function MissionHostScript({ content, statusLine }: MissionHostScriptProps) {
  return (
    <section
      className="admin-bunker-host-script"
      aria-label="Сценарий ведущего"
      data-testid="admin-bunker-host-script"
    >
      <header className="admin-bunker-host-script__header">
        <p>СЦЕНАРИЙ ВЕДУЩЕГО</p>
        <h3>{content.code} · {content.title}</h3>
        {statusLine && <span className="admin-bunker-host-script__status">{statusLine}</span>}
      </header>

      <div className="admin-bunker-host-script__block">
        <h4>ЧТО ПРОИСХОДИТ ПО СЮЖЕТУ</h4>
        <p>{content.story}</p>
      </div>

      <div className="admin-bunker-host-script__block">
        <h4>ТЕКСТ ВЕДУЩЕГО</h4>
        <ul>
          {content.host.say.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </div>

      <div className="admin-bunker-host-script__block">
        <h4>ЕСЛИ ГОСТИ ЗАСТРЯЛИ</h4>
        <ol>
          {content.host.hints.map((hint) => <li key={hint}>{hint}</li>)}
        </ol>
      </div>

      <div className="admin-bunker-host-script__block">
        <h4>ПОСЛЕ ЗАВЕРШЕНИЯ</h4>
        <p>{content.host.afterCompletion}</p>
      </div>
    </section>
  );
}
