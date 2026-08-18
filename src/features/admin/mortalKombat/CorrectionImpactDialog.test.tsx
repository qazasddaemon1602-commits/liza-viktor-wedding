import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CorrectionImpactDialog } from './CorrectionImpactDialog';

describe('CorrectionImpactDialog', () => {
  it('names completed downstream matches before destructive correction', () => {
    render(
      <CorrectionImpactDialog
        affected={[
          { matchId: 'qf1', matchKey: 'qf-1', round: 'qf', position: 1 },
          { matchId: 'sf1', matchKey: 'sf-1', round: 'sf', position: 1 },
        ]}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText(/изменение затронет/i)).toBeInTheDocument();
    expect(screen.getByText('1/4 ФИНАЛА · БОЙ 1')).toBeInTheDocument();
    expect(screen.getByText('1/2 ФИНАЛА · БОЙ 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'СБРОСИТЬ ЗАТРОНУТЫЕ РЕЗУЛЬТАТЫ' })).toBeInTheDocument();
  });
});