"use client";

import { Github } from "lucide-react";
import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();

  function openNews() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('adguard-buddy:open-news'));
    }
  }

  return (
    <footer className="border-t border-[var(--border)] px-4 py-4 md:px-6">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center justify-between gap-3 text-[12px] text-[var(--text-subtle)] sm:flex-row">
        <div className="flex items-center gap-4">
          <span>© {year} chrizzo84</span>
          <Link
            href="https://github.com/chrizzo84"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-[var(--text)]"
            aria-label="GitHub Profile chrizzo84"
          >
            <Github className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Profile</span>
          </Link>
          <Link
            href="https://github.com/chrizzo84/adguard-buddy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-[var(--text)]"
            aria-label="Repository adguard-buddy"
          >
            <Github className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Repo</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <span className="font-mono">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
          <button
            type="button"
            onClick={openNews}
            className="transition-colors hover:text-[var(--text)]"
            aria-label="Open What's New"
          >
            What&apos;s New
          </button>
        </div>
      </div>
    </footer>
  );
}
