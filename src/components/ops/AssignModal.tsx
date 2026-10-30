'use client';

import React, { useState, useEffect, useId } from 'react';
import Link from 'next/link';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  WrenchIcon,
  ShieldCheckIcon,
  AlertTriangleIcon,
  ClockIcon,
  UserCheckIcon,
} from '@/components/ui/icons';

export interface EligibleWorker {
  id: string;
  fullName: string;
  phoneNumber?: string;
  staffCode?: string | null;
  designation?: string;
  skills?: string;
  matchingSkills?: string[];
  activeWorkload?: number;
  matchScore?: number;
  isSkillMatched?: boolean;
}

export interface WorkTypeInfo {
  id: string;
  label: string;
  departmentCode?: string;
  primarySkills?: string[];
  description?: string;
}

export interface AssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  complaintRef: string;
  workType?: WorkTypeInfo | null;
  eligibleWorkers: EligibleWorker[];
  otherWorkers?: EligibleWorker[];
  noQualifiedWorkersNotice?: string | null;
  onConfirmAssignment: (
    workerId: string,
    targetDeadline: string,
    workerNotes: string,
    overrideOptions?: { allowSkillOverride?: boolean; overrideReason?: string }
  ) => void;
  isLoading?: boolean;
}

export function AssignModal({
  isOpen,
  onClose,
  complaintRef,
  workType,
  eligibleWorkers,
  otherWorkers = [],
  noQualifiedWorkersNotice,
  onConfirmAssignment,
  isLoading = false,
}: AssignModalProps) {
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [targetDeadline, setTargetDeadline] = useState('');
  const [workerNotes, setWorkerNotes] = useState('');
  const [isOverrideEnabled, setIsOverrideEnabled] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const workerSelectId = useId();
  const deadlineInputId = useId();
  const notesTextareaId = useId();
  const overrideReasonId = useId();

  // Initialize defaults on modal open
  useEffect(() => {
    if (isOpen) {
      if (eligibleWorkers.length > 0) {
        setSelectedWorkerId((prev) =>
          eligibleWorkers.some((w) => w.id === prev) ? prev : eligibleWorkers[0].id
        );
        setIsOverrideEnabled(false);
      } else if (otherWorkers.length > 0) {
        setSelectedWorkerId('');
      } else {
        setSelectedWorkerId('');
      }

      // Default deadline to +48 hours from now
      const d = new Date();
      d.setHours(d.getHours() + 48);
      const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setTargetDeadline(isoLocal);
      setWorkerNotes('');
      setOverrideReason('');
      setValidationError(null);
    }
  }, [isOpen, eligibleWorkers, otherWorkers]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let targetId = selectedWorkerId;
    if (!targetId && !isOverrideEnabled && eligibleWorkers.length > 0) {
      targetId = eligibleWorkers[0].id;
    }

    if (!targetId) {
      setValidationError(
        eligibleWorkers.length === 0
          ? 'No qualified worker selected. Please qualify a worker or enable an authorized override.'
          : 'Please select an active field worker crew lead.'
      );
      return;
    }

    if (isOverrideEnabled) {
      if (!overrideReason || overrideReason.trim().length < 5) {
        setValidationError('An explanation (at least 5 characters) is mandatory when performing an authorized skill override.');
        return;
      }
    }

    if (!targetDeadline) {
      setValidationError('Target completion deadline is required.');
      return;
    }

    setValidationError(null);
    onConfirmAssignment(
      targetId,
      targetDeadline,
      workerNotes,
      isOverrideEnabled
        ? { allowSkillOverride: true, overrideReason: overrideReason.trim() }
        : undefined
    );
  };

  const selectedWorker = isOverrideEnabled
    ? otherWorkers.find((w) => w.id === selectedWorkerId) || eligibleWorkers.find((w) => w.id === selectedWorkerId)
    : eligibleWorkers.find((w) => w.id === selectedWorkerId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Smart Work-Type & Skill-Based Assignment"
      description={`Dispatches grievance ${complaintRef} to qualified field personnel.`}
      footer={
        <div className="flex gap-2 justify-end w-full">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            isLoading={isLoading}
            onClick={handleSubmit}
            disabled={eligibleWorkers.length === 0 && !isOverrideEnabled}
          >
            Confirm Assignment
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-800 dark:text-slate-200">
        {validationError && (
          <div
            role="alert"
            className="p-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-800 dark:text-rose-200 flex items-start gap-2"
          >
            <AlertTriangleIcon className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <span>{validationError}</span>
          </div>
        )}

        {/* 1. Identified Work-Type Banner */}
        {workType && (
          <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#0B4FC2] dark:text-blue-300">
                Primary Required Work Type
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#0B4FC2] dark:bg-blue-900 dark:text-blue-200">
                {workType.departmentCode || 'MUNICIPAL WORKS'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <WrenchIcon className="w-4 h-4 text-[#0B4FC2] dark:text-blue-400 shrink-0" />
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                {workType.label}
              </span>
            </div>
            {workType.primarySkills && workType.primarySkills.length > 0 && (
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Required Skills: </span>
                {workType.primarySkills.slice(0, 5).join(' • ')}
              </p>
            )}
          </div>
        )}

        {/* 2. Candidate Field Workers Selection */}
        <div>
          <label htmlFor={workerSelectId} className="block font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
            Field Maintenance Crew Lead / Qualified Personnel <span className="text-red-500">*</span>
          </label>

          {eligibleWorkers.length > 0 && !isOverrideEnabled ? (
            <div className="space-y-2.5">
              <select
                id={workerSelectId}
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0B4FC2]"
              >
                {eligibleWorkers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.fullName} ({w.staffCode ? `#${w.staffCode}` : 'Crew'}) — {w.designation || 'Specialist'} | Active: {w.activeWorkload ?? 0} tasks
                  </option>
                ))}
              </select>

              {/* Selected Worker Qualification Card */}
              {selectedWorker && (
                <div className="p-3 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <UserCheckIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      {selectedWorker.fullName}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {selectedWorker.staffCode ? `Staff #${selectedWorker.staffCode}` : 'Authorized'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-100 dark:border-slate-700/60">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Designation</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {selectedWorker.designation || 'Field Maintenance Crew'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Active Workload</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <ClockIcon className="w-3 h-3 text-slate-400" />
                        {selectedWorker.activeWorkload ?? 0} active work order(s)
                      </span>
                    </div>
                  </div>

                  {selectedWorker.matchingSkills && selectedWorker.matchingSkills.length > 0 && (
                    <div className="pt-1 text-[11px]">
                      <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 block">
                        Matching Work-Type Skills:
                      </span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {selectedWorker.matchingSkills.map((sk) => (
                          <span
                            key={sk}
                            className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                          >
                            ✓ {sk}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : !isOverrideEnabled ? (
            /* Explicit Empty Qualified State required by specification */
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl space-y-3 text-amber-900 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed font-semibold">
                  {noQualifiedWorkersNotice ||
                    'No active worker with the required skills is currently available. Add or qualify a worker, or review the complaint\'s work type.'}
                </p>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Link
                  href="/ops/crew"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0B4FC2] text-white hover:bg-blue-800 shadow-2xs transition-colors"
                >
                  <span>+ Manage Workers / Add Crew</span>
                </Link>
                {otherWorkers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOverrideEnabled(true);
                      if (otherWorkers.length > 0) setSelectedWorkerId(otherWorkers[0].id);
                    }}
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:underline"
                  >
                    Authorized Officer Override →
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {/* 3. Authorized Skill Override Section */}
          {isOverrideEnabled && (
            <div className="p-3.5 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                  <ShieldCheckIcon className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  Authorized Skill Override Mode
                </span>
                <button
                  type="button"
                  onClick={() => setIsOverrideEnabled(false)}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Cancel Override
                </button>
              </div>

              <p className="text-[11px] text-rose-800 dark:text-rose-300">
                You are assigning a worker without verified matching skills for this work type. An explicit justification will be permanently recorded in the complaint audit log.
              </p>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Available Corporation Staff:
                </label>
                <select
                  value={selectedWorkerId}
                  onChange={(e) => setSelectedWorkerId(e.target.value)}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs"
                >
                  {otherWorkers.concat(eligibleWorkers).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.fullName} ({w.staffCode ? `#${w.staffCode}` : 'Crew'}) — {w.designation || 'Staff'} (Active: {w.activeWorkload ?? 0})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor={overrideReasonId} className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Override Justification / Supervisory Reason <span className="text-red-500">*</span>
                </label>
                <input
                  id={overrideReasonId}
                  type="text"
                  required
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Qualified electrical lineman assisting road crew due to urgent monsoon hazard."
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* 4. Target Completion Deadline */}
        <div>
          <label htmlFor={deadlineInputId} className="block font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
            Target Completion Deadline <span className="text-red-500">*</span>
          </label>
          <input
            id={deadlineInputId}
            type="datetime-local"
            value={targetDeadline}
            onChange={(e) => setTargetDeadline(e.target.value)}
            className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0B4FC2]"
            required
          />
        </div>

        {/* 5. Internal Instructions / Notes */}
        <div>
          <label htmlFor={notesTextareaId} className="block font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
            Internal Instructions / Safety Remarks (Optional)
          </label>
          <textarea
            id={notesTextareaId}
            rows={2}
            value={workerNotes}
            onChange={(e) => setWorkerNotes(e.target.value)}
            placeholder="e.g. Ensure safety cones deployed; contact Municipal Engineer upon site arrival."
            className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0B4FC2]"
          />
        </div>
      </form>
    </Modal>
  );
}
