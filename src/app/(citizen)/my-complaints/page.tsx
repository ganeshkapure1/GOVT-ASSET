'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import {
  ShieldCheckIcon,
  SearchIcon,
  PlusIcon,
  MapPinIcon,
  CheckCircleIcon,
  ClockIcon,
  CameraIcon,
} from '@/components/ui/icons';

interface ComplaintEvidenceItem {
  id: string;
  stage: string;
  fileKey: string;
  mimeType: string;
}

interface ComplaintItem {
  id?: string;
  ref: string;
  title: string;
  description?: string;
  category: string;
  ward: string;
  date: string;
  status: any;
  priority: any;
  landmark: string;
  evidence?: ComplaintEvidenceItem[];
  workerNotes?: string | null;
  assignedWorker?: string | null;
  completedAt?: string | null;
}

export default function MyComplaintsPage() {
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'RESOLVED'>('ALL');
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadComplaints = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await fetch('/api/v1/citizen/my-complaints');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const mapped = json.data.map((c: any) => {
            const activeAssignment = c.assignments?.[0];
            return {
              id: c.id,
              ref: c.referenceNumber,
              title: c.title,
              description: c.description || '',
              category: c.category?.nameEn || 'Civic Asset',
              ward: c.jurisdiction?.name || 'Local Jurisdiction',
              date: new Date(c.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              }),
              status: c.status,
              priority: c.priority?.replace('_CRITICAL', '').replace('_HIGH', '').replace('_MEDIUM', '').replace('_LOW', '') || 'P3',
              landmark: c.landmarkAddress,
              evidence: c.evidence || [],
              workerNotes: activeAssignment?.workerNotes || null,
              assignedWorker: activeAssignment?.assignedWorker?.fullName || null,
              completedAt: activeAssignment?.completedAt || null,
            };
          });
          setComplaints(mapped);
          setIsLoading(false);
          setIsRefreshing(false);
          return;
        }
      }
    } catch {
      // Fallback for offline or error mode
    }

    setComplaints([]);
    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  const filtered = complaints.filter((c) => {
    if (filter === 'ACTIVE') return c.status !== 'VERIFIED_RESOLVED' && c.status !== 'CLOSED';
    if (filter === 'RESOLVED') return c.status === 'VERIFIED_RESOLVED' || c.status === 'CLOSED';
    return true;
  });

  const activeCount = complaints.filter((c) => c.status !== 'VERIFIED_RESOLVED' && c.status !== 'CLOSED').length;
  const resolvedCount = complaints.filter((c) => c.status === 'VERIFIED_RESOLVED' || c.status === 'CLOSED').length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-6 px-4">
      {/* Informative Banner */}
      <div className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 rounded-2xl p-4 text-xs text-brand-dark dark:text-blue-200 flex items-start gap-3 shadow-subtle backdrop-blur-xs transition-colors">
        <ShieldCheckIcon className="w-5 h-5 text-brand-blue dark:text-blue-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-sm block text-brand-blue dark:text-blue-300">
            Citizen Grievance Redressal Tracker
          </span>
          <p className="mt-0.5 text-civic-700 dark:text-slate-300">
            Track and audit all grievances registered under your mobile number with verified before/after photographic proof and SLA records.
          </p>
        </div>
      </div>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            My Submitted Civic Complaints
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            Track and manage all complaints registered under your verified phone number.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadComplaints(true)}
            isLoading={isRefreshing}
            className="text-xs font-semibold"
          >
            {isRefreshing ? 'Syncing...' : 'Sync Live Status'}
          </Button>
          <Link href="/report">
            <Button variant="primary" size="sm" leftIcon={<PlusIcon className="w-4 h-4" />}>
              New Complaint
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold pb-1">
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={`px-3.5 py-2 rounded-t-xl transition-all ${
            filter === 'ALL'
              ? 'bg-blue-50 dark:bg-blue-950/60 text-[#0B4FC2] dark:text-blue-400 border-b-2 border-[#0B4FC2] dark:border-blue-500 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          All Complaints ({complaints.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('ACTIVE')}
          className={`px-3.5 py-2 rounded-t-xl transition-all ${
            filter === 'ACTIVE'
              ? 'bg-blue-50 dark:bg-blue-950/60 text-[#0B4FC2] dark:text-blue-400 border-b-2 border-[#0B4FC2] dark:border-blue-500 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          In Progress ({activeCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter('RESOLVED')}
          className={`px-3.5 py-2 rounded-t-xl transition-all ${
            filter === 'RESOLVED'
              ? 'bg-blue-50 dark:bg-blue-950/60 text-[#0B4FC2] dark:text-blue-400 border-b-2 border-[#0B4FC2] dark:border-blue-500 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Resolved / Closed ({resolvedCount})
        </button>
      </div>

      {/* Complaints List / Empty / Loading State */}
      {isLoading ? (
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-500">
          Loading your registered complaints...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <p className="text-sm font-bold text-slate-900 dark:text-white">No complaints found</p>
          <p className="text-xs text-slate-500">There are no records matching your current filter selection.</p>
          <Link href="/report">
            <Button variant="outline" size="sm" className="mt-2">Report an Issue</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => (
            <div
              key={item.ref}
              className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-card hover:shadow-lg transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-[#0B4FC2] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full">
                      {item.ref}
                    </span>
                    <StatusBadge status={item.status} />
                    <PriorityBadge priority={item.priority} />
                  </div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white pt-1">
                    {item.title}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-0.5">
                    <MapPinIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>{item.landmark}</span>
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 pt-1 leading-relaxed whitespace-pre-line line-clamp-3">
                    {item.description || 'No detailed description provided.'}
                  </p>

                  {/* Worker Work-Completed Highlight Card */}
                  {item.status === 'WORK_COMPLETED' && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/70 space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-950 dark:text-emerald-100">
                        <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Work Completed by Field Crew — Awaiting Supervisor Verification</span>
                      </div>
                      {item.workerNotes && (
                        <p className="text-emerald-800 dark:text-emerald-300 text-[11px] pt-0.5">
                          <strong>Worker Completion Note:</strong> {item.workerNotes}
                        </p>
                      )}
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        A municipal supervisor is assigned to perform physical verification of the repaired site.
                      </p>
                    </div>
                  )}

                  {/* Verified & Resolved Highlight Card */}
                  {item.status === 'VERIFIED_RESOLVED' && (
                    <div className="p-3 bg-emerald-100/70 dark:bg-emerald-900/40 rounded-xl border border-emerald-300 dark:border-emerald-700 space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-950 dark:text-emerald-100">
                        <CheckCircleIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-300 shrink-0" />
                        <span>Verified &amp; Resolved by Municipal Supervisor</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                        Physical repairs were inspected on-site and approved for closure.
                      </p>
                    </div>
                  )}

                  {/* Evidence Photographs (Before & After) */}
                  {item.evidence && item.evidence.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                        <CameraIcon className="w-3 h-3 text-[#0B4FC2] dark:text-blue-400" />
                        <span>Photographic Evidence ({item.evidence.length})</span>
                      </span>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {item.evidence.map((ev, idx) => (
                          <div key={ev.id || idx} className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 w-14 h-14 bg-slate-50 dark:bg-slate-800">
                            <img
                              src={`/api/v1/evidence/${encodeURIComponent(ev.fileKey)}`}
                              alt={ev.stage === 'AFTER_REPAIR' ? 'Repair photo' : 'Defect photo'}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 self-start">
                  {item.date}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Category: {item.category}</span>
                <Link href={`/track?ref=${item.ref}`}>
                  <Button variant="outline" size="sm" rightIcon={<SearchIcon className="w-3.5 h-3.5" />}>
                    Inspect Live Timeline
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
