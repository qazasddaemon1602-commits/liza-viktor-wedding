import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('focuses safe cancel, traps Tab, closes on Escape and returns focus to the opener', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>ИСПРАВИТЬ</button>
          {open && (
            <CorrectionImpactDialog
              affected={[]}
              onCancel={() => setOpen(false)}
              onConfirm={vi.fn()}
            />
          )}
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'ИСПРАВИТЬ' });
    await user.click(opener);

    const cancel = screen.getByRole('button', { name: 'ОТМЕНА' });
    const confirm = screen.getByRole('button', { name: 'СБРОСИТЬ ЗАТРОНУТЫЕ РЕЗУЛЬТАТЫ' });
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
