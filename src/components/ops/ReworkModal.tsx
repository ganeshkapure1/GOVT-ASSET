'use client';

import React, { useState, useEffect, useId } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface ReworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  complaintRef: string;
  onConfirmRework: (reworkInstructions: string) => void;
  isLoading?: boolean;
}

const REWORK_PRESETS = [
  'Bitumen compaction along outer seam is uneven. Re-roll with vibratory roller.',
  'Repair surface is below existing road grade. Add additional cold bituminous mix and compact flush.',
  'Debris and excess loose aggregate left on site. Clear road corridor and seal joints.',
];

export function ReworkModal({
  isOpen,
  onClose,
  complaintRef,
  onConfirmRework,
  isLoading = false,
}: ReworkModalProps) {
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState<string | null>(null);
  const instructionsId = useId();

  useEffect(() => {
    if (isOpen) {
      setInstructions('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!instructions || instructions.trim().length < 20) {
      setError('Detailed corrective instructions of at least 20 characters are required.');
      return;
    }
    setError(null);
    onConfirmRework(instructions.trim());
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Return Work Order ${complaintRef} for Rework`}
      description="Provide mandatory technical rectification instructions. The work order will revert to IN_PROGRESS and alert the assigned field worker."
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
            Dispatch Rework Order
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
          <div className="flex justify-between items-center mb-1.5">
            <label htmlFor={instructionsId} className="font-bold text-slate-800 dark:text-slate-200">
              Corrective Instructions (Field Crew Action Plan) <span className="text-red-500">*</span>
            </label>
            <span
              className={`text-[11px] font-mono ${
                instructions.trim().length >= 20
                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'text-slate-400'
              }`}
            >
              {instructions.trim().length} / 20 min chars
            </span>
          </div>

          <textarea
            id={instructionsId}
            rows={4}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Specify technical defects observed and exact rectification steps..."
            className="w-full p-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
            required
          />
        </div>

        {/* Quick Technical Presets */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
            Common Supervisory Directives (Click to apply):
          </span>
          <div className="space-y-1.5">
            {REWORK_PRESETS.map((preset, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setInstructions(preset)}
                className="w-full text-left p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-300 transition-colors"
              >
                &bull; {preset}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
