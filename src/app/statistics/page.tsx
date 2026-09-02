"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshCw, Activity, ShieldCheck, AlertTriangle, Timer, Globe, Users,
  Monitor, Smartphone, Tv, Laptop, HardDrive, ChevronDown, BarChart3,
} from "lucide-react";
import { useConnections } from "../contexts/ConnectionsContext";
import {
  Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader,
  StatTile, StatTileSkeleton, CardSkeleton,
} from "../components/ui";
import { BarList, ChartLegend, Donut, TimeSeriesChart, type TimeUnit } from "../components/charts";

type TopArrayEntry = { [key: string]: number };

type StatsData = {
  avg_processing_time?: number;
  dns_queries?: number | number[];
  num_dns_queries?: number;
  num_blocked_filtering?: number;
  num_replaced_safebrowsing?: number;
  num_replaced_parental?: number;
  dns_queries_arr?: number[];
  blocked_filtering?: number[];
  blocked_filtering_arr?: number[];
  time_units?: string;
  top_queried_domains?: TopArrayEntry[];
  top_blocked_domains?: TopArrayEntry[];
  top_clients?: TopArrayEntry[];
  top_upstreams_avg_time?: TopArrayEntry[];
};

type ThreatEntry = { domain: string; type: 'safebrowsing' | 'parental'; time: string };

const numberFormat = new Intl.NumberFormat();

/** `/control/stats` and the combined endpoint spell the arrays differently. */
function hourlySeries(stats: StatsData | null, key: 'queries' | 'blocked'): number[] {
  if (!stats) return [];
  const candidates = key === 'queries'
    ? [stats.dns_queries_arr, Array.isArray(stats.dns_queries) ? stats.dns_queries : undefined]
    : [stats.blocked_filtering_arr, stats.blocked_filtering];
  const found = candidates.find(value => Array.isArray(value) && value.length > 0);
  return found ? [...found] : [];
}

function clientIcon(name: string) {
  const lower = name.toLowerCase();
  if (/iphone|android|mobile|pixel/.test(lower)) return <Smartphone className="h-3.5 w-3.5" />;
  if (/macbook|laptop|thinkpad/.test(lower)) return <Laptop className="h-3.5 w-3.5" />;
  if (/tv|firestick|roku|chromecast/.test(lower)) return <Tv className="h-3.5 w-3.5" />;
  if (/desktop|\bpc\b|windows|imac/.test(lower)) return <Monitor className="h-3.5 w-3.5" />;
  return <HardDrive className="h-3.5 w-3.5" />;
}

function toBarItems(entries: TopArrayEntry[] | undefined, limit = 6) {
  return (entries ?? []).slice(0, limit).map(entry => {
    const [name, value] = Object.entries(entry)[0];
    return { name, value };
  });
}

export default function StatisticsPage() {
  const { mode, selected, scopedConnections, connections, isLoading: connectionsLoading } = useConnections();

  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threats, setThreats] = useState<ThreatEntry[]>([]);
  const [threatsExpanded, setThreatsExpanded] = useState(false);
  const [threatsLoading, setThreatsLoading] = useState(false);

  const scopeKey = mode === 'combined' ? 'combined' : selected?.id ?? '';

  const fetchStats = useCallback(async () => {
    if (mode === 'single' && !selected) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = mode === 'combined'
        ? await fetch('/api/statistics/combined')
        : await fetch('/api/statistics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connectionId: selected!.id }),
          });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to fetch statistics');
      }
      setStats(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, [mode, selected]);

  useEffect(() => {
    if (connectionsLoading) return;
    setThreatsExpanded(false);
    setThreats([]);
    fetchStats();
  }, [connectionsLoading, scopeKey, fetchStats]);

  const loadThreats = useCallback(async () => {
    setThreatsLoading(true);
    try {
      const requests = scopedConnections.flatMap(connection =>
        (['blocked_safebrowsing', 'blocked_parental'] as const).map(async status => {
          try {
            const response = await fetch('/api/query-log', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ connectionId: connection.id, limit: 20, offset: 0, response_status: status }),
            });
            if (!response.ok) return [] as ThreatEntry[];
            const data = await response.json();
            return ((data.data || []) as Array<{ question?: { name?: string }; time?: string }>).map(entry => ({
              domain: entry.question?.name || 'Unknown',
              type: status === 'blocked_safebrowsing' ? 'safebrowsing' as const : 'parental' as const,
              time: entry.time || new Date().toISOString(),
            }));
          } catch {
            return [] as ThreatEntry[];
          }
        }),
      );

      const found = (await Promise.all(requests)).flat();
      found.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

      const unique = new Map<string, ThreatEntry>();
      found.forEach(entry => { if (!unique.has(entry.domain)) unique.set(entry.domain, entry); });
      setThreats(Array.from(unique.values()).slice(0, 10));
    } finally {
      setThreatsLoading(false);
    }
  }, [scopedConnections]);

  const toggleThreats = () => {
    if (!threatsExpanded && threats.length === 0) loadThreats();
    setThreatsExpanded(v => !v);
  };

  const totalQueries = stats?.num_dns_queries
    ?? (typeof stats?.dns_queries === 'number' ? stats.dns_queries : 0);
  const blocked = stats?.num_blocked_filtering || 0;
  const safebrowsing = stats?.num_replaced_safebrowsing || 0;
  const parental = stats?.num_replaced_parental || 0;
  const threatCount = safebrowsing + parental;
  const avgMs = (stats?.avg_processing_time || 0) * 1000;

  const timeUnit: TimeUnit = stats?.time_units === 'days' ? 'days' : 'hours';
  const queriesSeries = useMemo(() => hourlySeries(stats, 'queries'), [stats]);
  const blockedSeries = useMemo(() => hourlySeries(stats, 'blocked'), [stats]);

  // Stacked as allowed + blocked so the bars still sum to total queries.
  const chartSeries = useMemo(() => {
    if (queriesSeries.length === 0) return [];
    const allowed = queriesSeries.map((value, i) => Math.max(0, value - (blockedSeries[i] || 0)));
    return [
      { name: 'Allowed', values: allowed, color: 'var(--series-1)' },
      { name: 'Blocked', values: blockedSeries.length > 0 ? blockedSeries : allowed.map(() => 0), color: 'var(--series-5)' },
    ];
  }, [queriesSeries, blockedSeries]);

  const showSkeleton = (connectionsLoading || isLoading) && !stats;

  if (!connectionsLoading && connections.length === 0) {
    return (
      <>
        <PageHeader title="Statistics" description="Traffic, blocking and latency analysis." />
        <Card>
          <EmptyState
            icon={<BarChart3 className="h-5 w-5" />}
            title="No connections configured"
            description="Add an AdGuard Home instance in Settings to see statistics."
          />
        </Card>
      </>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Statistics"
        description={
          mode === 'combined'
            ? `Aggregated across ${connections.length} servers.`
            : 'Traffic, blocking and latency for the selected server.'
        }
        actions={
          <Button
            size="sm"
            onClick={fetchStats}
            disabled={isLoading}
            icon={<RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        }
      />

      {error && <Alert tone="danger">{error}</Alert>}

      {/* items-start so the expandable Threats tile does not stretch the rest. */}
      <div className="grid grid-cols-2 items-start gap-4 lg:grid-cols-4">
        {showSkeleton ? (
          Array.from({ length: 4 }).map((_, i) => <StatTileSkeleton key={i} />)
        ) : (
          <>
            <StatTile
              label="Total queries"
              value={numberFormat.format(totalQueries)}
              icon={<Activity className="h-4 w-4" />}
              tone="accent"
            />
            <StatTile
              label="Blocked"
              value={numberFormat.format(blocked)}
              hint={totalQueries > 0 ? `${((blocked / totalQueries) * 100).toFixed(1)}%` : undefined}
              icon={<ShieldCheck className="h-4 w-4" />}
              tone="danger"
            />
            <StatTile
              label="Threats"
              value={numberFormat.format(threatCount)}
              icon={<AlertTriangle className="h-4 w-4" />}
              tone="warning"
            >
              {threatCount > 0 && (
                <div className="space-y-1.5 border-t border-[var(--border)] pt-2.5">
                  {safebrowsing > 0 && (
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-[var(--text-subtle)]">Safe browsing</span>
                      <span className="tabular text-[var(--warning)]">{numberFormat.format(safebrowsing)}</span>
                    </div>
                  )}
                  {parental > 0 && (
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-[var(--text-subtle)]">Parental</span>
                      <span className="tabular" style={{ color: 'var(--series-4)' }}>
                        {numberFormat.format(parental)}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={toggleThreats}
                    aria-expanded={threatsExpanded}
                    className="flex w-full items-center justify-center gap-1.5 border-t border-[var(--border)] pt-2 text-[12px] text-[var(--text-subtle)] transition-colors hover:text-[var(--text)]"
                  >
                    <ChevronDown
                      className={`h-3 w-3 transition-transform ${threatsExpanded ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                    {threatsLoading ? 'Loading domains…' : threatsExpanded ? 'Hide domains' : 'Show domains'}
                  </button>
                  {threatsExpanded && !threatsLoading && (
                    <div className="max-h-40 space-y-1 overflow-y-auto pt-1">
                      {threats.length === 0 ? (
                        <p className="text-center text-[12px] text-[var(--text-subtle)]">
                          No recent threat domains found.
                        </p>
                      ) : threats.map((threat, index) => (
                        <div key={`${threat.domain}-${index}`} className="flex items-center gap-2 text-[12px]">
                          <span
                            className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                            style={{ background: threat.type === 'safebrowsing' ? 'var(--warning)' : 'var(--series-4)' }}
                          />
                          <span className="truncate font-mono text-[var(--text-muted)]" title={threat.domain}>
                            {threat.domain}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </StatTile>
            <StatTile
              label="Avg. processing"
              value={avgMs.toFixed(1)}
              unit="ms"
              icon={<Timer className="h-4 w-4" />}
              tone="info"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {showSkeleton ? <CardSkeleton rows={1} height={200} /> : (
            <Card>
              <CardHeader
                title={`Queries per ${timeUnit === 'days' ? 'day' : 'hour'}`}
                actions={chartSeries.length > 0 ? <ChartLegend series={chartSeries} /> : undefined}
              />
              {chartSeries.length > 0 ? (
                <TimeSeriesChart series={chartSeries} unit={timeUnit} height={220} />
              ) : (
                <EmptyState
                  size="inline"
                  icon={<BarChart3 className="h-5 w-5" />}
                  title="No time series available"
                  description="This AdGuard Home instance did not return per-interval history. Enable statistics in its settings to populate this chart."
                />
              )}
            </Card>
          )}
        </div>

        {showSkeleton ? <CardSkeleton rows={3} height={180} /> : (
          <Card>
            <CardHeader title="Query outcome" />
            <Donut
              centerLabel="Queries"
              data={[
                { name: 'Allowed', value: Math.max(0, totalQueries - blocked), color: 'var(--series-1)' },
                { name: 'Blocked', value: blocked, color: 'var(--series-5)' },
              ]}
            />
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopListCard
          title="Top clients"
          icon={<Users className="h-4 w-4" />}
          items={toBarItems(stats?.top_clients).map(item => ({ ...item, icon: clientIcon(item.name) }))}
          color="var(--series-1)"
          loading={showSkeleton}
          emptyText="No client data available."
        />
        <TopListCard
          title="Top blocked domains"
          icon={<ShieldCheck className="h-4 w-4" />}
          items={toBarItems(stats?.top_blocked_domains)}
          color="var(--series-5)"
          loading={showSkeleton}
          emptyText="Nothing has been blocked yet."
        />
        <TopListCard
          title="Top queried domains"
          icon={<Globe className="h-4 w-4" />}
          items={toBarItems(stats?.top_queried_domains)}
          color="var(--series-2)"
          loading={showSkeleton}
          emptyText="No domain data available."
        />

        {showSkeleton ? <CardSkeleton rows={4} height={160} /> : (
          <Card>
            <CardHeader
              title="Upstream response times"
              actions={<Badge tone="neutral">avg. ms</Badge>}
            />
            {(stats?.top_upstreams_avg_time ?? []).length === 0 ? (
              <EmptyState size="inline" title="No upstream data available." />
            ) : (
              <BarList
                color="var(--series-3)"
                items={toBarItems(stats?.top_upstreams_avg_time).map(item => ({
                  name: item.name,
                  value: item.value,
                  display: `${(item.value * 1000).toFixed(0)} ms`,
                }))}
              />
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function TopListCard({
  title, icon, items, color, loading, emptyText,
}: {
  title: string;
  icon: React.ReactNode;
  items: { name: string; value: number; icon?: React.ReactNode }[];
  color: string;
  loading: boolean;
  emptyText: string;
}) {
  if (loading) return <CardSkeleton rows={4} height={160} />;

  return (
    <Card>
      <CardHeader
        title={title}
        icon={icon}
        actions={items.length > 0 ? <Badge tone="neutral">{items.length}</Badge> : undefined}
      />
      {items.length === 0
        ? <EmptyState size="inline" title={emptyText} />
        : <BarList items={items} color={color} />}
    </Card>
  );
}
