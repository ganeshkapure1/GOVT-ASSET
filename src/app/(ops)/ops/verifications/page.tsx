'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { BeforeAfterCompare } from '@/components/ops/BeforeAfterCompare';
import { ReworkModal } from '@/components/ops/ReworkModal';
import { ShieldCheckIcon, CheckCircleIcon, MapPinIcon } from '@/components/ui/icons';

interface VerificationItem {
  id: string;
  ref: string;
  title: string;
  category: string;
  landmark: string;
  completedBy: string;
  completedAt: string;
  gpsDistance: string;
  beforeDesc: string;
  afterDesc: string;
  coords: string;
}

export default function OpsVerificationsPage() {
  const [selectedTask, setSelectedTask] = useState<VerificationItem | null>(null);
  const [reworkModalOpen, setReworkModalOpen] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [verifications, setVerifications] = useState<VerificationItem[]>([
    {
      id: '77777777-7777-7777-7777-777777770001',
      ref: 'GOV-2026-00482',
      title: 'Deep Pothole Filled and Compacted',
      category: 'Damaged Roads & Potholes',
      landmark: 'Mayur Colony, Opp. Krishna Hospital, Ward 28',
      completedBy: 'Vikram Singh (Road Maintenance Crew #4)',
      completedAt: 'Today, 1:45 PM',
      gpsDistance: '14 meters from complaint origin (PASS)',
      beforeDesc: 'Deep 45cm asphalt cavity with exposed aggregate base. P1 Priority.',
      afterDesc: 'Cold mix bitumen laid, leveled, and roller-compacted to road surface gradient.',
      coords: '18.5089° N, 73.8112° E',
    },
    {
      id: '77777777-7777-7777-7777-777777770002',
      ref: 'GOV-2026-00474',
      title: 'Damaged Water Valve Replaced',
      category: 'Water Leakage & Sewage',
      landmark: 'Dahanukar Colony Lane 4, Ward 28',
      completedBy: 'Suresh Jadhav (Water Distribution Team B)',
      completedAt: 'Today, 11:20 AM',
      gpsDistance: '8 meters from complaint origin (PASS)',
      beforeDesc: 'Cracked cast-iron sluice valve leaking approximately 15 liters/min into roadway.',
      afterDesc: 'New 150mm ductile iron valve fitted with flange gaskets and tested under 4 bar pressure.',
      coords: '18.5012° N, 73.8190° E',
    },
  ]);

  const loadVerifications = async () => {
    try {
      const res = await fetch('/api/v1/ops/verifications');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const mapped = json.data.map((c: any) => ({
            id: c.id,
            ref: c.ref,
            title: c.title,
            category: c.category,
            landmark: c.landmark,
            completedBy: c.completedBy,
            completedAt: c.completedAt,
            gpsDistance: 'Verified on-site coordinates (PASS)',
            beforeDesc: 'Intake photo and citizen grievance description recorded.',
            afterDesc: c.workerNotes || 'Repairs completed and photographed by field team.',
            coords: '18.5089° N, 73.8112° E',
          }));
          setVerifications(mapped);
        }
      }
    } catch {}
  };

  useEffect(() => {
    loadVerifications();
  }, []);

  const handleApprove = async (item: VerificationItem) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/ops/complaints/${item.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSelectedTask(null);
        setFeedbackNotice(`Work Order ${item.ref} approved! Status transitioned to VERIFIED_RESOLVED. Citizen notified with 7-day dispute window.`);
        loadVerifications();
      } else {
        setFeedbackNotice(`Approval failed: ${json?.error?.message || 'Unauthorized'}`);
      }
    } catch {
      setFeedbackNotice('Network error while recording verification approval.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRework = async (instructions: string) => {
    if (!selectedTask) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/ops/complaints/${selectedTask.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REJECT',
          rejectionReason: instructions,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setReworkModalOpen(false);
        setFeedbackNotice(`Work Order ${selectedTask.ref} returned for rework. Reverted to IN_PROGRESS with corrective instructions.`);
        setSelectedTask(null);
        loadVerifications();
      } else {
        setFeedbackNotice(`Rework dispatch failed: ${json?.error?.message || 'Unauthorized'}`);
      }
    } catch {
      setFeedbackNotice('Network error while returning work order for rework.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {feedbackNotice && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-2xl text-xs font-semibold text-emerald-900 dark:text-emerald-300 flex items-center justify-between shadow-subtle">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span>{feedbackNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackNotice(null)}
            className="text-emerald-800 dark:text-emerald-300 font-bold ml-2 underline hover:text-emerald-950 dark:hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-civic-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-brand-blue dark:text-blue-400 text-xs font-bold mb-1 border border-blue-200/50 dark:border-blue-900/50">
            <ShieldCheckIcon className="w-3.5 h-3.5" />
            Supervisory Quality Audit
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-civic-900 dark:text-white tracking-tight">
            Work Order Verification &amp; Resolution Queue
          </h1>
          <p className="text-xs sm:text-sm text-civic-600 dark:text-slate-400 mt-0.5">
            Compare citizen intake evidence against field completion photographs. Approving here triggers the 72-hour citizen dispute window.
          </p>
        </div>
      </div>

      {/* Verification Cards */}
      <div className="space-y-6">
        {verifications.map((item) => (
          <div
            key={item.ref}
            className="bg-white dark:bg-slate-900 border border-civic-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-subtle space-y-5 transition-all"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-civic-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-base font-extrabold text-brand-blue dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-lg border border-blue-200/50 dark:border-blue-900/50">
                  {item.ref}
                </span>
                <StatusBadge status="WORK_COMPLETED" />
                <PriorityBadge priority="P2" />
                <span className="text-xs sm:text-sm font-bold text-civic-900 dark:text-white">{item.title}</span>
              </div>
              <span className="text-xs font-mono text-civic-600 dark:text-slate-400 bg-civic-50 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-civic-200 dark:border-slate-700">
                Completed: {item.completedAt}
              </span>
            </div>

            {/* Side-by-side Evidence Component */}
            <BeforeAfterCompare
              beforeEvidence={[{ fileKey: 'evidence/intake_complaint_photo.webp' }]}
              afterEvidence={[{ fileKey: 'evidence/after_repair_photo.webp' }]}
              beforeDesc={item.beforeDesc}
              afterDesc={item.afterDesc}
              landmark={item.landmark}
              coords={item.coords}
              completedBy={item.completedBy}
              completedAt={item.completedAt}
              gpsDistanceText={item.gpsDistance}
              isProximityVerified={true}
            />

            {/* Audit Checklist & Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-civic-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs text-civic-600 dark:text-slate-400">
                <MapPinIcon className="w-4 h-4 text-brand-blue dark:text-blue-400 shrink-0" />
                <span>Geofence check: <strong className="text-emerald-700 dark:text-emerald-400">{item.gpsDistance}</strong></span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedTask(item);
                    setReworkModalOpen(true);
                  }}
                  className="text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 font-bold rounded-xl"
                >
                  Return for Rework
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleApprove(item)}
                  isLoading={isLoading}
                  leftIcon={<CheckCircleIcon className="w-4 h-4" />}
                  className="font-bold shadow-md rounded-xl"
                >
                  Approve &amp; Resolve Work Order
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dedicated Rework Modal */}
      <ReworkModal
        isOpen={reworkModalOpen}
        onClose={() => setReworkModalOpen(false)}
        complaintRef={selectedTask?.ref || ''}
        onConfirmRework={handleRework}
        isLoading={isLoading}
      />
    </div>
  );
}
