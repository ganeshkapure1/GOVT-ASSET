'use client';

import React, { useEffect } from 'react';
import { ShieldAlertIcon, RefreshCwIcon } from '@/components/ui/icons';

/**
 * Global Error Boundary for root layout crashes.
 * Enforces resilient full-document recovery UI.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GovAsset Critical System Crash]:', error?.message || error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-[#F8FAFC] text-slate-900 font-sans antialiased min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto mb-6 shadow-sm">
            <ShieldAlertIcon className="w-8 h-8" />
          </div>

          <h1 className="text-xl font-extrabold text-slate-900 mb-2">
            GovAsset System Recovery
          </h1>

          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            The civic platform experienced an unexpected layout interruption. Your data is protected.
          </p>

          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#0B4FC2] hover:bg-blue-800 text-white text-sm font-bold shadow-md transition-all"
          >
            <RefreshCwIcon className="w-4 h-4" />
            <span>Restore Platform</span>
          </button>
        </div>
      </body>
    </html>
  );
}

