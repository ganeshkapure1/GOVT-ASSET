'use client';

import React, { useState, useEffect, useId } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface RejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  complaintRef: string;
  onConfirmRejection: (reasonCode: string, explanation: string) => void;
  isLoading?: boolean;
}

export function RejectModal({
  isOpen,
  onClose,
  complaintRef,
  onConfirmRejection,
  isLoading = false,
}: RejectModalProps) {
  const [reasonCode, setReasonCode] = useState('OUT_OF_JURISDICTION');
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const reasonCodeId = useId();
  const explanationId = useId();

  useEffect(() => {
    if (isOpen) {
      setReasonCode('OUT_OF_JURISDICTION');
      setExplanation('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!explanation || explanation.trim().length < 20) {
      setError('A detailed explanation of at least 20 characters is mandatory when rejecting a civic complaint.');
      return;
    }

    setError(null);
    onConfirmRejection(reasonCode, explanation.trim());
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reject Civic Complaint"
      description={`Mandatory civic audit record required for ${complaintRef}. Explanation will be sent to the citizen.`}
      footer={
        <div className="flex gap-2 justify-end w-full">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            isLoading={isLoading}
            onClick={handleSubmit}
          >
            Confirm Rejection
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-800 dark:text-slate-200">
        {error && (
          <div className="p-2.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div>
          <label htmlFor={reasonCodeId} className="block font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
            Standardized Reason Code <span className="text-red-500">*</span>
          </label>
          <select
            id={reasonCodeId}
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="OUT_OF_JURISDICTION">OUT_OF_JURISDICTION (National Highway / Private Colony)</option>
            <option value="DUPLICATE_REPORT">DUPLICATE_REPORT (Previously logged & active work order exists)</option>
            <option value="INSUFFICIENT_DETAILS">INSUFFICIENT_DETAILS (Unlocatable / vague landmark description)</option>
            <option value="CIVIC_POLICY_EXCLUDED">CIVIC_POLICY_EXCLUDED (Private internal asset / dispute)</option>
          </select>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label htmlFor={explanationId} className="font-semibold text-slate-800 dark:text-slate-200">
              Detailed Justification (Communicated to Citizen) <span className="text-red-500">*</span>
            </label>
            <span className={`text-[11px] font-mono ${explanation.trim().length >= 20 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
              {explanation.trim().length} / 20 min chars
            </span>
          </div>
          <textarea
            id={explanationId}
            rows={4}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Please specify why this petition cannot be serviced by the municipal corporation..."
            className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            required
          />
        </div>
      </form>
    </Modal>
  );
}
