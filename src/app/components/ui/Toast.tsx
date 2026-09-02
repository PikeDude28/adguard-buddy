"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Check, AlertCircle, Info, X } from 'lucide-react';

export type ToastTone = 'success' | 'error' | 'info';

type Toast = { id: number; tone: ToastTone; message: string };

type ToastContextValue = {
  /** Shows a toast; it auto-dismisses after `durationMs`. */
  notify: (message: string, tone?: ToastTone, durationMs?: number) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/** App-wide notifications. Replaces the per-page notification state. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
}

const TONE: Record<ToastTone, { icon: React.ReactNode; style: React.CSSProperties }> = {
  success: {
    icon: <Check className="h-4 w-4" />,
    style: { background: 'var(--success-soft)', color: 'var(--success)', borderColor: 'var(--success-border)' },
  },
  error: {
    icon: <AlertCircle className="h-4 w-4" />,
    style: { background: 'var(--danger-soft)', color: 'var(--danger)', borderColor: 'var(--danger-border)' },
  },
  info: {
    icon: <Info className="h-4 w-4" />,
    style: { background: 'var(--info-soft)', color: 'var(--info)', borderColor: 'var(--info-border)' },
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts(current => current.filter(t => t.id !== id));
  }, []);

  const notify = useCallback((message: string, tone: ToastTone = 'info', durationMs = 5000) => {
    const id = nextId.current++;
    setToasts(current => [...current, { id, tone, message }]);
    if (durationMs > 0) {
      setTimeout(() => dismiss(id), durationMs);
    }
  }, [dismiss]);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-4"
        role="status"
        aria-live="polite"
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full items-start gap-2.5 rounded-[var(--radius)] border px-3.5 py-2.5 text-[13px] backdrop-blur"
            style={{ ...TONE[toast.tone].style, boxShadow: 'var(--shadow-2)' }}
          >
            <span className="mt-px flex-shrink-0">{TONE[toast.tone].icon}</span>
            <span className="min-w-0 flex-1 break-words">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="flex-shrink-0 opacity-60 transition-opacity hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
