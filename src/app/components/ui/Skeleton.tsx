import React from 'react';
import { Card } from './Card';

export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

/** Placeholder shaped like a StatTile so the layout does not jump on load. */
export function StatTileSkeleton() {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-8 rounded-[var(--radius)]" />
      </div>
      <Skeleton className="mt-4 h-7 w-28" />
    </Card>
  );
}

export function CardSkeleton({ rows = 4, height = 200 }: { rows?: number; height?: number }) {
  return (
    <Card>
      <Skeleton className="h-4 w-40" />
      <div className="mt-5 space-y-3" style={{ minHeight: height }}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </Card>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}
