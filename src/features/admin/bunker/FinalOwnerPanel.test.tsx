import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FinalOwnerPanel } from './FinalOwnerPanel';

const baseModel = {
  remainingSeconds: 600,
  solved: 3,
  total: 5,
  wrongAttempts: 2,
  unlocked: false,
  hintLevel: 1,
};

describe('FinalOwnerPanel', () => {
  it('offers only safe facilitator controls and hides final answers', () => {
    const { container } = render(
      <FinalOwnerPanel
        model={baseModel}
        onAddTime={vi.fn()}
        onHint={vi.fn()}
        onEmergencyOpen={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: '+2 МИНУТЫ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ДАТЬ ПОДСКАЗКУ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'АВАРИЙНО ОТКРЫТЬ' })).toBeInTheDocument();
    expect(screen.queryByText('4719')).not.toBeInTheDocument();
    expect(screen.queryByText('LV0830')).not.toBeInTheDocument();
    expect(container.querySelector('.admin-bunker-final')).not.toHaveClass('is-unlocked');
  });

  it('marks the owner final panel unlocked only after the bunker is open', () => {
    const { container } = render(
      <FinalOwnerPanel model={{ ...baseModel, unlocked: true }} />,
    );
    expect(container.querySelector('.admin-bunker-final')).toHaveClass('is-unlocked');
    expect(screen.getByRole('button', { name: '+2 МИНУТЫ' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'ДАТЬ ПОДСКАЗКУ' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'АВАРИЙНО ОТКРЫТЬ' })).toBeDisabled();
  });
});
