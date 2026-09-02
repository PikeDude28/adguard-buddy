"use client";

import React, { useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './Button';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  /** Shown under the title, e.g. a live status line. */
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
};

const SIZES = { md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-5xl' };

/**
 * Accessible dialog: Escape closes it, focus is trapped inside while open, and
 * focus returns to whatever opened it. The old per-page modals had none of this.
 */
export function Modal({ open, onClose, title, subtitle, children, footer, size = 'lg' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;

    // `offsetParent` is unreliable here (it is null inside fixed-position
    // containers and in jsdom), so filter on the attributes that actually
    // remove an element from the tab order.
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const node = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    node?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        onKeyDown={handleKeyDown}
        className={`card flex max-h-[85vh] w-full ${SIZES[size]} flex-col overflow-hidden`}
        style={{ boxShadow: 'var(--shadow-2)' }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-[var(--text)]">{title}</h2>
            {subtitle && <div className="mt-1 text-[13px] text-[var(--text-subtle)]">{subtitle}</div>}
          </div>
          <IconButton icon={<X className="h-4 w-4" />} label="Close dialog" onClick={onClose} />
        </div>

        <div className="min-h-0 flex-1 overflow-auto">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: 'primary' | 'danger';
};

export function ConfirmDialog({
  open, title, description, confirmLabel, onConfirm, onCancel, tone = 'primary',
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-2)] px-4 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-3)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-9 items-center rounded-[var(--radius)] px-4 text-sm font-semibold transition-colors"
            style={
              tone === 'danger'
                ? { background: 'var(--danger)', color: '#1A0505' }
                : { background: 'var(--accent)', color: 'var(--accent-contrast)' }
            }
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="px-5 py-4 text-sm text-[var(--text-muted)]">{description}</div>
    </Modal>
  );
}
