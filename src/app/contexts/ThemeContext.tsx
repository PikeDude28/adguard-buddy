"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export const THEMES = ['green', 'blue', 'purple', 'orange'] as const;
export type Theme = (typeof THEMES)[number];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const STORAGE_KEY = 'adguard-buddy-theme';

/**
 * The theme only swaps the accent hue; the surface and text scales are fixed.
 * AdGuard Buddy is a dark-only monitoring surface by design.
 */
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>('green');

  useEffect(() => {
    let savedTheme: string | null = null;
    try {
      savedTheme = localStorage.getItem(STORAGE_KEY);
    } catch {
      savedTheme = null;
    }
    if (savedTheme && (THEMES as readonly string[]).includes(savedTheme)) {
      setTheme(savedTheme as Theme);
    }
  }, []);

  useEffect(() => {
    const body = document.body;
    THEMES.forEach(t => body.classList.remove(`theme-${t}`));
    body.classList.add(`theme-${theme}`);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore unavailable storage */
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
