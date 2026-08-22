import type { ReactNode } from 'react';

type SceneTransitionProps = {
  sceneKey: string;
  label: string;
  tone?: 'sage' | 'wine' | 'gold';
  children?: ReactNode;
  className?: string;
};

export function SceneTransition({
  sceneKey,
  label,
  tone = 'sage',
  children,
  className = '',
}: SceneTransitionProps) {
  const overlayOnly = children === undefined;
  return (
    <div
      key={sceneKey}
      className={`scene-transition scene-transition--${tone}${overlayOnly ? ' scene-transition--overlay-only' : ''}${className ? ` ${className}` : ''}`}
      data-scene-key={sceneKey}
      data-testid="scene-transition"
    >
      <div className="scene-transition__wipe" aria-hidden="true">
        <span aria-hidden="true">{label}</span>
        <i />
      </div>
      {!overlayOnly && <div className="scene-transition__content">{children}</div>}
    </div>
  );
}
