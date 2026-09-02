import React from 'react';
import { Card } from './Card';

type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const ICON_TONE: Record<Tone, { background: string; color: string }> = {
  accent: { background: 'var(--accent-soft)', color: 'var(--accent)' },
  success: { background: 'var(--success-soft)', color: 'var(--success)' },
  warning: { background: 'var(--warning-soft)', color: 'var(--warning)' },
  danger: { background: 'var(--danger-soft)', color: 'var(--danger)' },
  info: { background: 'var(--info-soft)', color: 'var(--info)' },
  neutral: { background: 'var(--surface-3)', color: 'var(--text-muted)' },
};

type StatTileProps = {
  label: string;
  value: React.ReactNode;
  unit?: string;
  /** Secondary figure shown next to the value, e.g. a percentage. */
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: Tone;
  children?: React.ReactNode;
};

/**
 * A single headline figure. The label is small and quiet, the number is the
 * loudest thing in the tile - the opposite of the old cards where the page
 * title and the KPI competed at the same size.
 */
export function StatTile({ label, value, unit, hint, icon, tone = 'neutral', children }: StatTileProps) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">
          {label}
        </span>
        {icon && (
          <span
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--radius)]"
            style={ICON_TONE[tone]}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="tabular text-[28px] font-semibold leading-none tracking-tight text-[var(--text)]">
          {value}
        </span>
        {unit && <span className="text-sm text-[var(--text-subtle)]">{unit}</span>}
        {hint && <span className="ml-1 text-[13px] text-[var(--text-muted)]">{hint}</span>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </Card>
  );
}
