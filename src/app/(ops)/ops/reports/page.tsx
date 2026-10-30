'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { FileTextIcon, ShieldCheckIcon, ClockIcon, CheckCircleIcon, ArrowRightIcon } from '@/components/ui/icons';
import { useOpsContext } from '@/context/OpsContext';

export default function OpsWardReportsPage() {
  const { corporation } = useOpsContext();
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-civic-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-brand-blue dark:text-blue-400 text-xs font-bold mb-1 border border-blue-200/50 dark:border-blue-900/50">
            <FileTextIcon className="w-3.5 h-3.5" />
            Performance Analytics
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-civic-900 dark:text-white tracking-tight">
            Jurisdiction Operational Performance &amp; SLA Reports
          </h1>
          <p className="text-xs sm:text-sm text-civic-600 dark:text-slate-400 mt-1">
            {corporation?.name || 'Municipal Corporation'} ({corporation?.city || 'Municipal Area'}) • Monthly Civic Infrastructure Turnaround Metrics
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => alert('Phase 8: Full automated PDF/Excel report export will be generated from PostgreSQL metrics.')}
          leftIcon={<FileTextIcon className="w-4 h-4" />}
          className="rounded-xl font-bold"
        >
          Export Summary Report
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-slate-900 border border-civic-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-civic-500 dark:text-slate-400 uppercase tracking-wider">
                Mean Time to Acknowledge (MTTA)
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-brand-blue dark:text-blue-400">
                <ClockIcon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-civic-900 dark:text-white font-mono">4.2 hrs</span>
              <Badge className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                Target &lt; 24h
              </Badge>
            </div>
          </div>
          <p className="text-xs text-civic-500 dark:text-slate-400 mt-3 pt-3 border-t border-civic-100 dark:border-slate-800">
            Compliant across 98% of intake queue.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-civic-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-civic-500 dark:text-slate-400 uppercase tracking-wider">
                Mean Time to Resolve (MTTR)
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <ShieldCheckIcon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-civic-900 dark:text-white font-mono">38.4 hrs</span>
              <Badge className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                Target &lt; 72h
              </Badge>
            </div>
          </div>
          <p className="text-xs text-civic-500 dark:text-slate-400 mt-3 pt-3 border-t border-civic-100 dark:border-slate-800">
            High-priority pothole and road repair average.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-civic-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-civic-500 dark:text-slate-400 uppercase tracking-wider">
                Citizen First-Time Approval
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircleIcon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">92.6%</span>
              <Badge className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                Dispute &lt; 8%
              </Badge>
            </div>
          </div>
          <p className="text-xs text-civic-500 dark:text-slate-400 mt-3 pt-3 border-t border-civic-100 dark:border-slate-800">
            7-day post-resolution satisfaction rating.
          </p>
        </div>
      </div>

      {/* Category Performance Breakdown */}
      <div className="bg-white dark:bg-slate-900 border border-civic-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-subtle space-y-4">
        <div className="flex items-center justify-between border-b border-civic-100 dark:border-slate-800 pb-3">
          <h2 className="text-sm font-extrabold text-civic-900 dark:text-white uppercase tracking-wider">
            Turnaround by Asset Category (Current Month)
          </h2>
          <span className="text-xs text-civic-500 dark:text-slate-400 font-mono">Total Cases: 81</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-civic-200 dark:border-slate-800 text-civic-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3">Category</th>
                <th className="py-3">Total Assigned</th>
                <th className="py-3">Resolved</th>
                <th className="py-3">Avg. MTTR</th>
                <th className="py-3 text-right">SLA Adherence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-civic-100 dark:divide-slate-800 text-civic-800 dark:text-slate-200">
              <tr className="hover:bg-civic-50/60 dark:hover:bg-slate-800/40 transition-colors">
                <td className="py-3.5 font-bold text-civic-900 dark:text-white">Damaged Roads &amp; Potholes</td>
                <td className="py-3.5 font-mono">38</td>
                <td className="py-3.5 font-bold font-mono text-civic-900 dark:text-white">35</td>
                <td className="py-3.5 font-mono text-civic-600 dark:text-slate-400">36 hrs</td>
                <td className="py-3.5 text-right text-emerald-600 dark:text-emerald-400 font-bold font-mono">94.7%</td>
              </tr>
              <tr className="hover:bg-civic-50/60 dark:hover:bg-slate-800/40 transition-colors">
                <td className="py-3.5 font-bold text-civic-900 dark:text-white">Streetlights &amp; Lighting</td>
                <td className="py-3.5 font-mono">24</td>
                <td className="py-3.5 font-bold font-mono text-civic-900 dark:text-white">23</td>
                <td className="py-3.5 font-mono text-civic-600 dark:text-slate-400">22 hrs</td>
                <td className="py-3.5 text-right text-emerald-600 dark:text-emerald-400 font-bold font-mono">95.8%</td>
              </tr>
              <tr className="hover:bg-civic-50/60 dark:hover:bg-slate-800/40 transition-colors">
                <td className="py-3.5 font-bold text-civic-900 dark:text-white">Water Leakage &amp; Drainage</td>
                <td className="py-3.5 font-mono">19</td>
                <td className="py-3.5 font-bold font-mono text-civic-900 dark:text-white">17</td>
                <td className="py-3.5 font-mono text-civic-600 dark:text-slate-400">18 hrs</td>
                <td className="py-3.5 text-right text-emerald-600 dark:text-emerald-400 font-bold font-mono">89.5%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
