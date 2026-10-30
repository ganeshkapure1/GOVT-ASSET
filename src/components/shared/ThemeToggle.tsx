'use client';

import React, { useEffect, useState } from 'react';
import { SunIcon, MoonIcon } from '@/components/ui/icons';

export interface ThemeToggleProps {
  className?: string;
  variant?: 'subtle' | 'pill' | 'icon';
}

export function ThemeToggle({ className = '', variant = 'pill' }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const root = document.documentElement;
    const isCurrentlyDark = root.classList.contains('dark');
    setIsDark(isCurrentlyDark);

    const handleThemeChange = () => {
      setIsDark(root.classList.contains('dark'));
    };

    window.addEventListener('govasset-theme-change', handleThemeChange);
    return () => window.removeEventListener('govasset-theme-change', handleThemeChange);
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    const nextDark = !isDark;
    setIsDark(nextDark);

    if (nextDark) {
      root.classList.add('dark');
      try {
        localStorage.setItem('govasset-theme-v2', 'dark');
        localStorage.setItem('govasset-theme', 'dark');
      } catch {}
    } else {
      root.classList.remove('dark');
      try {
        localStorage.setItem('govasset-theme-v2', 'light');
        localStorage.setItem('govasset-theme', 'light');
      } catch {}
    }

    window.dispatchEvent(new Event('govasset-theme-change'));
  };

  if (!mounted) {
    // Avoid layout shift during SSR
    return (
      <div
        className={`w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 animate-pulse ${className}`}
        aria-hidden="true"
      />
    );
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#0B4FC2] dark:focus:ring-blue-400 ${
          isDark
            ? 'bg-slate-800/80 hover:bg-slate-700/80 text-amber-300 border-slate-700 shadow-sm'
            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
        } ${className}`}
        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {isDark ? (
          <>
            <SunIcon className="w-3.5 h-3.5 text-amber-400 transition-transform hover:rotate-45" />
            <span className="hidden sm:inline text-slate-200">Light</span>
          </>
        ) : (
          <>
            <MoonIcon className="w-3.5 h-3.5 text-slate-600 transition-transform hover:-rotate-12" />
            <span className="hidden sm:inline text-slate-700">Dark</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#0B4FC2] dark:focus:ring-blue-400 ${
        isDark
          ? 'bg-slate-800/80 hover:bg-slate-700 text-amber-300 border-slate-700'
          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
      } ${className}`}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? (
        <SunIcon className="w-4 h-4 text-amber-400" />
      ) : (
        <MoonIcon className="w-4 h-4 text-slate-600" />
      )}
    </button>
  );
}
