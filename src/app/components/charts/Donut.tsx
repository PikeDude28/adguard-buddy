"use client";

import React from 'react';

export type DonutSegment = { name: string; value: number; color: string };

type Props = {
  data: DonutSegment[];
  centerLabel: string;
  size?: number;
};

/** Share-of-total ring with a centred total and a value legend. */
export function Donut({ data, centerLabel, size = 148 }: Props) {
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, segment) => sum + segment.value, 0);

  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label={centerLabel}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface-3)"
            strokeWidth={strokeWidth}
          />
          {total > 0 && data.map(segment => {
            const share = segment.value / total;
            const dash = circumference * share;
            const dashOffset = -circumference * offset;
            offset += share;
            if (dash <= 0) return null;
            return (
              <circle
                key={segment.name}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={dashOffset}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-[22px] font-semibold leading-none text-[var(--text)]">
            {total.toLocaleString()}
          </span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">
            {centerLabel}
          </span>
        </div>
      </div>

      <div className="w-full space-y-1.5">
        {data.map(segment => (
          <div key={segment.name} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex items-center gap-2 text-[var(--text-muted)]">
              <span className="h-2 w-2 rounded-sm" style={{ background: segment.color }} />
              {segment.name}
            </span>
            <span className="tabular text-[var(--text)]">
              {segment.value.toLocaleString()}
              <span className="ml-1.5 text-[var(--text-subtle)]">
                {total > 0 ? `${((segment.value / total) * 100).toFixed(1)}%` : '—'}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
