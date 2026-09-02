"use client";

import { ReactNode } from 'react';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ConnectionsProvider } from '../contexts/ConnectionsContext';
import { ToastProvider } from './ui/Toast';
import { useNewsPopup } from '../hooks/useNewsPopup';
import NewsPopup from './NewsPopup';
import { AppShell } from './AppShell';

function NewsLayer() {
  const { isNewsPopupOpen, newsContent, handleClosePopup } = useNewsPopup();
  return <NewsPopup isOpen={isNewsPopupOpen} onClose={handleClosePopup} content={newsContent} />;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConnectionsProvider>
          <AppShell>{children}</AppShell>
          <NewsLayer />
        </ConnectionsProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
