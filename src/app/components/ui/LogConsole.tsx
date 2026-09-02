"use client";

import React, { useEffect, useRef } from 'react';

/**
 * Streamed log output for the sync and block/unblock dialogs.
 * Auto-scrolls to the newest line while the stream is open.
 */
export function LogConsole({ lines, running }: { lines: string[]; running: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Guarded: jsdom and older browsers do not implement scrollIntoView.
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [lines]);

  const toneFor = (line: string) => {
    if (line.startsWith('ERROR') || line.startsWith('FATAL') || line.startsWith('Failed') || line.includes('SYNC ERROR')) {
      return 'var(--danger)';
    }
    if (line.includes('Done.') || line.startsWith('Successfully')) return 'var(--success)';
    return 'var(--text-muted)';
  };

  return (
    <div
      className="h-full px-5 py-4 font-mono text-[12.5px] leading-relaxed"
      style={{ background: 'var(--bg)' }}
    >
      {lines.map((line, index) => (
        <div key={index} style={{ color: toneFor(line) }}>
          <span className="select-none text-[var(--text-subtle)]">$ </span>
          {line}
        </div>
      ))}
      {running && (
        <div className="mt-2 flex items-center gap-2 text-[var(--text-subtle)]">
          <span className="relative inline-flex h-1.5 w-1.5 text-[var(--accent)]">
            <span className="absolute inset-0 rounded-full bg-current" />
            <span className="live-dot absolute inset-0 rounded-full" />
          </span>
          <span className="text-[12px]">Waiting for output…</span>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
