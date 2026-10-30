'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { StatusBadge, PriorityBadge, ComplaintStatus, ComplaintPriority, SLAHealth } from '@/components/ui/Badge';
import { ComplaintDrawer, ComplaintDrawerData } from '@/components/ops/ComplaintDrawer';
import { AssignModal, EligibleWorker } from '@/components/ops/AssignModal';
import { RejectModal } from '@/components/ops/RejectModal';
import { CircularGauge } from '@/components/shared/CircularGauge';
import { TrendChart } from '@/components/shared/TrendChart';
import { useOpsContext } from '@/context/OpsContext';
import {
  SearchIcon,
  MapPinIcon,
  CheckCircleIcon,
  ClockIcon,
  WrenchIcon,
  BuildingIcon,
  ArrowRightIcon,
} from '@/components/ui/icons';

interface ComplaintItem {
  id: string;
  ref: string;
  reporterName: string;
  category: string;
  landmark: string;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  slaHealth: SLAHealth;
  slaTime: string;
  date: string;
  submittedAgo: string;
  version: number;
  assignedWorker?: string | null;
}

interface OperationalMetrics {
  pendingCount: number;
  inProgressCount: number;
  solvedCount: number;
  totalCount: number;
  categoryBreakdown: Array<{
    name: string;
    percentage: number;
    color: string;
    count: number;
  }>;
}

export default function OpsTriagePage() {
  const {
    user,
    corporation,
    locationLabel,
    hasValidJurisdiction,
  } = useOpsContext();

  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [metrics, setMetrics] = useState<OperationalMetrics>({
    pendingCount: 0,
    inProgressCount: 0,
    solvedCount: 0,
    totalCount: 0,
    categoryBreakdown: [],
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUBMITTED' | 'ASSIGNED' | 'IN_PROGRESS' | 'VERIFIED_RESOLVED'>('ALL');
  const [reviewDrawerComplaint, setReviewDrawerComplaint] = useState<ComplaintDrawerData | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionNoticeType, setActionNoticeType] = useState<'success' | 'error'>('success');
  const [eligibleWorkers, setEligibleWorkers] = useState<EligibleWorker[]>([]);
  const [otherWorkers, setOtherWorkers] = useState<EligibleWorker[]>([]);
  const [detectedWorkType, setDetectedWorkType] = useState<any>(null);
  const [noQualifiedWorkersNotice, setNoQualifiedWorkersNotice] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isQueueLoading, setIsQueueLoading] = useState(false);

  const fetchQueue = useCallback(async () => {
    try {
      setIsQueueLoading(true);

      // 1. Fetch dynamic active field workers for corporation
      try {
        const workersRes = await fetch('/api/v1/ops/workers');
        if (workersRes.ok) {
          const wJson = await workersRes.json();
          if (wJson.success && Array.isArray(wJson.data)) {
            setEligibleWorkers(wJson.data);
          }
        }
      } catch {
        // Continue queue fetch even if workers fail
      }

      // 2. Fetch scoped queue and metrics
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
            landmark: c.landmarkAddress,
            status: c.status,
            priority:
              c.priority?.replace('_CRITICAL', '').replace('_HIGH', '').replace('_MEDIUM', '').replace('_LOW', '') || 'P3',
            slaHealth: c.status === 'VERIFIED_RESOLVED' || c.status === 'CLOSED_RESOLVED' ? 'ON_TRACK' : 'AT_RISK',
            slaTime: '18h remaining',
            date: new Date(c.createdAt).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }),
            submittedAgo: 'Recent',
            version: c.version,
            assignedWorker: c.assignedWorker,
          }));

          setComplaints(mapped);

          if (json.metrics) {
            setMetrics(json.metrics);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load complaints queue:', err);
    } finally {
      setIsQueueLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleOpenReview = async (complaint: ComplaintItem) => {
    setReviewDrawerComplaint(complaint);
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
    } catch {}
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
        setActionNoticeType('success');
        setActionNotice(`Complaint ${reviewDrawerComplaint.ref} triaged and validated successfully.`);
        fetchQueue();
        setReviewDrawerComplaint(null);
      } else {
        setActionNoticeType('error');
        setActionNotice(`Triage action failed: ${json?.error?.message || 'Unauthorized'}`);
      }
    } catch {
      setActionNoticeType('error');
      setActionNotice('Network error while processing triage action.');
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
          workerNotes: workerNotes || 'Dispatched via Operations Console triage bench.',
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
        setActionNoticeType('success');
        setActionNotice(
          `Work order ${reviewDrawerComplaint.ref} assigned to ${assignedLead?.fullName || 'crew lead'}. Status updated to ASSIGNED.`
        );
        fetchQueue();
        setAssignModalOpen(false);
        setReviewDrawerComplaint(null);
      } else {
        setActionNoticeType('error');
        setActionNotice(`Assignment failed: ${json?.error?.message || 'Unauthorized'}`);
      }
    } catch {
      setActionNoticeType('error');
      setActionNotice('Network error while creating field assignment.');
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
        setActionNoticeType('success');
        setActionNotice(`Complaint ${reviewDrawerComplaint.ref} marked REJECTED_INVALID. Notification dispatched.`);
        fetchQueue();
        setRejectModalOpen(false);
        setReviewDrawerComplaint(null);
      } else {
        setActionNoticeType('error');
        setActionNotice(`Rejection failed: ${json?.error?.message || 'Unauthorized'}`);
      }
    } catch {
      setActionNoticeType('error');
      setActionNotice('Network error while rejecting complaint.');
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
        setActionNoticeType('success');
        setActionNotice(`Complaint ${reviewDrawerComplaint.ref} successfully linked as duplicate of ${masterRef}.`);
        fetchQueue();
        setReviewDrawerComplaint(null);
      } else {
        setActionNoticeType('error');
        setActionNotice(`Failed to link duplicate: ${json?.error?.message || 'Unauthorized'}`);
      }
    } catch {
      setActionNoticeType('error');
      setActionNotice('Network error while linking duplicate complaint.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const filtered = complaints.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.ref.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      c.reporterName.toLowerCase().includes(q) ||
      c.landmark.toLowerCase().includes(q) ||
      (c.assignedWorker && c.assignedWorker.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Action Notification Banner */}
      {actionNotice && (
        <div
          className={`p-3.5 border rounded-xl text-xs flex items-center justify-between shadow-subtle ${
            actionNoticeType === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-bold">
              {actionNoticeType === 'success' ? 'Success:' : 'Notice:'}
            </span>
            <span>{actionNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="font-bold ml-2 underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TOP UNIFIED METRIC SUMMARY CARD */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-subtle transition-colors">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 lg:gap-0 lg:divide-x divide-slate-100 dark:divide-slate-800">
          {/* 1. Pending Metric */}
          <div className="lg:pr-6 flex flex-col justify-between relative pb-3">
            <div>
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
                <ClockIcon className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Pending Review</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {locationLabel}
              </p>
            </div>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
                {metrics.pendingCount}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                Active
              </span>
            </div>
            <div className="absolute bottom-0 left-0 right-4 h-1 bg-[#0B4FC2] dark:bg-blue-500 rounded-full" />
          </div>

          {/* 2. In Progress Metric */}
          <div className="lg:px-6 flex flex-col justify-between relative pb-3">
            <div>
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-[#0B4FC2] dark:text-blue-400 mb-3">
                <WrenchIcon className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Assigned / In Progress</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Field Crews Active</p>
            </div>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
                {metrics.inProgressCount}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                On Site
              </span>
            </div>
            <div className="absolute bottom-0 left-4 right-4 h-1 bg-[#06B6D4] dark:bg-cyan-500 rounded-full" />
          </div>

          {/* 3. Solved Metric */}
          <div className="lg:px-6 flex flex-col justify-between relative pb-3">
            <div>
              <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-3">
                <CheckCircleIcon className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Resolved</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Quality Verified</p>
            </div>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
                {metrics.solvedCount}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Closed
              </span>
            </div>
            <div className="absolute bottom-0 left-4 right-4 h-1 bg-[#F59E0B] dark:bg-amber-500 rounded-full" />
          </div>

          {/* 4. Donut Circular Service Level Gauge */}
          <div className="lg:px-6 flex flex-col items-center justify-center">
            <CircularGauge
              percentage={
                metrics.totalCount > 0
                  ? Math.round((metrics.solvedCount / metrics.totalCount) * 100)
                  : 85
              }
              label="Resolution Rate"
              target="Target 75%"
              size={120}
              strokeWidth={9}
              strokeColor="#10B981"
            />
          </div>

          {/* 5. Active Corporation Summary Card */}
          <div className="lg:pl-6 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-[#0B4FC2] dark:text-blue-400 mb-1.5 shadow-2xs">
              <BuildingIcon className="w-6 h-6" />
            </div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
              {corporation ? corporation.city : 'Municipal Corp'}
            </h4>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {corporation ? corporation.code : 'GOV-ASSET'}
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-extrabold text-slate-900 dark:text-white font-mono">
                {metrics.totalCount}
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Cases</span>
            </div>
          </div>
        </div>
      </section>

      {/* DIRECT JUMP BANNERS: COMPLAINTS QUEUE & MANAGE WORKERS */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Complaints Queue */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-900/60 rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#0B4FC2] dark:text-blue-400">
              Operations Complaints Queue
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Triage &amp; Dispatch Grievances
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {metrics.pendingCount} case(s) open for triage in {corporation?.city || 'this jurisdiction'}. Full table search, multi-filters, and inline crew assignment.
            </p>
          </div>
          <div>
            <Link href="/ops/complaints">
              <Button
                variant="primary"
                size="sm"
                rightIcon={<ArrowRightIcon className="w-4 h-4" />}
                className="font-bold shadow-xs whitespace-nowrap"
              >
                View Full Complaints Queue
              </Button>
            </Link>
          </div>
        </div>

        {/* Card 2: Manage Workers & Onboarding */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Workforce Governance
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Manage Workers / Add Worker
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Manage field personnel by technical skills &amp; work types. Onboard new staff with scrypt credentials and monitor active task distribution.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/ops/crew">
              <Button
                variant="primary"
                size="sm"
                className="font-bold shadow-xs whitespace-nowrap bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                + Manage Workers / Add Worker
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* MIDDLE SECTION: TOTAL COMPLAINTS TREND CHART */}
      <section>
        <TrendChart />
      </section>

      {/* BOTTOM SECTION: TWO-COLUMN DATA PRESENTATION */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Recent Complaints Table */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-subtle space-y-4 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Recent Queue Snapshot
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Filtered by: <span className="font-semibold text-[#0B4FC2] dark:text-blue-400">{locationLabel}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/ops/complaints">
                <Button variant="outline" size="sm" className="text-xs font-semibold">
                  View Full Queue ({filtered.length}) →
                </Button>
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[11px] font-semibold">
                  <th className="pb-3">Ticket / Date</th>
                  <th className="pb-3">Reporter</th>
                  <th className="pb-3">Category & Location</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {filtered.slice(0, 5).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="py-3 whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-900 dark:text-white">{item.ref}</div>
                      <div className="text-[10px] text-slate-400">{item.date}</div>
                    </td>
                    <td className="py-3 whitespace-nowrap">
                      <div className="font-bold text-slate-900 dark:text-white">{item.reporterName}</div>
                      {item.assignedWorker && (
                        <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                          Lead: {item.assignedWorker}
                        </div>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{item.category}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                        {item.landmark}
                      </div>
                    </td>
                    <td className="py-3 whitespace-nowrap">
                      {item.status === 'SUBMITTED' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border border-[#0B4FC2] text-[#0B4FC2] bg-blue-50 dark:bg-slate-800 dark:text-blue-400 dark:border-blue-500">
                          Open
                        </span>
                      ) : item.status === 'ASSIGNED' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border border-purple-500 text-purple-700 bg-purple-50 dark:bg-slate-800 dark:text-purple-400 dark:border-purple-500">
                          Assigned
                        </span>
                      ) : item.status === 'IN_PROGRESS' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border border-amber-500 text-amber-700 bg-amber-50 dark:bg-slate-800 dark:text-amber-400 dark:border-amber-500">
                          In Progress
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#10B981] text-white">
                          Resolved
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenReview(item)}
                          className="rounded-lg text-xs py-1"
                        >
                          Review
                        </Button>

                        {/* Visible Assignment Action Button */}
                        {(item.status === 'SUBMITTED' || item.status === 'TRIAGED_VALIDATED') && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleDirectAssign(item)}
                            className="rounded-lg text-xs py-1 font-semibold shadow-2xs"
                          >
                            Assign Crew
                          </Button>
                        )}

                        {(item.status === 'ASSIGNED' || item.status === 'IN_PROGRESS') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDirectAssign(item)}
                            className="rounded-lg text-xs py-1 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/60"
                          >
                            Reassign
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && !isQueueLoading && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <div className="max-w-sm mx-auto space-y-1.5">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          No complaints found for {corporation?.city || 'this jurisdiction'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Citizen grievances registered for {corporation?.city || 'this jurisdiction'} will appear here automatically.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}

                {isQueueLoading && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                      Loading complaints...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Showing recent triage activity</span>
            <Link
              href="/ops/complaints"
              className="text-[#0B4FC2] dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
            >
              <span>Open Full Complaints Queue ({filtered.length})</span>
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Right Column (5 cols): Complaints in Category Progress Bars */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-subtle space-y-6 transition-colors">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Complaints by Category
              </h3>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                {corporation?.city || 'City'} Distribution
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-[#0B4FC2] dark:text-blue-400">
              {metrics.totalCount} Total
            </span>
          </div>

          <div className="space-y-5">
            {metrics.categoryBreakdown.length > 0 ? (
              metrics.categoryBreakdown.map((cat, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                    <span>{cat.name}</span>
                    <span className="font-mono text-slate-600 dark:text-slate-400">
                      {cat.count} ({cat.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${cat.color} rounded-full transition-all duration-700`}
                      style={{ width: `${Math.max(cat.percentage, 4)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No categorical complaints logged in this jurisdiction scope.
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Overall intake resolution velocity</span>
            <span className="font-bold text-[#0B4FC2] dark:text-blue-400">Optimal</span>
          </div>
        </div>
      </section>

      {/* Dedicated Review Drawer */}
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

      {/* Dedicated Assignment Modal */}
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

      {/* Dedicated Rejection Modal */}
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
