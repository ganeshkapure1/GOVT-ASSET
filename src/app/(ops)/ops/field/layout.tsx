'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WrenchIcon, MapPinIcon, CheckCircleIcon, ChevronLeftIcon } from '@/components/ui/icons';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

export default function FieldWorkerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  };
  return (
    <div className="min-h-screen bg-[#F4F7FB] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col -m-4 sm:-m-6 lg:-m-8 transition-colors">
      {/* High-Contrast Public-Sector Masthead (Optimized for Outdoor Daylight & Sunlight) */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 border-b-2 border-amber-400 dark:border-amber-500 px-4 py-3 shadow-xs backdrop-blur-md">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-2xs">
              <WrenchIcon className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-wide text-slate-900 dark:text-white">
                  GovAsset
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-amber-400 text-slate-950">
                  Field Crew
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                Crew Lead: Vikram S. • Ward 28
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* GPS Connectivity Indicator */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
              GPS Lock
            </span>

            {/* Accessible Theme Toggle */}
            <ThemeToggle />

            {/* Sign Out */}
            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 text-xs flex items-center border border-slate-200 dark:border-slate-700 shadow-2xs font-semibold"
              title="Sign Out"
            >
              Exit
            </button>
          </div>
        </div>
      </header>

      {/* Main High-Contrast Content Area */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col">
        {children}
      </main>

      {/* Sticky Field Quick Action Bar on Mobile */}
      <footer className="sticky bottom-0 z-30 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 p-2.5 shadow-xs backdrop-blur-md">
        <div className="max-w-md mx-auto flex items-center justify-around text-xs font-bold">
          <Link
            href="/ops/field"
            className="flex-1 flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl bg-amber-400 text-slate-950 font-extrabold active:scale-95 transition-transform shadow-2xs"
          >
            <WrenchIcon className="w-4 h-4" />
            <span>Active Tasks</span>
          </Link>
          <div className="w-2" />
          <Link
            href="/ops/verifications"
            className="flex-1 flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-transform"
          >
            <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Completed</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
