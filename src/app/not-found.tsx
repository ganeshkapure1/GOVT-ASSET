import React from 'react';
import Link from 'next/link';
import { SearchIcon, HomeIcon, PlusIcon } from '@/components/ui/icons';

/**
 * Global 404 Not Found Page for GovAsset.
 */
export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-[#F8FAFC] dark:bg-[#090D16]">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-[#0B4FC2] dark:text-blue-400 mx-auto mb-6 shadow-sm">
          <SearchIcon className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">
          Page Not Found (404)
        </h1>

        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
          The civic resource, tracking reference, or portal route you requested could not be found. Please check the reference number or navigate using the options below.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B4FC2] hover:bg-blue-800 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all"
          >
            <HomeIcon className="w-4 h-4" />
            <span>Civic Home</span>
          </Link>

          <Link
            href="/track"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold border border-slate-200 dark:border-slate-700 transition-all"
          >
            <SearchIcon className="w-4 h-4" />
            <span>Track Grievance</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

