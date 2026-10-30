'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { StatusBadge, PriorityBadge, ComplaintStatus, ComplaintPriority, SLAHealth } from '@/components/ui/Badge';
import { ComplaintDrawer, ComplaintDrawerData } from '@/components/ops/ComplaintDrawer';
import { AssignModal, EligibleWorker } from '@/components/ops/AssignModal';
import { RejectModal } from '@/components/ops/RejectModal';
import { useOpsContext } from '@/context/OpsContext';
import {
  SearchIcon,
  MapPinIcon,
  ClockIcon,
  WrenchIcon,
  UserCheckIcon,
  CloseIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
} from '@/components/ui/icons';

interface ComplaintItem {
  id: string;
  ref: string;
  reporterName: string;
  category: string;
  description: string;
  landmark: string;
  ward: string;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  slaHealth: SLAHealth;
  slaTime: string;
  date: string;
  submittedAgo: string;
  version: number;
  assignedWorker?: string | null;
  evidence?: Array<{ id: string; fileKey: string; stage: string }>;
}

export default function OpsComplaintsPage() {
  const {
    user,
    corporation,
    locationLabel,
  } = useOpsContext();

  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [isQueueLoading, setIsQueueLoading] = useState(true);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal / Drawer states
  const [reviewDrawerComplaint, setReviewDrawerComplaint] = useState<ComplaintDrawerData | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [eligibleWorkers, setEligibleWorkers] = useState<EligibleWorker[]>([]);
  const [otherWorkers, setOtherWorkers] = useState<EligibleWorker[]>([]);
  const [detectedWorkType, setDetectedWorkType] = useState<any>(null);
  const [noQualifiedWorkersNotice, setNoQualifiedWorkersNotice] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch dynamic active field workers for corporation
  const fetchWorkers = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/ops/workers');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setEligibleWorkers(json.data);
        }
      }
    } catch {
      // Non-blocking
    }
  }, []);

  // Fetch scoped queue
  const fetchQueue = useCallback(async () => {
    try {
      setIsQueueLoading(true);
      const url = new URL('/api/v1/ops/queue', window.location.origin);
      if (statusFilter !== 'ALL') {
        url.searchParams.set('status', statusFilter);
      }

      const res = await fetch(url.toString());
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const mapped: ComplaintItem[] = json.data.map((c: any) => ({
            id: c.id,
            ref: c.referenceNumber,
            reporterName: c.citizenPhone || 'Citizen Reporter',
            category: c.category?.nameEn || c.title || 'Civic Defect',
            description: c.description || '',
            landmark: c.landmarkAddress,
            ward: c.jurisdiction?.name || 'Local Jurisdiction',
            status: c.status,
            priority:
              c.priority?.replace('_CRITICAL', '').replace('_HIGH', '').replace('_MEDIUM', '').replace('_LOW', '') || 'P3',
            slaHealth: c.status === 'VERIFIED_RESOLVED' || c.status === 'CLOSED_RESOLVED' ? 'ON_TRACK' : 'AT_RISK',
            slaTime: '18h remaining',
            date: new Date(c.createdAt).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
            submittedAgo: 'Recent',
            version: c.version,
            assignedWorker: c.assignedWorker,
            evidence: c.evidence || [],
          }));

          setComplaints(mapped);
        }
      }
    } catch (err) {
      console.error('Failed to load complaints queue:', err);
    } finally {
      setIsQueueLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Filter complaints client-side by search query and priority
  const filtered = useMemo(() => {
    return complaints.filter((c) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        c.ref.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.reporterName.toLowerCase().includes(q) ||
        c.landmark.toLowerCase().includes(q) ||
        (c.assignedWorker && c.assignedWorker.toLowerCase().includes(q));

      const matchesPriority =
        priorityFilter === 'ALL' || c.priority === priorityFilter;

      return matchesSearch && matchesPriority;
    });
  }, [complaints, search, priorityFilter]);

  // Pagination calculation
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedComplaints = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, priorityFilter, pageSize]);

  const handleOpenReview = async (complaint: ComplaintItem) => {
    setReviewDrawerComplaint({
      id: complaint.id,
      ref: complaint.ref,
      reporterName: complaint.reporterName,
      category: complaint.category,
      landmark: complaint.landmark,
      status: complaint.status,
      priority: complaint.priority,
      date: complaint.date,
      description: complaint.description,
      version: complaint.version,
      evidence: complaint.evidence,
    });

    try {
      const res = await fetch(`/api/v1/ops/complaints/${complaint.id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setEligibleWorkers(json.data.eligibleWorkers || []);
          setOtherWorkers(json.data.otherWorkers || []);
          setDetectedWorkType(json.data.workType || null);
          setNoQualifiedWorkersNotice(json.data.noQualifiedWorkersNotice || null);
          setReviewDrawerComplaint((prev) =>
            prev && prev.id === complaint.id
              ? {
                  ...prev,
                  description: json.data.description,
                  version: json.data.version,
                  evidence: json.data.evidence,
                  potentialDuplicates: json.data.potentialDuplicates,
                  department: json.data.department?.name,
                }
              : prev
          );
        }
      }
    } catch {
      // Non-blocking fallback
    }
  };

  const handleDirectAssign = async (complaint: ComplaintItem) => {
    await handleOpenReview(complaint);
    setAssignModalOpen(true);
  };

  const handleValidate = async () => {
    if (!reviewDrawerComplaint) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/v1/ops/complaints/${reviewDrawerComplaint.id}/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'VALIDATE',
          expectedVersion: reviewDrawerComplaint.version,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionNotice({
          type: 'success',
          message: `Complaint ${reviewDrawerComplaint.ref} validated successfully. Status: TRIAGED_VALIDATED.`,
        });
        fetchQueue();
        setReviewDrawerComplaint(null);
      } else {
        setActionNotice({
          type: 'error',
          message: `Validation failed: ${json?.error?.message || 'Unauthorized'}`,
        });
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Network error while validating complaint.' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmAssignment = async (
    workerId: string,
    deadline: string,
    workerNotes: string,
    overrideOptions?: { allowSkillOverride?: boolean; overrideReason?: string }
  ) => {
    if (!reviewDrawerComplaint) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/v1/ops/complaints/${reviewDrawerComplaint.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedWorkerId: workerId,
          targetCompletionAt: deadline,
          workerNotes: workerNotes || 'Dispatched via Operations Console queue.',
          expectedVersion: reviewDrawerComplaint.version,
          allowSkillOverride: overrideOptions?.allowSkillOverride,
          overrideReason: overrideOptions?.overrideReason,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        const assignedLead =
          eligibleWorkers.find((w) => w.id === workerId) ||
          otherWorkers.find((w) => w.id === workerId);
        setActionNotice({
          type: 'success',
          message: `Work order ${reviewDrawerComplaint.ref} assigned to ${assignedLead?.fullName || 'crew lead'}. Status updated to ASSIGNED.`,
        });
        fetchQueue();
        setAssignModalOpen(false);
        setReviewDrawerComplaint(null);
      } else {
        setActionNotice({
          type: 'error',
          message: `Assignment failed: ${json?.error?.message || 'Unauthorized'}`,
        });
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Network error while creating field assignment.' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmRejection = async (reasonCode: string, explanation: string) => {
    if (!reviewDrawerComplaint) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/v1/ops/complaints/${reviewDrawerComplaint.id}/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REJECT',
          rejectionReason: `${reasonCode}: ${explanation}`,
          expectedVersion: reviewDrawerComplaint.version,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionNotice({
          type: 'success',
          message: `Complaint ${reviewDrawerComplaint.ref} marked REJECTED_INVALID. Notification dispatched.`,
        });
        fetchQueue();
        setRejectModalOpen(false);
        setReviewDrawerComplaint(null);
      } else {
        setActionNotice({
          type: 'error',
          message: `Rejection failed: ${json?.error?.message || 'Unauthorized'}`,
        });
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Network error while rejecting complaint.' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleLinkDuplicate = async (masterId: string, masterRef: string) => {
    if (!reviewDrawerComplaint) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/v1/ops/complaints/${reviewDrawerComplaint.id}/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'LINK_DUPLICATE',
          parentComplaintId: masterId,
          expectedVersion: reviewDrawerComplaint.version,
          internalNote: `Merged into master ticket ${masterRef}`,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionNotice({
          type: 'success',
          message: `Complaint ${reviewDrawerComplaint.ref} successfully linked as duplicate of ${masterRef}.`,
        });
        fetchQueue();
        setReviewDrawerComplaint(null);
      } else {
        setActionNotice({
          type: 'error',
          message: `Failed to link duplicate: ${json?.error?.message || 'Unauthorized'}`,
        });
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Network error while linking duplicate complaint.' });
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Action Notification Banner */}
      {actionNotice && (
        <div
          className={`p-4 border rounded-xl text-xs sm:text-sm flex items-center justify-between shadow-xs transition-colors ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? (
              <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangleIcon className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span className="font-semibold">{actionNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-xs font-bold underline ml-2 opacity-80 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Complaints Management Queue
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950 text-[#0B4FC2] dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {filtered.length} Case{filtered.length === 1 ? '' : 's'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Operational work order queue for {locationLabel}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/ops/triage">
            <Button variant="outline" size="sm" className="text-xs font-semibold">
              ← Executive Dashboard
            </Button>
          </Link>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchQueue}
            disabled={isQueueLoading}
            className="text-xs font-semibold"
          >
            {isQueueLoading ? 'Syncing...' : 'Refresh Queue'}
          </Button>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="md:col-span-2 relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference #, citizen phone, category, landmark, or worker..."
              className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B4FC2]"
            />
            <SearchIcon className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <CloseIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B4FC2]"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Open / Submitted</option>
              <option value="TRIAGED_VALIDATED">Triaged &amp; Validated</option>
              <option value="ASSIGNED">Assigned to Crew</option>
              <option value="IN_PROGRESS">Repair In Progress</option>
              <option value="WORK_COMPLETED">Awaiting Verification</option>
              <option value="VERIFIED_RESOLVED">Verified &amp; Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B4FC2]"
            >
              <option value="ALL">All Priorities</option>
              <option value="P1">P1 - Critical Hazard</option>
              <option value="P2">P2 - High Priority</option>
              <option value="P3">P3 - Standard Medium</option>
              <option value="P4">P4 - Low / Routine</option>
            </select>
          </div>
        </div>

        {/* Quick Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {['ALL', 'SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'WORK_COMPLETED', 'VERIFIED_RESOLVED'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? 'bg-[#0B4FC2] text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {st === 'ALL'
                ? 'All Cases'
                : st === 'SUBMITTED'
                ? 'Open / Submitted'
                : st === 'ASSIGNED'
                ? 'Assigned'
                : st === 'IN_PROGRESS'
                ? 'In Progress'
                : st === 'WORK_COMPLETED'
                ? 'Awaiting Verification'
                : 'Resolved'}
            </button>
          ))}
        </div>
      </div>

      {/* Complaints Table Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[11px] font-semibold">
                <th className="py-3.5 px-4">Ticket Ref</th>
                <th className="py-3.5 px-3">Category &amp; Defect Description</th>
                <th className="py-3.5 px-3">Location &amp; Defect Site</th>
                <th className="py-3.5 px-3">Priority</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3">Assigned Crew</th>
                <th className="py-3.5 px-3">Logged Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {paginatedComplaints.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  {/* Reference Number */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="font-mono font-bold text-[#0B4FC2] dark:text-blue-400 text-xs">
                      {item.ref}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      {item.reporterName}
                    </div>
                  </td>

                  {/* Category & Description */}
                  <td className="py-3.5 px-3 max-w-[280px]">
                    <div className="font-bold text-slate-900 dark:text-white truncate">
                      {item.category}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                      {item.description || 'No detailed description provided by citizen.'}
                    </p>
                    {item.evidence && item.evidence.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-mono mt-1">
                        📷 {item.evidence.length} photo{item.evidence.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </td>

                  {/* Location & Ward */}
                  <td className="py-3.5 px-3 max-w-[200px]">
                    <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {item.landmark}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      {item.ward}
                    </div>
                  </td>

                  {/* Priority */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <PriorityBadge priority={item.priority as any} />
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <StatusBadge status={item.status as any} />
                  </td>

                  {/* Assigned Worker */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    {item.assignedWorker ? (
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <UserCheckIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span>{item.assignedWorker}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Unassigned</span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-500">
                    {item.date}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenReview(item)}
                        className="text-xs py-1 px-2.5 rounded-lg"
                      >
                        Review
                      </Button>

                      {['SUBMITTED', 'TRIAGED_VALIDATED'].includes(item.status) && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleDirectAssign(item)}
                          className="text-xs py-1 px-2.5 rounded-lg font-semibold shadow-2xs"
                        >
                          Assign Crew
                        </Button>
                      )}

                      {['ASSIGNED', 'IN_PROGRESS'].includes(item.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDirectAssign(item)}
                          className="text-xs py-1 px-2.5 rounded-lg text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/60"
                        >
                          Reassign
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {paginatedComplaints.length === 0 && !isQueueLoading && (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="max-w-md mx-auto space-y-2">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        No complaints match your filters
                      </p>
                      <p className="text-xs text-slate-500">
                        Try adjusting your search query, status, or priority filters to see more results.
                      </p>
                      {(search || statusFilter !== 'ALL' || priorityFilter !== 'ALL') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearch('');
                            setStatusFilter('ALL');
                            setPriorityFilter('ALL');
                          }}
                          className="text-xs mt-2"
                        >
                          Clear All Filters
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {isQueueLoading && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-xs text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-[#0B4FC2] border-t-transparent rounded-full animate-spin" />
                      <span>Loading complaints queue from ledger...</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>per page • Total: {totalItems}</span>
          </div>

          <div className="flex items-center gap-2">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="text-xs py-1 px-2.5"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="text-xs py-1 px-2.5"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Review Drawer Component */}
      <ComplaintDrawer
        isOpen={Boolean(reviewDrawerComplaint)}
        onClose={() => setReviewDrawerComplaint(null)}
        complaint={reviewDrawerComplaint}
        onValidate={handleValidate}
        onOpenAssignModal={() => setAssignModalOpen(true)}
        onOpenRejectModal={() => setRejectModalOpen(true)}
        onLinkDuplicate={handleLinkDuplicate}
        isLoading={isActionLoading}
      />

      {/* Assign Field Crew Modal Component */}
      <AssignModal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        complaintRef={reviewDrawerComplaint?.ref || ''}
        workType={detectedWorkType}
        eligibleWorkers={eligibleWorkers}
        otherWorkers={otherWorkers}
        noQualifiedWorkersNotice={noQualifiedWorkersNotice}
        onConfirmAssignment={(workerId, deadline, notes, overrideOptions) => {
          handleConfirmAssignment(workerId, deadline, notes, overrideOptions);
        }}
        isLoading={isActionLoading}
      />

      {/* Rejection Modal Component */}
      <RejectModal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        complaintRef={reviewDrawerComplaint?.ref || ''}
        onConfirmRejection={(reasonCode, explanation) => {
          handleConfirmRejection(reasonCode, explanation);
        }}
        isLoading={isActionLoading}
      />
    </div>
  );
}
