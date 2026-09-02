"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, AlertCircle, Check } from 'lucide-react';
import type { SyncLogEntry } from '@/types/auto-sync';

/**
 * Surfaces recent auto-sync failures. The previous header bell was decorative;
 * this one reports state the app already tracks.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [failures, setFailures] = useState<SyncLogEntry[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/auto-sync-config');
      if (!response.ok) return;
      const data = await response.json();
      const logs: SyncLogEntry[] = data.recentLogs || [];
      setFailures(logs.filter(log => log.status === 'error').slice(-8).reverse());
    } catch {
      /* the bell is informational - a failed poll should not surface an error */
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label={failures.length > 0 ? `Notifications (${failures.length} sync errors)` : 'Notifications'}
        aria-expanded={open}
        className="relative flex h-8 w-8 items-center justify-center rounded-[var(--radius)] text-[var(--text-subtle)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
        {failures.length > 0 && (
          <span
            className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--danger)' }}
          />
        )}
      </button>

      {open && (
        <div
          className="card absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden"
          style={{ boxShadow: 'var(--shadow-2)' }}
        >
          <div className="border-b border-[var(--border)] px-4 py-2.5 text-[13px] font-semibold text-[var(--text)]">
            Auto-sync
          </div>
          {failures.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-4 text-[13px] text-[var(--text-subtle)]">
              <Check className="h-4 w-4 text-[var(--success)]" aria-hidden="true" />
              No recent sync errors.
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {failures.map((failure, index) => (
                <li key={index} className="border-b border-[var(--border)] px-4 py-2.5 last:border-b-0">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--danger)]" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-[var(--text)]">
                        {failure.category} → {failure.replicaId}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[12px] text-[var(--text-subtle)]">{failure.message}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/sync-status"
            onClick={() => setOpen(false)}
            className="block border-t border-[var(--border)] px-4 py-2.5 text-[13px] font-medium text-[var(--accent)] hover:bg-[var(--surface-2)]"
          >
            Open sync history
          </Link>
        </div>
      )}
    </div>
  );
}
