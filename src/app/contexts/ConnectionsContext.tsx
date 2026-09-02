"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/** A connection as the browser sees it - identity only, never credentials. */
export type PublicConnection = {
  id: string;
  ip?: string;
  url?: string;
  port?: number;
  username: string;
  allowInsecure?: boolean;
  color?: string;
};

export type ScopeMode = 'single' | 'combined';

type ConnectionsContextValue = {
  connections: PublicConnection[];
  masterServerId: string | null;
  isLoading: boolean;
  error: string | null;
  /** Re-reads the connection list from the server. */
  reload: () => Promise<void>;

  /** Global server scope, shared by every page instead of per-page selectors. */
  mode: ScopeMode;
  setMode: (mode: ScopeMode) => void;
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  /** The connection `selectedId` points at, or null. */
  selected: PublicConnection | null;
  /** Connections the current scope covers: one in single mode, all in combined. */
  scopedConnections: PublicConnection[];
};

const ConnectionsContext = createContext<ConnectionsContextValue | undefined>(undefined);

const STORAGE_KEY_MODE = 'adguard-buddy-scope-mode';
const STORAGE_KEY_SERVER = 'adguard-buddy-scope-server';

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage can be unavailable in private mode - the scope just won't persist */
  }
}

export function ConnectionsProvider({ children }: { children: React.ReactNode }) {
  const [connections, setConnections] = useState<PublicConnection[]>([]);
  const [masterServerId, setMasterServerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setModeState] = useState<ScopeMode>('single');
  const [selectedId, setSelectedIdState] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/get-connections');
      if (!response.ok) throw new Error('Failed to fetch connections.');
      const data = await response.json();
      const list: PublicConnection[] = data.connections || [];
      setConnections(list);
      setMasterServerId(data.masterServerIp || null);
      setError(null);

      // Keep the stored selection when it still exists, otherwise fall back.
      setSelectedIdState(current => {
        const stored = current ?? readStored(STORAGE_KEY_SERVER);
        if (stored && list.some(c => c.id === stored)) return stored;
        return list[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedMode = readStored(STORAGE_KEY_MODE);
    if (storedMode === 'single' || storedMode === 'combined') setModeState(storedMode);
    reload();
  }, [reload]);

  const setMode = useCallback((next: ScopeMode) => {
    setModeState(next);
    writeStored(STORAGE_KEY_MODE, next);
  }, []);

  const setSelectedId = useCallback((id: string) => {
    setSelectedIdState(id);
    writeStored(STORAGE_KEY_SERVER, id);
  }, []);

  // Combined mode needs at least two servers to mean anything.
  const effectiveMode: ScopeMode = mode === 'combined' && connections.length < 2 ? 'single' : mode;

  const selected = useMemo(
    () => connections.find(c => c.id === selectedId) ?? null,
    [connections, selectedId],
  );

  const scopedConnections = useMemo(
    () => (effectiveMode === 'combined' ? connections : selected ? [selected] : []),
    [effectiveMode, connections, selected],
  );

  const value = useMemo<ConnectionsContextValue>(() => ({
    connections,
    masterServerId,
    isLoading,
    error,
    reload,
    mode: effectiveMode,
    setMode,
    selectedId,
    setSelectedId,
    selected,
    scopedConnections,
  }), [
    connections, masterServerId, isLoading, error, reload,
    effectiveMode, setMode, selectedId, setSelectedId, selected, scopedConnections,
  ]);

  return <ConnectionsContext.Provider value={value}>{children}</ConnectionsContext.Provider>;
}

export function useConnections(): ConnectionsContextValue {
  const context = useContext(ConnectionsContext);
  if (!context) throw new Error('useConnections must be used within a ConnectionsProvider');
  return context;
}

/** Short, readable name for a connection - used in tables and selectors. */
export function connectionLabel(conn: Pick<PublicConnection, 'url' | 'ip' | 'port'>): string {
  if (conn.url && conn.url.length > 0) {
    try {
      const parsed = new URL(conn.url);
      return parsed.host;
    } catch {
      return conn.url;
    }
  }
  if (conn.ip) return conn.port ? `${conn.ip}:${conn.port}` : conn.ip;
  return 'unknown';
}
