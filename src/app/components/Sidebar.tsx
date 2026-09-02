"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, LayoutDashboard, FileSearch, BarChart3, RefreshCw, Settings, PanelLeftClose, PanelLeft } from 'lucide-react';

export const NAV_ITEMS = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Query Log', href: '/query-log', icon: FileSearch },
  { name: 'Statistics', href: '/statistics', icon: BarChart3 },
  { name: 'Sync Status', href: '/sync-status', icon: RefreshCw },
  { name: 'Settings', href: '/settings', icon: Settings },
] as const;

type Props = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

/**
 * Fixed primary navigation. A sidebar rather than a top bar: with five
 * sections plus a global server scope, a horizontal nav had to duplicate
 * itself into a second scrolling row on small screens.
 */
export function Sidebar({ collapsed, onToggleCollapsed }: Props) {
  const pathname = usePathname();

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-[width] duration-200 md:flex"
      style={{ width: collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)' }}
    >
      <div className="flex h-[var(--topbar-height)] items-center gap-2.5 border-b border-[var(--border)] px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="AdGuard Buddy home">
          <Shield className="h-[22px] w-[22px] flex-shrink-0 text-[var(--accent)]" aria-hidden="true" />
          {!collapsed && (
            <span className="truncate text-[15px] font-semibold tracking-tight text-[var(--text)]">
              AdGuard<span className="text-[var(--text-subtle)]">Buddy</span>
            </span>
          )}
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Main navigation">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              title={collapsed ? item.name : undefined}
              className="flex items-center gap-3 rounded-[var(--radius)] px-2.5 py-2 text-[13px] font-medium transition-colors"
              style={
                active
                  ? { background: 'var(--accent-soft)', color: 'var(--accent)' }
                  : { color: 'var(--text-muted)' }
              }
            >
              <Icon className="h-[18px] w-[18px] flex-shrink-0" aria-hidden="true" />
              {!collapsed && <span className="truncate">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border)] p-2">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex w-full items-center gap-3 rounded-[var(--radius)] px-2.5 py-2 text-[13px] text-[var(--text-subtle)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
        >
          {collapsed
            ? <PanelLeft className="h-[18px] w-[18px]" aria-hidden="true" />
            : <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden="true" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

/** Bottom tab bar shown instead of the sidebar on small screens. */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--border)] bg-[var(--surface)] md:hidden"
      aria-label="Main navigation"
    >
      {NAV_ITEMS.map(item => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors"
            style={{ color: active ? 'var(--accent)' : 'var(--text-subtle)' }}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            <span className="truncate px-1">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
