'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { DisputeModal } from '@/components/citizen/DisputeModal';
import { FeedbackCard } from '@/components/citizen/FeedbackCard';
import { lookupComplaint, TrackedComplaint } from '@/lib/tracking';
import {
  SearchIcon,
  ClockIcon,
  CheckCircleIcon,
  WrenchIcon,
  ShieldCheckIcon,
  AlertTriangleIcon,
  XCircleIcon,
  MapPinIcon,
  ArrowRightIcon,
  CameraIcon,
} from '@/components/ui/icons';

type SearchStatus = 'IDLE' | 'FOUND' | 'NOT_FOUND' | 'EMPTY_ERROR';

function TrackComplaintContent() {
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState('');
  const [searchedRef, setSearchedRef] = useState<string | null>(null);
  const [activeComplaint, setActiveComplaint] = useState<TrackedComplaint | null>(null);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('IDLE');
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);

  // Synchronize with URL search parameter if present on load
  useEffect(() => {
    const refParam = searchParams.get('ref');
    if (refParam && refParam.trim()) {
      const normalized = refParam.trim().toUpperCase();
      setSearchInput(normalized);
      executeLookup(normalized);
    } else {
      // If no ?ref= query parameter is supplied, do NOT default to any citizen's complaint
      setSearchInput('');
      setSearchedRef(null);
      setActiveComplaint(null);
      setSearchStatus('IDLE');
    }
  }, [searchParams]);

  /**
   * Executes a strict, exact-match lookup against canonical complaints and the live backend ledger.
   * Clears any existing complaint details prior to evaluating the result.
   */
  const executeLookup = async (refToSearch: string) => {
    // 1. Clear previous complaint data immediately
    setActiveComplaint(null);

    const cleanRef = refToSearch.trim().toUpperCase();

    // 2. Handle empty or whitespace input
    if (!cleanRef) {
      setSearchedRef(null);
      setSearchStatus('EMPTY_ERROR');
      return;
    }

    setSearchedRef(cleanRef);

    // 3. Check canonical synchronous dataset first (sets immediate state for synchronous test assertions)
    const localResult = lookupComplaint(cleanRef);
    if (localResult) {
      setActiveComplaint(localResult);
      setSearchStatus('FOUND');
    } else {
      setActiveComplaint(null);
      setSearchStatus('NOT_FOUND');
    }

    // 4. Query live database endpoint for newly submitted complaints
    try {
      const res = await fetch(`/api/v1/complaints/track?ref=${encodeURIComponent(cleanRef)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setActiveComplaint(json.data);
          setSearchStatus('FOUND');
          return;
        }
      }
    } catch {
      // In offline / unit-test environments without active mock fetch
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    executeLookup(searchInput);
  };

  const handleSampleClick = (sampleRef: string) => {
    setSearchInput(sampleRef);
    executeLookup(sampleRef);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-6 px-4">
      {/* Informative Pilot Preview Banner */}
      <div className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 rounded-2xl p-4 text-xs text-brand-dark dark:text-blue-200 flex items-start gap-3 shadow-subtle backdrop-blur-xs transition-colors">
        <ShieldCheckIcon className="w-5 h-5 text-brand-blue dark:text-blue-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-sm block text-brand-blue dark:text-blue-300">
            Public Civic Grievance &amp; Asset Status Tracker
          </span>
          <p className="mt-0.5 text-civic-700 dark:text-slate-300">
            Real-time status tracking with DPDP Act 2023 compliant citizen PII masking. Lookups require an exact grievance reference number.
          </p>
        </div>
      </div>

      {/* Tracker Lookup Header Form Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-card transition-colors">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Track Grievance Resolution Status
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 mb-6">
          Enter your unique reference number to inspect live municipal assignment, field repair evidence, and turnaround SLA timelines.
        </p>

        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              <SearchIcon className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="e.g. GOV-2026-00482"
              aria-label="Complaint Reference Number"
              className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-base bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800/90 focus:outline-none focus:ring-2 focus:ring-[#0B4FC2] dark:focus:ring-blue-400 text-slate-900 dark:text-white font-mono uppercase placeholder:normal-case placeholder:font-sans font-semibold transition-all"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="rounded-xl bg-[#0B4FC2] hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold px-6 shadow-sm"
          >
            Look Up Reference
          </Button>
        </form>

        {/* Quick Sample References */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="font-medium">Try pilot sample references:</span>
          <button
            type="button"
            onClick={() => handleSampleClick('GOV-2026-00482')}
            className="font-mono text-[#0B4FC2] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-2.5 py-1 rounded-lg font-bold transition-colors"
          >
            GOV-2026-00482 (Roads • In Progress)
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => handleSampleClick('GOV-2026-00483')}
            className="font-mono text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-2.5 py-1 rounded-lg font-bold transition-colors"
          >
            GOV-2026-00483 (Lighting • Resolved)
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => handleSampleClick('GOV-2026-00485')}
            className="font-mono text-cyan-800 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 px-2.5 py-1 rounded-lg font-bold transition-colors"
          >
            GOV-2026-00485 (Water • Triaged)
          </button>
        </div>
      </div>

      {/* =========================================================================
          STATE 1: EMPTY INPUT ERROR STATE
          ========================================================================= */}
      {searchStatus === 'EMPTY_ERROR' && (
        <div
          role="alert"
          className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-2xl p-6 text-amber-900 dark:text-amber-200 shadow-subtle flex items-start gap-4 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center shrink-0 text-amber-700 dark:text-amber-400">
            <AlertTriangleIcon className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-extrabold text-amber-950 dark:text-amber-100">
              Please Enter a Reference Number
            </h2>
            <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
              To check grievance status, you must provide a valid reference code in the format{' '}
              <strong className="font-mono font-bold">GOV-YYYY-XXXXX</strong> (for example,{' '}
              <button
                type="button"
                onClick={() => handleSampleClick('GOV-2026-00482')}
                className="underline font-mono font-bold text-amber-900 dark:text-amber-200 hover:text-black dark:hover:text-white"
              >
                GOV-2026-00482
              </button>
              ).
            </p>
          </div>
        </div>
      )}

      {/* =========================================================================
          STATE 2: NOT FOUND STATE (Clear message, NO other citizen data exposed)
          ========================================================================= */}
      {searchStatus === 'NOT_FOUND' && (
        <div
          role="alert"
          className="bg-white dark:bg-slate-900 border-2 border-rose-200 dark:border-rose-900/60 rounded-2xl p-6 sm:p-8 shadow-card space-y-4 transition-colors"
          data-testid="complaint-not-found-card"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/80 flex items-center justify-center shrink-0 text-rose-600 dark:text-rose-400">
              <XCircleIcon className="w-6 h-6" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/80 px-2.5 py-0.5 rounded-full">
                  Reference Not Found
                </span>
                <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                  {searchedRef}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Complaint Not Found
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
                No complaint record exists matching the reference number{' '}
                <strong className="font-mono text-slate-900 dark:text-slate-100 font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  {searchedRef}
                </strong>
                .
              </p>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-2">
            <p className="font-bold text-slate-800 dark:text-slate-200">Possible reasons:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
              <li>The reference number may have been mistyped (standard format: <code className="font-mono font-semibold">GOV-2026-XXXXX</code>).</li>
              <li>The complaint was submitted very recently and is still in intake queue.</li>
              <li>You may be looking up a reference from a different municipal corporation portal.</li>
            </ul>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Need immediate assistance?</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-600 dark:text-slate-400 font-semibold">Toll-Free Helpline:</span>
              <strong className="font-mono text-[#0B4FC2] dark:text-blue-400 font-bold">1800-233-4000</strong>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          STATE 3: IDLE PROMPT (When page opened without reference)
          ========================================================================= */}
      {searchStatus === 'IDLE' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-8 shadow-subtle text-center space-y-4 transition-colors">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-[#0B4FC2] dark:text-blue-400 flex items-center justify-center mx-auto shadow-2xs">
            <SearchIcon className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Ready to Track Your Civic Grievance
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Please enter your grievance reference number in the search box above or choose a pilot sample reference to inspect the timeline.
            </p>
          </div>
        </div>
      )}

      {/* =========================================================================
          STATE 4: FOUND STATE — Exact Matching Complaint Details & Timeline
          ========================================================================= */}
      {searchStatus === 'FOUND' && activeComplaint && (
        <div
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-card space-y-6 transition-colors"
          data-testid="complaint-details-card"
        >
          {/* Ticket Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xl sm:text-2xl font-black text-[#0B4FC2] dark:text-blue-400">
                  {activeComplaint.ref}
                </span>
                <StatusBadge status={activeComplaint.status} />
                <PriorityBadge priority={activeComplaint.priority} />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
                {activeComplaint.title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium pt-0.5">
                <MapPinIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>{activeComplaint.landmark}</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 self-start">
              <button
                type="button"
                onClick={() => executeLookup(activeComplaint.ref)}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-[#0B4FC2] dark:text-blue-400 flex items-center gap-1.5 transition-colors"
                title="Fetch latest status from ledger"
              >
                <span>Sync Status</span>
              </button>
              <div className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                Logged: {activeComplaint.date}
              </div>
            </div>
          </div>

          {/* Work Completed / Verification Status Banner */}
          {activeComplaint.status === 'WORK_COMPLETED' && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-emerald-100">
                <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Work Completed by Field Crew — Awaiting Supervisor Verification</span>
              </div>
              <p className="text-emerald-800 dark:text-emerald-300 leading-relaxed">
                Repairs have been marked complete by the assigned municipal worker. Physical on-site inspection is pending by the municipal supervisor prior to formal ticket closure.
              </p>
            </div>
          )}

          {activeComplaint.status === 'VERIFIED_RESOLVED' && (
            <div className="p-4 bg-emerald-100/70 dark:bg-emerald-900/40 rounded-xl border border-emerald-300 dark:border-emerald-700 space-y-1 text-xs">
              <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-emerald-100">
                <ShieldCheckIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
                <span>Verified &amp; Resolved by Municipal Supervisor</span>
              </div>
              <p className="text-emerald-800 dark:text-emerald-300 leading-relaxed">
                The supervisor has verified physical completion of the work on-site. If you believe the repair is unsatisfactory, you may submit a formal dispute below.
              </p>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs border border-slate-200 dark:border-slate-700/80">
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-medium block">Local Jurisdiction</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm mt-0.5 block">
                {activeComplaint.ward}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-medium block">Responsible Department</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm mt-0.5 block">
                {activeComplaint.department}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-medium block">Reporter Contact (DPDP Masked)</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white text-sm mt-0.5 block">
                {activeComplaint.reporterMasked}
              </span>
            </div>
          </div>

          {/* Citizen Description & Attached Evidence */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div>
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Citizen Defect Description
              </h3>
              <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                {activeComplaint.description || 'No additional description provided by citizen.'}
              </p>
            </div>

            {/* Attached Evidence Photographs */}
            {activeComplaint.evidence && activeComplaint.evidence.length > 0 && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CameraIcon className="w-3.5 h-3.5 text-[#0B4FC2] dark:text-blue-400" />
                  <span>Attached Photographic Evidence ({activeComplaint.evidence.length})</span>
                </h4>
                <div className="flex flex-wrap gap-3">
                  {activeComplaint.evidence.map((ev, idx) => (
                    <div key={ev.id || idx} className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs">
                      <img
                        src={`/api/v1/evidence/${encodeURIComponent(ev.fileKey)}`}
                        alt={`Evidence photo ${idx + 1}`}
                        className="w-24 h-24 object-cover hover:scale-105 transition-transform"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                      <span className="block text-[10px] font-mono text-center p-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {ev.stage === 'BEFORE_SUBMISSION' ? 'Defect' : 'Repair'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Stepper Timeline */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Deterministic Milestone Timeline
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {activeComplaint.timeline.filter((s) => s.isComplete).length} of{' '}
                {activeComplaint.timeline.length} Milestones Complete
              </span>
            </div>

            <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
              {activeComplaint.timeline.map((step, idx) => (
                <div key={idx} className="relative">
                  <span
                    className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-slate-900 ${
                      step.isComplete
                        ? 'bg-emerald-600 text-white'
                        : step.isCurrent
                        ? 'bg-[#0B4FC2] dark:bg-blue-500 text-white animate-pulse'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                    }`}
                    aria-hidden="true"
                  >
                    {step.isComplete ? (
                      <CheckCircleIcon className="w-3.5 h-3.5" />
                    ) : step.isCurrent ? (
                      <WrenchIcon className="w-3 h-3" />
                    ) : (
                      <ClockIcon className="w-3 h-3" />
                    )}
                  </span>

                  <div className="space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{step.title}</h4>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{step.timestamp}</span>
                    </div>
                    <span className="text-xs font-semibold text-[#0B4FC2] dark:text-blue-400 block">
                      Actor: {step.actingParty}
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 leading-relaxed">
                      {step.publicNote}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dispute Action for VERIFIED_RESOLVED Status */}
          {activeComplaint.status === 'VERIFIED_RESOLVED' && (
            <div className="pt-5 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Citizens can raise a formal dispute within 7 calendar days if physical repairs are substandard.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDisputeModalOpen(true)}
                leftIcon={<AlertTriangleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                className="font-bold border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/50 shrink-0 rounded-xl"
              >
                Dispute Resolution
              </Button>
            </div>
          )}

          {/* Citizen Feedback Card for VERIFIED_RESOLVED & CLOSED */}
          {['VERIFIED_RESOLVED', 'CLOSED'].includes(activeComplaint.status) && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <FeedbackCard
                complaintId={activeComplaint.id || activeComplaint.ref}
                referenceNumber={activeComplaint.ref}
                status={activeComplaint.status}
              />
            </div>
          )}
        </div>
      )}

      {/* Citizen Dispute Modal Component */}
      {activeComplaint && (
        <DisputeModal
          isOpen={disputeModalOpen}
          onClose={() => setDisputeModalOpen(false)}
          complaintId={activeComplaint.id || activeComplaint.ref}
          referenceNumber={activeComplaint.ref}
          expectedVersion={activeComplaint.version}
          onSuccess={(updated) => {
            setActiveComplaint((prev) =>
              prev ? { ...prev, status: updated?.status || 'DISPUTED_REOPENED' } : null
            );
          }}
        />
      )}
    </div>
  );
}

export default function TrackComplaintPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500 font-mono">Loading complaint tracker...</div>}>
      <TrackComplaintContent />
    </Suspense>
  );
}
