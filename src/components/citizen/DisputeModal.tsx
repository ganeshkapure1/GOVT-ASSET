'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AlertTriangleIcon, CheckCircleIcon } from '@/components/ui/icons';

export interface DisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  complaintId: string;
  referenceNumber: string;
  expectedVersion?: number;
  onSuccess?: (updatedComplaint: any) => void;
}

const MIN_DISPUTE_REASON_CHARS = 15;

export function DisputeModal({
  isOpen,
  onClose,
  complaintId,
  referenceNumber,
  expectedVersion,
  onSuccess,
}: DisputeModalProps) {
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const trimmedReason = reason.trim();
  const isValidLength = trimmedReason.length >= MIN_DISPUTE_REASON_CHARS;

  const handleClose = () => {
    if (!isLoading) {
      setReason('');
      setErrorMessage(null);
      setIsSuccess(false);
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidLength) {
      setErrorMessage(`Please provide at least ${MIN_DISPUTE_REASON_CHARS} characters explaining why the resolution is unsatisfactory.`);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/v1/complaints/${complaintId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputeReason: trimmedReason,
          expectedVersion,
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setIsSuccess(true);
        if (onSuccess) {
          onSuccess(json.data);
        }
      } else {
        setErrorMessage(json?.error?.message || 'Failed to submit dispute. Please check that your dispute window has not expired.');
      }
    } catch {
      setErrorMessage('Network error while submitting dispute. Please retry.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Dispute Resolution for ${referenceNumber}`}
      description="Submit a formal objection if the physical maintenance work conducted is substandard or incomplete."
    >
      {isSuccess ? (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 rounded-2xl text-sm space-y-3 border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
            <CheckCircleIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Dispute Successfully Registered</span>
          </div>
          <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
            Your grievance has been transitioned to <strong className="font-mono">DISPUTED_REOPENED</strong>.
            The case has been escalated directly to the responsible Department Administrator for review and re-inspection.
          </p>
          <div className="flex justify-end pt-1">
            <Button variant="primary" size="sm" onClick={handleClose} className="font-bold">
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dispute Policy Ribbon */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <AlertTriangleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">7-Calendar-Day Verification Window</span>
              <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                Disputes must be lodged within 7 days of verified completion. Submitting will flag this ticket for administrative audit.
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-200 text-xs font-semibold">
              {errorMessage}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="dispute-reason" className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Detailed Dispute Explanation <span className="text-rose-600">*</span>
              </label>
              <span className={`text-[11px] font-mono font-medium ${isValidLength ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                {trimmedReason.length}/{MIN_DISPUTE_REASON_CHARS} chars min
              </span>
            </div>
            <textarea
              id="dispute-reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. The pothole was filled with loose gravel rather than bituminous asphalt, and washed away after the first rain. Cavity depth is still hazardous..."
              className="w-full text-xs p-3.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#0B4FC2] focus:outline-none transition-all placeholder:text-slate-400"
              disabled={isLoading}
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              disabled={!isValidLength || isLoading}
              className="font-bold"
            >
              {isLoading ? 'Submitting...' : 'Submit Formal Dispute'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
