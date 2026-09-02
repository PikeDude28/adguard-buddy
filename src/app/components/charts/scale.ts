/** Shared helpers for the chart components. */

/** Rounds a maximum up to a readable axis bound (1/2/5 x 10^n). */
export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const magnitude = Math.pow(10, exponent);
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

/** Evenly spaced axis ticks from 0 to `max`, inclusive. */
export function axisTicks(max: number, count = 4): number[] {
  const bound = niceMax(max);
  return Array.from({ length: count + 1 }, (_, i) => (bound / count) * i);
}

/** 1234567 -> "1.2M", 12300 -> "12.3k". Keeps axis labels narrow. */
export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(value));
}

export type TimeUnit = 'hours' | 'days';

/**
 * Timestamps for a stats array where the LAST entry is the current bucket.
 * The old chart hard-coded 00:00-24:00 labels regardless of when the data
 * actually started, which mislabelled every point.
 */
export function bucketTimestamps(length: number, unit: TimeUnit, now = Date.now()): Date[] {
  const step = unit === 'days' ? 86_400_000 : 3_600_000;
  return Array.from({ length }, (_, i) => new Date(now - (length - 1 - i) * step));
}

export function formatBucketLabel(date: Date, unit: TimeUnit): string {
  return unit === 'days'
    ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
