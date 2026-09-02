import { render, screen, fireEvent } from '@testing-library/react';
import { Modal, ConfirmDialog } from '../Modal';

describe('Modal', () => {
  const onClose = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when closed', () => {
    const { container } = render(
      <Modal open={false} onClose={onClose} title="Hidden"><p>Body</p></Modal>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('exposes itself as a modal dialog with an accessible name', () => {
    render(<Modal open onClose={onClose} title="Sync log"><p>Body</p></Modal>);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Sync log');
  });

  it('closes on Escape', () => {
    render(<Modal open onClose={onClose} title="T"><p>Body</p></Modal>);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop is clicked but not the panel', () => {
    render(<Modal open onClose={onClose} title="T"><p>Body</p></Modal>);

    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('moves focus into the dialog when it opens', () => {
    render(
      <Modal open onClose={onClose} title="T">
        <button type="button">Inside</button>
      </Modal>,
    );

    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('wraps focus at both ends of the tab order', () => {
    render(
      <Modal open onClose={onClose} title="T" footer={<button type="button">Last</button>}>
        <button type="button">First</button>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    const focusable = Array.from(dialog.querySelectorAll('button'));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    last.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('locks and restores body scrolling', () => {
    const { unmount } = render(<Modal open onClose={onClose} title="T"><p>Body</p></Modal>);
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('renders a subtitle and a footer', () => {
    render(
      <Modal open onClose={onClose} title="T" subtitle="Running…" footer={<span>Footer</span>}>
        <p>Body</p>
      </Modal>,
    );

    expect(screen.getByText('Running…')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  it('reports confirm and cancel separately', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();

    render(
      <ConfirmDialog
        open
        title="Delete server"
        description="This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancels on Escape', () => {
    const onCancel = jest.fn();
    render(
      <ConfirmDialog
        open title="T" description="D" confirmLabel="Go"
        onConfirm={jest.fn()} onCancel={onCancel}
      />,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
