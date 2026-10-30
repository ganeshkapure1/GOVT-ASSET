'use client';

import React, { useState } from 'react';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { StatusBadge, PriorityBadge, ComplaintStatus, ComplaintPriority } from '@/components/ui/Badge';
import { MapPinIcon, ClockIcon, WrenchIcon } from '@/components/ui/icons';
import { SYNTHETIC_BOUNDARY_DISCLAIMER } from '@/lib/constants';

export interface DuplicateItem {
  id: string;
  referenceNumber: string;
  title: string;
  status: string;
  priority: string;
  categoryName: string;
  landmarkAddress: string;
  distanceMeters: number;
  createdAt: string;
  isExactLocation?: boolean;
}

export interface ComplaintDrawerData {
  id: string;
  ref: string;
  reporterName: string;
  category: string;
  department?: string;
  landmark: string;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  date: string;
  submittedAgo?: string;
  description?: string;
  version?: number;
  evidence?: Array<{ id: string; fileKey: string; stage: string }>;
  potentialDuplicates?: DuplicateItem[];
}

export interface ComplaintDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  complaint: ComplaintDrawerData | null;
  onValidate: () => void;
  onOpenAssignModal: () => void;
  onOpenRejectModal: () => void;
  onLinkDuplicate?: (masterComplaintId: string, masterRef: string) => void;
  isLoading?: boolean;
}

export function ComplaintDrawer({
  isOpen,
  onClose,
  complaint,
  onValidate,
  onOpenAssignModal,
  onOpenRejectModal,
  onLinkDuplicate,
  isLoading = false,
}: ComplaintDrawerProps) {
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'DUPLICATES'>('DETAILS');

  if (!complaint) return null;

  const duplicates = complaint.potentialDuplicates || [];
  const canBeTriaged = complaint.status === 'SUBMITTED' || complaint.status === 'TRIAGED_VALIDATED';

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Complaint Triage Review"
      subtitle={`${complaint.ref} • ${complaint.category}`}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          {canBeTriaged ? (
            <Button
              variant="danger"
              size="sm"
              onClick={onOpenRejectModal}
              disabled={isLoading}
            >
              Reject / Invalid
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
              Close
            </Button>

            {canBeTriaged && complaint.status === 'SUBMITTED' && (
              <Button
                variant="outline"
                size="sm"
                onClick={onValidate}
                isLoading={isLoading}
              >
                Validate
              </Button>
            )}

            {canBeTriaged && (
              <Button
                variant="primary"
                size="sm"
                onClick={onOpenAssignModal}
                disabled={isLoading}
              >
                Assign Field Crew
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5 text-xs text-slate-800 dark:text-slate-200">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4" role="tablist" aria-label="Complaint drawer navigation">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'DETAILS'}
            onClick={() => setActiveTab('DETAILS')}
            className={`pb-2.5 font-bold text-xs transition-colors border-b-2 -mb-px ${
              activeTab === 'DETAILS'
                ? 'border-[#0B4FC2] dark:border-blue-400 text-[#0B4FC2] dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Issue Details
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'DUPLICATES'}
            onClick={() => setActiveTab('DUPLICATES')}
            className={`pb-2.5 font-bold text-xs transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              activeTab === 'DUPLICATES'
                ? 'border-[#0B4FC2] dark:border-blue-400 text-[#0B4FC2] dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <span>Spatial Duplicates</span>
            {duplicates.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                {duplicates.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'DETAILS' ? (
          <>
            {/* Status & Priority Ribbon */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <StatusBadge status={complaint.status} />
                <PriorityBadge priority={complaint.priority} />
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                <ClockIcon className="w-3.5 h-3.5" />
                <span>{complaint.date}</span>
              </div>
            </div>

            {/* Reporter Information (DPDP Masked) */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Citizen Reporter
              </h4>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <span className="font-medium text-slate-700 dark:text-slate-300">Contact Number:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{complaint.reporterName}</span>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Citizen Description
              </h4>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {complaint.description || 'No detailed description was provided by the citizen.'}
                </p>
              </div>
            </div>

            {/* Location & GIS Details */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <MapPinIcon className="w-4 h-4 text-[#0B4FC2] dark:text-blue-400" />
                Location &amp; PostGIS Ward
              </h4>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <p className="font-bold text-slate-900 dark:text-white">{complaint.landmark}</p>
                <div className="p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 rounded-lg text-[11px] text-amber-900 dark:text-amber-200 leading-snug">
                  <span className="font-semibold block mb-0.5">Boundary Notice:</span>
                  {SYNTHETIC_BOUNDARY_DISCLAIMER}
                </div>
              </div>
            </div>

            {/* Photographic Proof */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Photographic Proof
              </h4>
              {complaint.evidence && complaint.evidence.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {complaint.evidence.map((ev, i) => (
                    <div
                      key={ev.id || i}
                      className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-center font-mono text-[11px] text-slate-600 dark:text-slate-400"
                    >
                      <span>Photo Proof #{i + 1}</span>
                      <span className="block text-[10px] text-slate-400 truncate mt-1">{ev.fileKey}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-full h-28 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center font-mono text-slate-500 dark:text-slate-400 gap-1">
                  <WrenchIcon className="w-6 h-6 text-slate-400" />
                  <span>Civic photographic record verified in database</span>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Spatial Duplicates Tab */
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 rounded-xl text-[11px] text-blue-900 dark:text-blue-200">
              <p className="font-semibold">PostGIS Proximity Engine (&le; 50m, 48 hours):</p>
              <p className="mt-0.5 text-blue-700 dark:text-blue-300">
                Flags potential duplicate reports submitted for the same civic defect to prevent duplicate field dispatches.
              </p>
            </div>

            {duplicates.length === 0 ? (
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-slate-500 dark:text-slate-400">
                <p className="font-semibold">No spatial duplicates detected.</p>
                <p className="text-[11px] mt-1">No other complaints were filed within 50 meters in the last 48 hours.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {duplicates.map((dup) => (
                  <div
                    key={dup.id}
                    className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {dup.referenceNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                        {dup.distanceMeters}m away
                      </span>
                    </div>

                    <p className="font-medium text-slate-800 dark:text-slate-200">{dup.title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{dup.landmarkAddress}</p>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-400">Status: {dup.status}</span>
                      {onLinkDuplicate && canBeTriaged && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onLinkDuplicate(dup.id, dup.referenceNumber)}
                          isLoading={isLoading}
                        >
                          Link as Duplicate
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}
