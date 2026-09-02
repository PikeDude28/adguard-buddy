"use client";

import React from 'react';

type Props = {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  ariaLabel?: string;
};

/**
 * A compact trend line for a table row. Deliberately axis-free: it shows shape,
 * and the exact figures live in the adjacent columns.
 */
export function Sparkline({
  values, width = 96, height = 24, color = 'var(--accent)', ariaLabel = 'Trend',
}: Props) {
  // Called before the early return so the hook order stays stable.
  const gradientId = `spark-${React.useId().replace(/:/g, '')}`;

  if (values.length < 2) {
    return <div style={{ width, height }} aria-hidden="true" />;
  }

  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const yFor = (value: number) => height - 1 - (value / max) * (height - 2);

  const line = values.map((value, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)},${yFor(value).toFixed(2)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg width={width} height={height} role="img" aria-label={ariaLabel} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
