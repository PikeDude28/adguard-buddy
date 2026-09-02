"use client";

import React, { useMemo, useState } from 'react';
import { useElementWidth } from '../../hooks/useElementWidth';
import {
  axisTicks, bucketTimestamps, compactNumber, formatBucketLabel, niceMax, type TimeUnit,
} from './scale';

export type Series = {
  name: string;
  values: number[];
  color: string;
};

type Props = {
  series: Series[];
  unit: TimeUnit;
  height?: number;
  /** Timestamp of the most recent bucket. Injectable for deterministic tests. */
  now?: number;
};

const PADDING = { top: 8, right: 4, bottom: 22, left: 40 };

/**
 * Stacked bar chart over time with a real value axis, gridlines and a hover
 * readout. Bucket labels are derived from the array length and the unit the
 * API reports, so they describe the data instead of a fixed 24h window.
 */
export function TimeSeriesChart({ series, unit, height = 200, now }: Props) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [hovered, setHovered] = useState<number | null>(null);

  const length = series.reduce((max, s) => Math.max(max, s.values.length), 0);
  const timestamps = useMemo(() => bucketTimestamps(length, unit, now), [length, unit, now]);

  const totals = useMemo(
    () => Array.from({ length }, (_, i) => series.reduce((sum, s) => sum + (s.values[i] || 0), 0)),
    [series, length],
  );

  const maxTotal = niceMax(Math.max(...totals, 0));
  const ticks = axisTicks(maxTotal);

  const plotWidth = Math.max(width - PADDING.left - PADDING.right, 10);
  const plotHeight = height - PADDING.top - PADDING.bottom;
  const slot = length > 0 ? plotWidth / length : plotWidth;
  const barWidth = Math.max(slot - 2, 1);

  const yFor = (value: number) => PADDING.top + plotHeight - (value / maxTotal) * plotHeight;

  // Label roughly every 4th bucket, and always the newest one.
  const labelEvery = Math.max(1, Math.ceil(length / 6));

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${series.map(s => s.name).join(' and ')} per ${unit === 'days' ? 'day' : 'hour'}`}
        onMouseLeave={() => setHovered(null)}
      >
        {ticks.map(tick => (
          <g key={tick}>
            <line
              x1={PADDING.left}
              x2={PADDING.left + plotWidth}
              y1={yFor(tick)}
              y2={yFor(tick)}
              stroke="var(--grid)"
              strokeWidth={1}
            />
            <text
              x={PADDING.left - 8}
              y={yFor(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              fill="var(--text-subtle)"
              fontSize={10}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {compactNumber(tick)}
            </text>
          </g>
        ))}

        {Array.from({ length }).map((_, index) => {
          const x = PADDING.left + index * slot + (slot - barWidth) / 2;
          let cursor = PADDING.top + plotHeight;

          return (
            <g
              key={index}
              onMouseEnter={() => setHovered(index)}
              onFocus={() => setHovered(index)}
            >
              {/* Full-height hit area so thin bars are still easy to hover. */}
              <rect
                x={PADDING.left + index * slot}
                y={PADDING.top}
                width={slot}
                height={plotHeight}
                fill={hovered === index ? 'rgba(255,255,255,0.04)' : 'transparent'}
              />
              {series.map(s => {
                const value = s.values[index] || 0;
                const barHeight = maxTotal > 0 ? (value / maxTotal) * plotHeight : 0;
                cursor -= barHeight;
                if (barHeight <= 0) return null;
                return (
                  <rect
                    key={s.name}
                    x={x}
                    y={cursor}
                    width={barWidth}
                    height={barHeight}
                    fill={s.color}
                    opacity={hovered === null || hovered === index ? 1 : 0.45}
                    rx={1.5}
                  />
                );
              })}
            </g>
          );
        })}

        <line
          x1={PADDING.left}
          x2={PADDING.left + plotWidth}
          y1={PADDING.top + plotHeight}
          y2={PADDING.top + plotHeight}
          stroke="var(--border)"
          strokeWidth={1}
        />

        {timestamps.map((date, index) => {
          if (index % labelEvery !== 0 && index !== length - 1) return null;
          return (
            <text
              key={index}
              x={PADDING.left + index * slot + slot / 2}
              y={height - 6}
              textAnchor={index === length - 1 ? 'end' : 'middle'}
              fill="var(--text-subtle)"
              fontSize={10}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatBucketLabel(date, unit)}
            </text>
          );
        })}
      </svg>

      {hovered !== null && timestamps[hovered] && (
        <div
          className="pointer-events-none absolute z-10 rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-2.5 py-2 text-[12px] shadow-lg"
          style={{
            background: 'var(--surface-3)',
            top: 4,
            left: Math.min(
              Math.max(PADDING.left + hovered * slot + slot / 2 - 70, 0),
              Math.max(width - 140, 0),
            ),
            width: 140,
          }}
        >
          <div className="mb-1 text-[var(--text-subtle)]">
            {formatBucketLabel(timestamps[hovered], unit)}
          </div>
          {series.map(s => (
            <div key={s.name} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                {s.name}
              </span>
              <span className="tabular text-[var(--text)]">
                {(s.values[hovered] || 0).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChartLegend({ series }: { series: Series[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {series.map(s => (
        <span key={s.name} className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
          <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}
