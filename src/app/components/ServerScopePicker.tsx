"use client";

import React from 'react';
import { Server, Layers } from 'lucide-react';
import { connectionLabel, useConnections } from '../contexts/ConnectionsContext';
import { Segmented } from './ui/Segmented';

/**
 * The single place where "which server am I looking at" is chosen.
 * Every page reads this scope instead of shipping its own selector.
 */
export function ServerScopePicker() {
  const { connections, mode, setMode, selectedId, setSelectedId, isLoading } = useConnections();

  if (isLoading || connections.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {connections.length > 1 && (
        <Segmented
          label="Server scope"
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'single', label: 'Single', icon: <Server className="h-3.5 w-3.5" /> },
            { value: 'combined', label: 'All', icon: <Layers className="h-3.5 w-3.5" /> },
          ]}
        />
      )}

      {mode === 'single' && (
        <>
          <label htmlFor="global-server-select" className="sr-only">Selected server</label>
          <select
            id="global-server-select"
            value={selectedId ?? ''}
            onChange={e => setSelectedId(e.target.value)}
            className="!h-8 !w-auto max-w-[220px] !py-0 !text-[13px]"
          >
            {connections.map(conn => (
              <option key={conn.id} value={conn.id}>
                {connectionLabel(conn)}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
