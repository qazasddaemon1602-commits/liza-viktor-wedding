import type { BunkerMissionContent } from './v2/content/missionContent';
import type { BunkerMissionPlan } from './bunkerSession.service';
import type { GuestBunkerGlobalMissionAction } from './bunkerRuntime.service';

type Props = {
  content: BunkerMissionContent;
  availableItemKeys?: readonly string[];
  missionAction?: GuestBunkerGlobalMissionAction | null;
  missionPlan?: BunkerMissionPlan;
  wagonId?: string;
  showConsequences?: boolean;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function planRows(plan: BunkerMissionPlan): Record<string, unknown>[] {
  if (Array.isArray(plan)) return plan.filter(record);
  return record(plan) ? [plan] : [];
}

function wagonLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(record).flatMap((wagon) => {
    if (typeof wagon.label === 'string' && wagon.label.trim()) return [wagon.label];
    if (typeof wagon.number === 'number') return [`ВАГОН №${wagon.number}`];
    return [];
  });
}

function missionDetails(
  action: GuestBunkerGlobalMissionAction | null | undefined,
  plan: BunkerMissionPlan,
  wagonId: string | undefined,
): string[] {
  if (!action) return [];
  const requirements = action.requirements;
  const wagonPlan = planRows(plan).find((row) => !wagonId || row.wagonId === wagonId);

  if (action.missionState === 'MISSION_01') {
    const count = typeof requirements.exclusionCount === 'number'
      ? requirements.exclusionCount
      : wagonPlan?.exclusionCount;
    return typeof count === 'number'
      ? [`Квота вашего вагона: исключить ${count} сюжетных персонажей.`]
      : [];
  }

  if (action.missionState === 'MISSION_04') {
    const labels = wagonLabels(requirements.groupWagons);
    if (labels.length > 0) return [`Ваша группа связи: ${labels.join(' · ')}.`];
    const groups = record(plan) && Array.isArray(plan.groups) ? plan.groups : [];
    const group = groups.find((entry) => Array.isArray(entry) && (!wagonId || entry.includes(wagonId)));
    return Array.isArray(group) ? [`В вашей группе связи ${group.length} вагонов.`] : [];
  }

  if (action.missionState === 'MISSION_06') {
    const details: string[] = [];
    const labels = wagonLabels(requirements.requiredWagons);
    if (labels.length > 0) details.push(`Сверьте протокол с вагонами: ${labels.join(' · ')}.`);
    const fragment = typeof requirements.rewardFragment === 'string'
      ? requirements.rewardFragment
      : typeof action.submittedPayload?.rewardFragment === 'string'
        ? action.submittedPayload.rewardFragment
        : null;
    if (fragment) details.push(`Ваш фрагмент протокола: ${fragment}.`);
    if (!fragment && typeof wagonPlan?.fragmentIndex === 'number' && typeof wagonPlan.totalFragments === 'number') {
      details.push(`Ваш вагон получит фрагмент ${wagonPlan.fragmentIndex} из ${wagonPlan.totalFragments}.`);
    }
    return details;
  }

  return [];
}

function guestStep(step: string): string {
  if (/все капитаны/i.test(step)) {
    return 'После общего обсуждения один участник каждого вагона отправляет подтверждение.';
  }
  if (/капитан|один участник подтверждает/i.test(step)) {
    return 'После обсуждения один участник вагона отправляет решение со своего телефона.';
  }
  return step;
}

export function BunkerMissionBriefing({
  content,
  availableItemKeys,
  missionAction = null,
  missionPlan = null,
  wagonId,
  showConsequences = true,
}: Props) {
  const available = availableItemKeys == null
    ? content.items
    : content.items.filter((item) => availableItemKeys.includes(item.key));
  const details = missionDetails(missionAction, missionPlan, wagonId);
  return (
    <section className="bunker-mission-briefing" aria-label="Описание текущего задания">
      <header className="bunker-mission-briefing__header">
        <p>{content.intro.eyebrow}</p>
        <h2>{content.title}</h2>
        <strong>{content.intro.headline}</strong>
      </header>

      <article>
        <h3>ЧТО ПРОИСХОДИТ</h3>
        <p>{content.story}</p>
      </article>

      <article>
        <h3>ВАША ЦЕЛЬ</h3>
        <p>{content.goal}</p>
      </article>

      {details.length > 0 && (
        <article>
          <h3>ДАННЫЕ ВАШЕГО ВАГОНА</h3>
          {details.map((detail) => <p key={detail}>{detail}</p>)}
        </article>
      )}

      <article>
        <h3>ЧТО ДЕЛАТЬ</h3>
        <ol>
          {content.steps.map((step) => <li key={step}>{guestStep(step)}</li>)}
        </ol>
      </article>

      {available.length > 0 && (
        <article>
          <h3>{availableItemKeys == null ? 'ПРЕДМЕТЫ В ЭТОМ ЗАДАНИИ' : 'ДОСТУПНО В ВАШЕМ ВАГОНЕ'}</h3>
          <ul>
            {available.map((item) => (
              <li key={item.key} data-item-key={item.key}>
                <strong>{item.label}</strong>
                <span>{item.purpose}</span>
              </li>
            ))}
          </ul>
        </article>
      )}

      {showConsequences && (
        <article>
          <h3>ЧТО ИЗМЕНИТСЯ</h3>
          <ul>
            {content.consequences.map((consequence) => (
              <li key={consequence}>{consequence}</li>
            ))}
          </ul>
        </article>
      )}
    </section>
  );
}
