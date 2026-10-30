'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusBadge, PriorityBadge, SLAHealthBadge } from '@/components/ui/Badge';
import { UserCheckIcon, WrenchIcon, MapPinIcon, ClockIcon } from '@/components/ui/icons';
import { useOpsContext } from '@/context/OpsContext';

interface AssignedTaskItem {
  ref: string;
  category: string;
  landmark: string;
  worker: string;
  deadline: string;
  status: 'ASSIGNED' | 'IN_PROGRESS';
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  slaHealth: 'ON_TRACK' | 'AT_RISK' | 'BREACHED';
  slaTime: string;
  progress: number;
}

export default function OpsAssignedTasksPage() {
  const { selectedWardId, selectedWardName, corporation } = useOpsContext();
  const [filter, setFilter] = useState<'ALL' | 'IN_PROGRESS' | 'ASSIGNED'>('ALL');
  const [tasks, setTasks] = useState<AssignedTaskItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadAssigned = useCallback(async () => {
    try {
      setIsLoading(true);
      const url = new URL('/api/v1/ops/queue', window.location.origin);
      if (selectedWardId) {
        url.searchParams.set('wardId', selectedWardId);
      }

      const res = await fetch(url.toString());
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const assignedComplaints = json.data.filter(
            (c: any) => c.status === 'ASSIGNED' || c.status === 'IN_PROGRESS'
          );

          const mapped: AssignedTaskItem[] = assignedComplaints.map((c: any) => ({
            ref: c.referenceNumber,
            category: c.category?.nameEn || c.title,
            landmark: c.landmarkAddress,
            worker: c.assignedWorker || 'Field Crew',
            deadline: new Date(c.resolutionDueAt || Date.now() + 86400000).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }),
            status: c.status,
            priority:
              c.priority?.replace('_CRITICAL', '').replace('_HIGH', '').replace('_MEDIUM', '').replace('_LOW', '') || 'P2',
            slaHealth: 'AT_RISK' as const,
            slaTime: 'SLA Active',
            progress: c.status === 'IN_PROGRESS' ? 60 : 25,
          }));

          setTasks(mapped);
        }
      }
    } catch (err) {
      console.error('Failed to load assigned tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedWardId]);

  useEffect(() => {
    loadAssigned();
  }, [loadAssigned]);

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'ALL') return true;
    return task.status === filter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-civic-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-brand-blue dark:text-blue-400 text-xs font-bold mb-1 border border-blue-200/50 dark:border-blue-900/50">
            <WrenchIcon className="w-3.5 h-3.5" />
            Field Operations
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-civic-900 dark:text-white tracking-tight">
            Assigned Work Orders &amp; Dispatch Queue
          </h1>
          <p className="text-xs sm:text-sm text-civic-600 dark:text-slate-400 mt-1">
            Active maintenance tasks scoped to <span className="font-semibold text-brand-blue dark:text-blue-400">{selectedWardName}</span> ({corporation?.city || 'Municipal Area'}).
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-civic-100 dark:bg-slate-800 rounded-xl border border-civic-200 dark:border-slate-700 text-xs font-semibold self-start sm:self-auto">
          {(['ALL', 'IN_PROGRESS', 'ASSIGNED'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filter === tab
                  ? 'bg-white dark:bg-slate-900 text-brand-blue dark:text-blue-400 shadow-2xs font-bold'
                  : 'text-civic-600 dark:text-slate-400 hover:text-civic-900 dark:hover:text-white'
              }`}
            >
              {tab === 'ALL' ? 'All Active' : tab === 'IN_PROGRESS' ? 'In Progress' : 'Assigned'}
            </button>
          ))}
        </div>
      </div>

      {/* Task Cards */}
      <div className="space-y-4">
        {filteredTasks.map((task) => (
          <div
            key={task.ref}
            className="bg-white dark:bg-slate-900 border border-civic-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-subtle hover:border-brand-blue/30 dark:hover:border-blue-500/30 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
          >
            <div className="space-y-3 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-extrabold text-brand-blue dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-lg border border-blue-200/60 dark:border-blue-900/50">
                  {task.ref}
                </span>
                <StatusBadge status={task.status} />
                <PriorityBadge priority={task.priority} />
                <SLAHealthBadge health={task.slaHealth} remainingTime={task.slaTime} />
              </div>

              <div>
                <h2 className="text-base sm:text-lg font-bold text-civic-900 dark:text-white">
                  {task.category}
                </h2>
                <div className="flex items-center gap-3 text-xs text-civic-600 dark:text-slate-400 flex-wrap mt-1">
                  <span className="flex items-center gap-1">
                    <MapPinIcon className="w-3.5 h-3.5 text-civic-400 dark:text-slate-500 shrink-0" />
                    <span>{task.landmark}</span>
                  </span>
                  <span className="text-civic-300 dark:text-slate-700">•</span>
                  <span className="flex items-center gap-1 font-semibold text-civic-800 dark:text-slate-200">
                    <WrenchIcon className="w-3.5 h-3.5 text-civic-500 dark:text-slate-400 shrink-0" />
                    <span>Crew: {task.worker}</span>
                  </span>
                  <span className="text-civic-300 dark:text-slate-700">•</span>
                  <span className="flex items-center gap-1 font-mono text-amber-700 dark:text-amber-400 font-semibold">
                    <ClockIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>Due: {task.deadline}</span>
                  </span>
                </div>
              </div>

              {/* Work Order Progress Bar */}
              <div className="space-y-1 max-w-md pt-1">
                <div className="flex justify-between text-[11px] font-mono text-civic-500 dark:text-slate-400">
                  <span>Field Execution Progress</span>
                  <span className="font-bold text-civic-800 dark:text-slate-200">{task.progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-civic-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      task.status === 'IN_PROGRESS'
                        ? 'bg-brand-blue dark:bg-blue-500'
                        : 'bg-civic-400 dark:bg-slate-600'
                    }`}
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredTasks.length === 0 && !isLoading && (
          <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 border border-dashed border-civic-200 dark:border-slate-800 rounded-2xl">
            <WrenchIcon className="w-8 h-8 text-civic-400 dark:text-slate-500 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-civic-800 dark:text-slate-200">
              No active field assignments found
            </p>
            <p className="text-xs text-civic-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Work orders assigned to field crews in {selectedWardName} will appear here with live execution tracking.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-12 text-xs text-slate-500 dark:text-slate-400">
            Loading assigned tasks...
          </div>
        )}
      </div>
    </div>
  );
}
