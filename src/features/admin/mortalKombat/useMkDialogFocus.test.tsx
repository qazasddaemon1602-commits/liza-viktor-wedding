import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useMkDialogFocus } from './useMkDialogFocus';

function Harness({ busy = false }: { busy?: boolean }) {
  const focus = useMkDialogFocus({ busy, onEscape: vi.fn() });
  return (
    <section ref={focus.dialogRef} role="dialog">
      <button type="button" ref={focus.initialFocusRef}>ОТМЕНА</button>
      <button type="button">ПОДТВЕРДИТЬ</button>
    </section>
  );
}

describe('useMkDialogFocus', () => {
  it('contains forward and reverse Tab focus within the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const cancel = screen.getByRole('button', { name: 'ОТМЕНА' });
    const confirm = screen.getByRole('button', { name: 'ПОДТВЕРДИТЬ' });
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
  });
});
