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
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [isQueueLoading, setIsQueueLoading] = useState(true);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal / Drawer states
  const [reviewDrawerComplaint, setReviewDrawerComplaint] = useState<ComplaintDrawerData | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [reworkModalItem, setReworkModalItem] = useState<ComplaintItem | null>(null);
  const [reworkReason, setReworkReason] = useState<string>('');
  const [eligibleWorkers, setEligibleWorkers] = useState<EligibleWorker[]>([]);
  const [otherWorkers, setOtherWorkers] = useState<EligibleWorker[]>([]);
  const [detectedWorkType, setDetectedWorkType] = useState<any>(null);
  const [noQualifiedWorkersNotice, setNoQualifiedWorkersNotice] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch dynamic active field workers for corporation
  const fetchWorkers = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/ops/workers?departmentId=all');
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
      url.searchParams.set('dept', departmentFilter);
      url.searchParams.set('ward', cityFilter);

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
  }, [statusFilter, departmentFilter, cityFilter]);

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
  }, [search, statusFilter, priorityFilter, departmentFilter, cityFilter, pageSize]);

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

  const handleDirectAssign = (complaint: ComplaintItem) => {
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
    setAssignModalOpen(true);
    fetch(`/api/v1/ops/complaints/${complaint.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success && json.data) {
          if (json.data.eligibleWorkers?.length) setEligibleWorkers(json.data.eligibleWorkers);
          if (json.data.otherWorkers?.length) setOtherWorkers(json.data.otherWorkers);
          if (json.data.workType) setDetectedWorkType(json.data.workType);
        }
      })
      .catch(() => {});
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

  const handleApproveVerification = async (complaintId: string, ref: string, version: number) => {
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/v1/ops/complaints/${complaintId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'APPROVE',
          expectedVersion: version,
          notes: 'Work inspected and approved by operations officer. Resolution verified.',
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionNotice({
          type: 'success',
          message: `Work Order ${ref} approved! Complaint transitioned to VERIFIED_RESOLVED.`,
        });
        await fetchQueue();
        if (reviewDrawerComplaint?.id === complaintId) {
          setReviewDrawerComplaint(null);
        }
      } else {
        setActionNotice({
          type: 'error',
          message: `Approval failed: ${json?.error?.message || 'Unauthorized'}`,
        });
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Network error while approving complaint.' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmRework = async () => {
    if (!reworkModalItem) return;
    if (!reworkReason.trim()) {
      alert('Please enter specific rework instructions.');
      return;
    }
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/v1/ops/complaints/${reworkModalItem.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REJECT',
          expectedVersion: reworkModalItem.version,
          rejectionReason: reworkReason.trim(),
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionNotice({
          type: 'success',
          message: `Work Order ${reworkModalItem.ref} returned for rework (reverted to IN_PROGRESS).`,
        });
        setReworkModalItem(null);
        setReworkReason('');
        await fetchQueue();
        if (reviewDrawerComplaint?.id === reworkModalItem.id) {
          setReviewDrawerComplaint(null);
        }
      } else {
        setActionNotice({
          type: 'error',
          message: `Rework action failed: ${json?.error?.message || 'Unauthorized'}`,
        });
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Network error while returning complaint for rework.' });
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
            Operational grievance &amp; work order queue across all civic categories (Pan-India)
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="sm:col-span-2 lg:col-span-2 relative">
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

          {/* Department / Category Filter */}
          <div>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B4FC2]"
            >
              <option value="all">All Departments (All Defects)</option>
              <option value="44444444-4444-4444-4444-444444440001">Damaged Roads &amp; Potholes</option>
              <option value="44444444-4444-4444-4444-444444440002">Streetlights &amp; Electrical</option>
              <option value="44444444-4444-4444-4444-444444440003">Water Leakage &amp; Sewage</option>
              <option value="44444444-4444-4444-4444-444444440004">Solid Waste &amp; Sanitation</option>
            </select>
          </div>

          {/* City / Jurisdiction Scope Filter */}
          <div>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B4FC2]"
            >
              <option value="all">All Cities (Pan-India)</option>
              <option value="11111111-1111-1111-1111-111111110002">Chhatrapati Sambhajinagar</option>
              <option value="11111111-1111-1111-1111-111111111111">Pune</option>
              <option value="c217517c-ad32-4811-8dce-79e8a901678d">Mumbai / MMR</option>
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

                      {item.status === 'WORK_COMPLETED' && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleApproveVerification(item.id, item.ref, item.version)}
                            disabled={isActionLoading}
                            className="text-xs py-1 px-2.5 rounded-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs flex items-center gap-1"
                          >
                            <CheckCircleIcon className="w-3.5 h-3.5" />
                            <span>Approve &amp; Resolve</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setReworkModalItem(item);
                              setReworkReason('');
                            }}
                            disabled={isActionLoading}
                            className="text-xs py-1 px-2.5 rounded-lg font-medium text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            Reject Completion
                          </Button>
                        </>
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
        isOpen={Boolean(reviewDrawerComplaint) && !assignModalOpen && !rejectModalOpen && !reworkModalItem}
        onClose={() => setReviewDrawerComplaint(null)}
        complaint={reviewDrawerComplaint}
        onValidate={handleValidate}
        onOpenAssignModal={() => setAssignModalOpen(true)}
        onOpenRejectModal={() => setRejectModalOpen(true)}
        onLinkDuplicate={handleLinkDuplicate}
        onApproveVerification={() => {
          if (reviewDrawerComplaint) {
            handleApproveVerification(
              reviewDrawerComplaint.id,
              reviewDrawerComplaint.ref,
              reviewDrawerComplaint.version || 1
            );
          }
        }}
        onRejectVerification={() => {
          if (reviewDrawerComplaint) {
            const found = complaints.find((c) => c.id === reviewDrawerComplaint.id);
            if (found) {
              setReworkModalItem(found);
              setReworkReason('');
            }
          }
        }}
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

      {/* Rework Modal for Awaiting Verification Work Orders */}
      {reworkModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full shadow-elevated space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangleIcon className="w-5 h-5 text-amber-500" />
                <span>Return for Rework: {reworkModalItem.ref}</span>
              </h3>
              <button
                type="button"
                onClick={() => setReworkModalItem(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Explain why the completed work order did not pass quality inspection. The grievance will be returned to the assigned field crew in <strong className="text-amber-600 dark:text-amber-400">IN_PROGRESS</strong> status for rework.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Rework Instructions &amp; Corrective Notes *
              </label>
              <textarea
                value={reworkReason}
                onChange={(e) => setReworkReason(e.target.value)}
                placeholder="E.g. Asphalt compaction uneven at southern perimeter; road surface requires re-leveling and sealing."
                rows={3}
                className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B4FC2]"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReworkModalItem(null)}
                disabled={isActionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmRework}
                isLoading={isActionLoading}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                Confirm Return for Rework
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
