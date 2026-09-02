"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Lock, Unlock, Palette, SlidersHorizontal, FileSearch, X } from "lucide-react";
import PageControls, { type QueryLogOptions } from "./PageControls";
import { connectionLabel, useConnections, type PublicConnection } from "../contexts/ConnectionsContext";
import {
  Alert, Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, LogConsole,
  Modal, PageHeader, Segmented, TableSkeleton, useToast,
} from "../components/ui";

type QueryLogItem = {
  question: { name: string };
  client: string;
  time: string;
  reason: string;
  serverId?: string;
};

type FilterStatus = 'all' | 'processed' | 'filtered';

const DEFAULT_OPTIONS: QueryLogOptions = {
  refreshInterval: 5000,
  perServerLimit: 100,
  concurrency: 5,
  combinedMax: 500,
  pageSize: 50,
};

const REASON_LABELS: Record<string, { label: string; tone: 'success' | 'danger' | 'warning' | 'info' | 'neutral' }> = {
  NotFilteredNotFound: { label: 'Processed', tone: 'neutral' },
  NotFilteredWhiteList: { label: 'Allowlisted', tone: 'success' },
  NotFilteredError: { label: 'Error', tone: 'warning' },
  FilteredBlackList: { label: 'Blocked', tone: 'danger' },
  FilteredSafeBrowsing: { label: 'Safe browsing', tone: 'warning' },
  FilteredParental: { label: 'Parental', tone: 'warning' },
  FilteredInvalid: { label: 'Invalid', tone: 'warning' },
  FilteredSafeSearch: { label: 'Safe search', tone: 'info' },
  FilteredBlockedService: { label: 'Service blocked', tone: 'danger' },
  Rewrite: { label: 'Rewrite', tone: 'info' },
  RewriteEtcHosts: { label: 'Rewrite', tone: 'info' },
  RewriteRule: { label: 'Rewrite', tone: 'info' },
};

function describeReason(reason: string) {
  return REASON_LABELS[reason] ?? {
    label: reason.replace(/([A-Z])/g, ' $1').trim(),
    tone: reason.startsWith('NotFiltered') ? 'neutral' as const : 'danger' as const,
  };
}

export default function QueryLogPage() {
  const { connections, masterServerId, mode, selected, scopedConnections, isLoading: connectionsLoading, reload } =
    useConnections();
  const { notify } = useToast();

  const [logs, setLogs] = useState<QueryLogItem[]>([]);
  const [options, setOptions] = useState<QueryLogOptions>(DEFAULT_OPTIONS);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(DEFAULT_OPTIONS.pageSize);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [serverColors, setServerColors] = useState<Record<string, string>>({});

  const [pendingRule, setPendingRule] = useState<{ domain: string; action: 'block' | 'unblock' } | null>(null);
  const [ruleLog, setRuleLog] = useState<string[]>([]);
  const [ruleModal, setRuleModal] = useState<{ title: string; running: boolean } | null>(null);

  const scopeKey = mode === 'combined' ? 'combined' : selected?.id ?? '';

  useEffect(() => {
    const stored: Record<string, string> = {};
    connections.forEach(conn => { if (conn.color) stored[conn.id] = conn.color; });
    setServerColors(stored);
  }, [connections]);

  const fetchLogs = useCallback(async (isPolling = false) => {
    const targets = scopedConnections;
    if (targets.length === 0) return;

    if (!isPolling) setIsLoading(true);
    setError(null);

    const fetchFor = async (connection: PublicConnection): Promise<QueryLogItem[]> => {
      const response = await fetch('/api/query-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          response_status: filter,
          limit: options.perServerLimit,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `Failed to fetch logs (${response.status})`);
      }
      const data = await response.json();
      return ((data.data || []) as QueryLogItem[]).map(item => ({ ...item, serverId: connection.id }));
    };

    try {
      const collected: QueryLogItem[] = [];
      const batchSize = Math.max(1, options.concurrency);
      const failures: { id: string; reason: string }[] = [];

      for (let i = 0; i < targets.length; i += batchSize) {
        const batch = targets.slice(i, i + batchSize);
        const settled = await Promise.allSettled(batch.map(fetchFor));
        settled.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            collected.push(...result.value);
          } else {
            const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
            failures.push({ id: batch[index].id, reason });
          }
        });
      }

      // Surface why a server failed, not just that it did.
      if (failures.length > 0) {
        const detail = failures.map(f => `${f.id}: ${f.reason}`).join('; ');
        if (collected.length === 0) throw new Error(detail);
        setError(`Could not reach ${failures.length} of ${targets.length} servers - ${detail}`);
      }

      collected.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      const capped = mode === 'combined' && options.combinedMax > 0
        ? collected.slice(0, options.combinedMax)
        : collected;

      setLogs(capped);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLogs([]);
    } finally {
      if (!isPolling) setIsLoading(false);
    }
  }, [scopedConnections, filter, options.perServerLimit, options.concurrency, options.combinedMax, mode]);

  useEffect(() => {
    if (!connectionsLoading) fetchLogs(false);
  }, [connectionsLoading, scopeKey, filter, options.perServerLimit, fetchLogs]);

  // Polling deliberately reuses the same fetch but does not toggle the spinner.
  const fetchLogsRef = useRef(fetchLogs);
  fetchLogsRef.current = fetchLogs;

  useEffect(() => {
    if (options.refreshInterval === 0 || scopedConnections.length === 0) return;
    const id = setInterval(() => { fetchLogsRef.current(true); }, options.refreshInterval);
    return () => clearInterval(id);
  }, [options.refreshInterval, scopedConnections.length]);

  const filteredLogs = useMemo(() => {
    if (!searchTerm) return logs;
    const needle = searchTerm.toLowerCase();
    return logs.filter(log =>
      log.question.name.toLowerCase().includes(needle) ||
      log.client.toLowerCase().includes(needle) ||
      (log.serverId || '').toLowerCase().includes(needle)
    );
  }, [logs, searchTerm]);

  useEffect(() => {
    setVisibleCount(options.pageSize);
  }, [filter, searchTerm, options.pageSize, scopeKey]);

  // Infinite scroll: the sentinel keeps the listener count at one regardless of
  // how often the list re-renders during polling.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const totalFiltered = filteredLogs.length;
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) {
        setVisibleCount(current => Math.min(totalFiltered, current + options.pageSize));
      }
    }, { rootMargin: '300px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [totalFiltered, options.pageSize]);

  const persistColors = async (next: Record<string, string>) => {
    // Colours live on the connection record, addressed by its normalized id -
    // matching on `ip` alone silently dropped every URL and ip:port server.
    const payload = connections.map(conn => ({
      ip: conn.ip,
      url: conn.url,
      port: conn.port,
      username: conn.username,
      allowInsecure: conn.allowInsecure,
      color: next[conn.id],
    }));

    try {
      const response = await fetch('/api/save-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connections: payload, masterServerIp: masterServerId }),
      });
      if (!response.ok) throw new Error('Failed to save colours');
      await reload();
    } catch {
      notify('Could not save the server colour.', 'error');
    }
  };

  const handlePickColor = (connectionId: string, color: string) => {
    const next = { ...serverColors, [connectionId]: color };
    setServerColors(next);
    persistColors(next);
  };

  const clearColors = () => {
    setServerColors({});
    persistColors({});
  };

  const runRule = async (domain: string, action: 'block' | 'unblock') => {
    setRuleLog([]);
    setRuleModal({ title: `${action === 'block' ? 'Blocking' : 'Unblocking'} ${domain}`, running: true });

    try {
      const response = await fetch('/api/set-filtering-rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, action, connectionIds: connections.map(c => c.id) }),
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `Request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            setRuleLog(current => [...current, JSON.parse(line.slice(6)).message]);
          } catch {
            /* ignore malformed frames */
          }
        }
      }

      setRuleModal({ title: `${action === 'block' ? 'Blocked' : 'Unblocked'} ${domain}`, running: false });
      fetchLogs(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRuleLog(current => [...current, `Failed: ${message}`]);
      setRuleModal({ title: `Failed to ${action} ${domain}`, running: false });
      notify(message, 'error');
    }
  };

  const showSkeleton = (connectionsLoading || isLoading) && logs.length === 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Query Log"
        description={
          mode === 'combined'
            ? `Merged from ${connections.length} servers, newest first.`
            : selected ? `${connectionLabel(selected)}, newest first.` : 'DNS query history.'
        }
        actions={
          <>
            {lastUpdated && (
              <span className="tabular hidden text-[12px] text-[var(--text-subtle)] sm:inline">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <Button
              size="sm"
              variant={showOptions ? 'secondary' : 'ghost'}
              onClick={() => setShowOptions(v => !v)}
              aria-expanded={showOptions}
              icon={<SlidersHorizontal className="h-4 w-4" />}
            >
              Options
            </Button>
          </>
        }
      />

      {error && <Alert tone="danger">{error}</Alert>}

      {showOptions && (
        <Card>
          <CardHeader title="Fetch options" description="How much history to pull and how often." />
          <PageControls
            options={options}
            combined={mode === 'combined'}
            onChange={patch => setOptions(current => ({ ...current, ...patch }))}
          />
        </Card>
      )}

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              label="Status filter"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'processed', label: 'Processed' },
                { value: 'filtered', label: 'Filtered' },
              ]}
            />

            <div className="relative w-full sm:w-72">
              <label htmlFor="query-log-search" className="sr-only">Search queries</label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-subtle)]"
                aria-hidden="true"
              />
              <input
                id="query-log-search"
                type="search"
                placeholder="Search domain, client or server…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="!pl-9"
              />
            </div>
          </div>

          {mode === 'combined' && connections.length > 1 && (
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">
                <Palette className="h-3.5 w-3.5" aria-hidden="true" /> Colours
              </span>
              {connections.map(conn => (
                <span key={conn.id} className="relative inline-flex h-6 w-6">
                  <span
                    className="h-6 w-6 rounded-[var(--radius-sm)] border border-[var(--border-strong)]"
                    style={{ background: serverColors[conn.id] || 'transparent' }}
                  />
                  <input
                    type="color"
                    value={serverColors[conn.id] || '#3B82F6'}
                    onChange={e => handlePickColor(conn.id, e.target.value)}
                    aria-label={`Colour for ${connectionLabel(conn)}`}
                    title={connectionLabel(conn)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </span>
              ))}
              {Object.keys(serverColors).length > 0 && (
                <Button size="sm" variant="ghost" onClick={clearColors} icon={<X className="h-3.5 w-3.5" />}>
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card flush>
        {showSkeleton ? (
          <TableSkeleton rows={10} />
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            icon={<FileSearch className="h-5 w-5" />}
            title={searchTerm ? 'No matching queries' : 'No queries logged'}
            description={
              searchTerm
                ? 'Try a different search term or widen the status filter.'
                : 'Once your AdGuard Home instances resolve queries they will appear here.'
            }
          />
        ) : (
          <>
            <div className="max-h-[70vh] overflow-auto">
              <table className="data-table">
                <caption className="sr-only">DNS queries, newest first</caption>
                <thead>
                  <tr>
                    {mode === 'combined' && <th scope="col">Server</th>}
                    <th scope="col">Time</th>
                    <th scope="col">Client</th>
                    <th scope="col">Domain</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.slice(0, visibleCount).map((log, index) => {
                    const blocked = !log.reason.startsWith('NotFiltered');
                    const reason = describeReason(log.reason);
                    const color = log.serverId ? serverColors[log.serverId] : undefined;
                    return (
                      <tr key={`${log.time}-${log.question.name}-${log.serverId}-${index}`}>
                        {mode === 'combined' && (
                          <td>
                            <span className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 flex-shrink-0 rounded-full"
                                style={{ background: color || 'var(--border-strong)' }}
                                aria-hidden="true"
                              />
                              <span className="max-w-[160px] truncate font-mono text-[12px]" title={log.serverId}>
                                {log.serverId}
                              </span>
                            </span>
                          </td>
                        )}
                        <td className="tabular whitespace-nowrap text-[12px]">
                          {new Date(log.time).toLocaleTimeString()}
                        </td>
                        <td className="font-mono text-[12px]">{log.client}</td>
                        <td className="max-w-xs break-all text-[var(--text)]">{log.question.name}</td>
                        <td><Badge tone={reason.tone}>{reason.label}</Badge></td>
                        <td className="text-right">
                          <Button
                            size="sm"
                            variant={blocked ? 'secondary' : 'danger'}
                            onClick={() => setPendingRule({
                              domain: log.question.name,
                              action: blocked ? 'unblock' : 'block',
                            })}
                            icon={blocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                          >
                            {blocked ? 'Unblock' : 'Block'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div ref={sentinelRef} aria-hidden="true" />
            </div>

            <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
              <span className="tabular text-[12px] text-[var(--text-subtle)]">
                Showing {Math.min(visibleCount, filteredLogs.length)} of {filteredLogs.length}
              </span>
              <Button
                size="sm"
                disabled={visibleCount >= filteredLogs.length}
                onClick={() => setVisibleCount(c => Math.min(filteredLogs.length, c + options.pageSize))}
              >
                Load more
              </Button>
            </div>
          </>
        )}
      </Card>

      <ConfirmDialog
        open={pendingRule !== null}
        title={pendingRule?.action === 'block' ? 'Block domain' : 'Unblock domain'}
        tone={pendingRule?.action === 'block' ? 'danger' : 'primary'}
        confirmLabel={pendingRule?.action === 'block' ? 'Block everywhere' : 'Unblock everywhere'}
        description={
          <>
            This writes a custom filtering rule for{' '}
            <span className="font-mono text-[var(--text)]">{pendingRule?.domain}</span> on{' '}
            <strong className="text-[var(--text)]">all {connections.length} configured server(s)</strong>,
            not just the one you are viewing.
          </>
        }
        onCancel={() => setPendingRule(null)}
        onConfirm={() => {
          const rule = pendingRule;
          setPendingRule(null);
          if (rule) runRule(rule.domain, rule.action);
        }}
      />

      <Modal
        open={ruleModal !== null}
        onClose={() => setRuleModal(null)}
        title={ruleModal?.title ?? ''}
        subtitle={ruleModal?.running ? 'Applying the rule to every server…' : 'Finished'}
        size="lg"
      >
        <LogConsole lines={ruleLog} running={ruleModal?.running ?? false} />
      </Modal>
    </div>
  );
}
