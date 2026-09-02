import React from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { ToastProvider } from '../app/components/ui/Toast';
import type { PublicConnection, ScopeMode } from '../app/contexts/ConnectionsContext';

/**
 * Shared helpers for component tests.
 *
 * Pages read their server scope from ConnectionsContext, so tests supply a
 * controlled scope through `mockConnectionsValue` and render inside the toast
 * provider the UI components depend on.
 */

export const connection = (overrides: Partial<PublicConnection> = {}): PublicConnection => ({
  id: '192.168.1.1:80',
  ip: '192.168.1.1',
  port: 80,
  username: 'admin',
  ...overrides,
});

export type ConnectionsValue = {
  connections: PublicConnection[];
  masterServerId: string | null;
  isLoading: boolean;
  error: string | null;
  reload: jest.Mock;
  mode: ScopeMode;
  setMode: jest.Mock;
  selectedId: string | null;
  setSelectedId: jest.Mock;
  selected: PublicConnection | null;
  scopedConnections: PublicConnection[];
};

/** Builds a complete ConnectionsContext value with sensible defaults. */
export function mockConnectionsValue(overrides: Partial<ConnectionsValue> = {}): ConnectionsValue {
  const connections = overrides.connections ?? [connection()];
  const mode = overrides.mode ?? 'single';
  const selectedId = overrides.selectedId !== undefined ? overrides.selectedId : connections[0]?.id ?? null;
  const selected = overrides.selected !== undefined
    ? overrides.selected
    : connections.find(c => c.id === selectedId) ?? null;

  return {
    connections,
    masterServerId: overrides.masterServerId ?? null,
    isLoading: overrides.isLoading ?? false,
    error: overrides.error ?? null,
    reload: overrides.reload ?? jest.fn(),
    mode,
    setMode: overrides.setMode ?? jest.fn(),
    selectedId,
    setSelectedId: overrides.setSelectedId ?? jest.fn(),
    selected,
    scopedConnections: overrides.scopedConnections
      ?? (mode === 'combined' ? connections : selected ? [selected] : []),
  };
}

export function renderWithProviders(ui: React.ReactElement): RenderResult {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

/** A fetch mock that dispatches on URL substring. */
export function mockFetchRoutes(
  routes: Record<string, (body: unknown) => { ok?: boolean; status?: number; json?: unknown; text?: string }>,
) {
  return jest.fn(async (url: string, init?: RequestInit) => {
    const key = Object.keys(routes).find(route => String(url).includes(route));
    if (!key) throw new Error(`Unmocked fetch: ${url}`);

    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    const result = routes[key](body);
    const ok = result.ok ?? true;

    return {
      ok,
      status: result.status ?? (ok ? 200 : 500),
      json: async () => result.json ?? {},
      text: async () => result.text ?? JSON.stringify(result.json ?? {}),
    } as unknown as Response;
  });
}
