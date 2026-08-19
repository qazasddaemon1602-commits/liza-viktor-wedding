import type { MkMilestone } from './mkMilestones';

type MkMilestoneSceneProps = {
  milestone: MkMilestone;
};

export function MkMilestoneScene({ milestone }: MkMilestoneSceneProps) {
  return (
    <section className="mk-milestone-scene" aria-live="assertive" data-testid="mk-milestone-scene">
      <div className="mk-milestone-scene__index" aria-hidden="true">ARENA SIGNAL · LIVE</div>
      <div className="mk-milestone-scene__frame">
        <p className="eyebrow">{milestone.eyebrow}</p>
        <h1>{milestone.title}</h1>
        <p>{milestone.detail}</p>
        <div className="mk-milestone-scene__line" aria-hidden="true" />
      </div>
    </section>
  );
}
