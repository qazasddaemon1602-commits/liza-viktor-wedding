import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MkResetDialog } from './MkResetDialog';

describe('MkResetDialog', () => {
  it('starts on safe Cancel, resets input on every open and returns focus to its opener', async () => {
    const user = userEvent.setup();
    const confirm = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>СБРОСИТЬ ТУРНИР</button>
          {open && <MkResetDialog busy={false} onCancel={() => setOpen(false)} onConfirm={confirm} />}
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'СБРОСИТЬ ТУРНИР' });

    await user.click(opener);
    expect(screen.getByRole('button', { name: 'ОТМЕНА' })).toHaveFocus();
    await user.type(screen.getByRole('textbox'), 'СБРОСИТЬ ТУРНИР');
    await user.keyboard('{Escape}');
    expect(opener).toHaveFocus();

    await user.click(opener);
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('does not close on Escape while a reset is busy', async () => {
    const user = userEvent.setup();
    render(<MkResetDialog busy onCancel={vi.fn()} onConfirm={vi.fn()} />);
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
