'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { ShieldAlertIcon, RefreshCwIcon, HomeIcon } from '@/components/ui/icons';

/**
 * Root Error Boundary for Next.js App Router.
 * Gracefully captures unhandled runtime rendering errors, prevents blank screens,
 * and presents accessible recovery actions.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error securely without exposing PII
    console.error('[GovAsset Application Error]:', error?.message || error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-[#F8FAFC] dark:bg-[#090D16]">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto mb-6 shadow-sm">
          <ShieldAlertIcon className="w-8 h-8" />
        </div>

        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">
          Temporary Service Notice
        </h1>

        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
          The requested civic operation encountered an unexpected condition. Your grievance data remains secure. Please retry or return to the main portal.
        </p>

        {error.digest && (
          <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mb-6 bg-slate-50 dark:bg-slate-800/60 py-1.5 px-3 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
            Audit Digest: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B4FC2] hover:bg-blue-800 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-[#0B4FC2]"
          >
            <RefreshCwIcon className="w-4 h-4" />
            <span>Try Again</span>
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold border border-slate-200 dark:border-slate-700 transition-all"
          >
            <HomeIcon className="w-4 h-4" />
            <span>Civic Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

