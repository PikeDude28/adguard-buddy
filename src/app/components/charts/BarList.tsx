"use client";

import React from 'react';

export type BarListItem = {
  name: string;
  value: number;
  icon?: React.ReactNode;
  /** Formatted display value; falls back to a localized number. */
  display?: string;
};

type Props = {
  items: BarListItem[];
  color?: string;
  /** Denominator for the bar widths. Defaults to the largest item. */
  maxValue?: number;
};

/**
 * Ranked list where the bar is the row background rather than a separate
 * element - less furniture per row than the old icon + bar + label stack.
 */
export function BarList({ items, color = 'var(--accent)', maxValue }: Props) {
  const max = maxValue ?? Math.max(...items.map(i => i.value), 1);

  return (
    <ul className="space-y-1">
      {items.map((item, index) => {
        const share = max > 0 ? Math.min(100, (item.value / max) * 100) : 0;
        return (
          <li key={`${item.name}-${index}`} className="relative overflow-hidden rounded-[var(--radius-sm)]">
            <div
              className="absolute inset-y-0 left-0 transition-[width] duration-500"
              style={{ width: `${share}%`, background: color, opacity: 0.14 }}
              aria-hidden="true"
            />
            <div className="relative flex items-center justify-between gap-3 px-2.5 py-2">
              <span className="flex min-w-0 items-center gap-2">
                {item.icon && <span className="flex-shrink-0 text-[var(--text-subtle)]">{item.icon}</span>}
                <span className="truncate text-[13px] text-[var(--text)]" title={item.name}>
                  {item.name}
                </span>
              </span>
              <span className="tabular flex-shrink-0 text-[13px] text-[var(--text-muted)]">
                {item.display ?? item.value.toLocaleString()}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
