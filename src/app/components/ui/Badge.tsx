import React from 'react';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const TONE_STYLES: Record<BadgeTone, React.CSSProperties> = {
  neutral: { background: 'var(--surface-3)', color: 'var(--text-muted)', borderColor: 'var(--border-strong)' },
  accent: { background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--accent-border)' },
  success: { background: 'var(--success-soft)', color: 'var(--success)', borderColor: 'var(--success-border)' },
  warning: { background: 'var(--warning-soft)', color: 'var(--warning)', borderColor: 'var(--warning-border)' },
  danger: { background: 'var(--danger-soft)', color: 'var(--danger)', borderColor: 'var(--danger-border)' },
  info: { background: 'var(--info-soft)', color: 'var(--info)', borderColor: 'var(--info-border)' },
};

type BadgeProps = {
  tone?: BadgeTone;
  /** Renders a leading dot; `pulse` marks it as live. */
  dot?: boolean;
  pulse?: boolean;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

/**
 * The single status vocabulary for the app. Anything that used to be a pill,
 * an ad-hoc span or an emoji marker goes through here.
 */
export function Badge({ tone = 'neutral', dot = false, pulse = false, icon, className = '', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 py-0.5 text-[11px] font-medium leading-5 whitespace-nowrap ${className}`}
      style={TONE_STYLES[tone]}
    >
      {dot && (
        <span className="relative inline-flex h-1.5 w-1.5 flex-shrink-0">
          <span className="absolute inset-0 rounded-full bg-current" />
          {pulse && <span className="live-dot absolute inset-0 rounded-full" />}
        </span>
      )}
      {icon}
      {children}
    </span>
  );
}
