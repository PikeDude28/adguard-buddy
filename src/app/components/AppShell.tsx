"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield } from 'lucide-react';
import { MobileNav, NAV_ITEMS, Sidebar } from './Sidebar';
import { ServerScopePicker } from './ServerScopePicker';
import { NotificationBell } from './NotificationBell';
import { SiteFooter } from './SiteFooter';

const STORAGE_KEY = 'adguard-buddy-sidebar-collapsed';

function usePageTitle(): string {
  const pathname = usePathname();
  const match = NAV_ITEMS.find(item => item.href === pathname);
  return match?.name ?? 'Overview';
}

/**
 * Sidebar + slim top bar frame. The top bar carries the page title, the global
 * server scope and the notification bell; everything else lives in the page.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const title = usePageTitle();

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === 'true');
    } catch {
      /* ignore unavailable storage */
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(current => {
      const next = !current;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore unavailable storage */
      }
      return next;
    });
  };

  return (
    <>
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />

      <div
        className="flex min-h-screen flex-col transition-[padding] duration-200"
        style={{ paddingLeft: 'var(--shell-offset, 0px)' }}
        data-collapsed={collapsed}
      >
        {/* The sidebar is fixed, so the content column is offset by its width. */}
        <style>{`
          @media (min-width: 768px) {
            [data-collapsed="false"] { --shell-offset: var(--sidebar-width); }
            [data-collapsed="true"] { --shell-offset: var(--sidebar-width-collapsed); }
          }
        `}</style>

        <header className="sticky top-0 z-30 flex h-[var(--topbar-height)] items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--bg)]/85 px-4 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link href="/" className="flex items-center gap-2 md:hidden" aria-label="AdGuard Buddy home">
              <Shield className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
            </Link>
            <h1 className="truncate text-[15px] font-semibold text-[var(--text)]">{title}</h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <ServerScopePicker />
            </div>
            <NotificationBell />
          </div>
        </header>

        <div className="border-b border-[var(--border)] px-4 py-2 sm:hidden">
          <ServerScopePicker />
        </div>

        <main className="flex-1 px-4 py-6 pb-24 md:px-6 md:pb-6">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>

        <SiteFooter />
      </div>

      <MobileNav />
    </>
  );
}
