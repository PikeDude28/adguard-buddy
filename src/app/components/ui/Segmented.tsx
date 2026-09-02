import React from 'react';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
};

type SegmentedProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  /** Accessible name for the group. */
  label: string;
  size?: 'sm' | 'md';
};

/** Two-to-four mutually exclusive choices. Replaces the ad-hoc toggle pairs. */
export function Segmented<T extends string>({ value, onChange, options, label, size = 'md' }: SegmentedProps<T>) {
  const height = size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]';
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex items-center gap-0.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-0.5"
    >
      {options.map(option => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={active}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={`inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${height}`}
            style={
              active
                ? { background: 'var(--surface-3)', color: 'var(--text)' }
                : { color: 'var(--text-subtle)' }
            }
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
