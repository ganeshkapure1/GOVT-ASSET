import React from 'react';

/**
 * Root Loading Skeleton for Next.js App Router.
 * Surfaces instant municipal spinner & skeleton during route transitions.
 */
export default function Loading() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 bg-[#F8FAFC] dark:bg-[#090D16]">
      <div className="relative w-12 h-12 mb-4">
        <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-slate-800" />
        <div className="absolute inset-0 rounded-full border-4 border-[#0B4FC2] border-t-transparent animate-spin" />
      </div>
      <p className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 animate-pulse">
        Loading GovAsset civic portal...
      </p>
    </div>
  );
}

