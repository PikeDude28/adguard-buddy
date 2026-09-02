"use client";

import Link from "next/link";
import { ArrowRight, Plug, Star, LayoutDashboard } from "lucide-react";
import { NAV_ITEMS } from "./components/Sidebar";
import { Card, CardHeader } from "./components/ui";
import { useConnections } from "./contexts/ConnectionsContext";

const STEPS = [
  {
    icon: Plug,
    title: "Add your servers",
    body: (
      <>
        Open <Link href="/settings" className="text-[var(--accent)] hover:underline">Settings</Link> and
        add each AdGuard Home instance with its URL and credentials.
      </>
    ),
  },
  {
    icon: Star,
    title: "Pick a master",
    body: <>Mark one server as master. Its configuration is the source of truth for every sync.</>,
  },
  {
    icon: LayoutDashboard,
    title: "Monitor and sync",
    body: (
      <>
        The <Link href="/dashboard" className="text-[var(--accent)] hover:underline">Dashboard</Link> shows
        live status, and <Link href="/sync-status" className="text-[var(--accent)] hover:underline">Sync Status</Link> shows
        what drifted from the master.
      </>
    ),
  },
];

export default function Home() {
  const { connections, isLoading } = useConnections();
  const configured = !isLoading && connections.length > 0;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          AdGuard Buddy
        </h2>
        <p className="mt-1.5 max-w-2xl text-[13px] text-[var(--text-muted)]">
          Monitor, control and synchronize several AdGuard Home instances from one place.
          {configured && ` ${connections.length} server${connections.length === 1 ? '' : 's'} configured.`}
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="card group flex items-start gap-3.5 p-4 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
            >
              <span
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius)]"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                aria-hidden="true"
              >
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--text)]">
                  {item.name}
                  <ArrowRight
                    className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </span>
                <span className="mt-0.5 block text-[13px] text-[var(--text-subtle)]">
                  {DESCRIPTIONS[item.href]}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      {!configured && (
        <Card>
          <CardHeader title="Getting started" description="Three steps to a working setup." />
          <ol className="space-y-4">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="flex gap-3.5">
                  <span
                    className="tabular flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--text)]">
                      <Icon className="h-3.5 w-3.5 text-[var(--text-subtle)]" aria-hidden="true" />
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">{step.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </div>
  );
}

const DESCRIPTIONS: Record<string, string> = {
  '/dashboard': 'Live status and protection controls for every instance',
  '/query-log': 'Search DNS queries across all servers',
  '/statistics': 'Traffic, blocking and latency analysis',
  '/sync-status': 'What drifted from the master, and one-click sync',
  '/settings': 'Connections, auto-sync and appearance',
};
