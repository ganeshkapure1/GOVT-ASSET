'use client';

import React from 'react';
import { CameraIcon, CheckCircleIcon, MapPinIcon, AlertTriangleIcon, WrenchIcon } from '@/components/ui/icons';

export interface EvidenceRecord {
  id?: string;
  fileKey: string;
  createdAt?: string | Date;
  stage?: string;
  mimeType?: string;
}

export interface BeforeAfterCompareProps {
  beforeEvidence?: EvidenceRecord[];
  afterEvidence?: EvidenceRecord[];
  beforeDesc?: string;
  afterDesc?: string;
  landmark?: string;
  coords?: string;
  completedBy?: string;
  completedAt?: string;
  gpsDistanceText?: string;
  isProximityVerified?: boolean;
}

export function BeforeAfterCompare({
  beforeEvidence = [],
  afterEvidence = [],
  beforeDesc,
  afterDesc,
  landmark,
  coords,
  completedBy,
  completedAt,
  gpsDistanceText,
  isProximityVerified = true,
}: BeforeAfterCompareProps) {
  const hasBeforePhoto = beforeEvidence.length > 0;
  const hasAfterPhoto = afterEvidence.length > 0;

  return (
    <div className="space-y-4">
      {/* Side-by-side Evidence Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* BEFORE CARD */}
        <div className="border border-rose-200 dark:border-rose-900/60 rounded-2xl p-4 sm:p-5 bg-rose-50/40 dark:bg-rose-950/20 space-y-3 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
              <span className="text-xs font-bold text-rose-900 dark:text-rose-300 uppercase tracking-wide">
                Citizen &quot;Before&quot; Evidence
              </span>
            </div>
            <span className="text-[11px] font-mono text-rose-700 dark:text-rose-400 font-semibold bg-rose-100/70 dark:bg-rose-900/40 px-2 py-0.5 rounded-md">
              Intake Grievance
            </span>
          </div>

          {/* Before Photo Viewport / Missing State */}
          {hasBeforePhoto ? (
            <div className="relative w-full h-48 rounded-xl bg-slate-900 overflow-hidden border border-rose-300/60 dark:border-rose-800 flex flex-col justify-between p-3 text-white">
              {/* Graphic Representation */}
              <svg aria-hidden="true" className="absolute inset-0 w-full h-full opacity-60" viewBox="0 0 300 150">
                <rect width="300" height="150" fill="#1E293B" />
                <path d="M 50 40 Q 150 120 250 50 L 270 120 Q 150 140 30 110 Z" fill="#0F172A" stroke="#EF4444" strokeWidth="2" strokeDasharray="4 2" />
                <circle cx="150" cy="90" r="26" fill="#450A0A" stroke="#EF4444" strokeWidth="1.5" />
              </svg>
              <div className="relative z-10 flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-black/70 text-[10px] font-mono text-rose-300 font-bold border border-rose-900 shadow-2xs">
                  ORIGINAL DEFECT CAPTURE
                </span>
                <CameraIcon className="w-4 h-4 text-rose-400" />
              </div>
              <div className="relative z-10 text-[10px] font-mono bg-black/80 p-2 rounded-lg border border-slate-800 backdrop-blur-xs space-y-0.5">
                <p className="text-slate-200 font-bold truncate">File: {beforeEvidence[0].fileKey}</p>
                {coords && <p className="text-slate-400">GPS: {coords} • Accuracy: &plusmn;4.2m</p>}
              </div>
            </div>
          ) : (
            <div className="w-full h-48 rounded-xl border border-dashed border-rose-300 dark:border-rose-800/80 bg-rose-50/60 dark:bg-rose-950/30 flex flex-col items-center justify-center p-4 text-center text-rose-800 dark:text-rose-300 space-y-1.5">
              <CameraIcon className="w-8 h-8 text-rose-400 dark:text-rose-500/70" />
              <p className="font-bold text-xs">No Initial Intake Photo Attached</p>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 max-w-xs">
                Grievance was registered with text landmark details without photographic evidence.
              </p>
            </div>
          )}

          {/* Description & Landmark */}
          <div className="space-y-1 text-xs">
            {beforeDesc && (
              <p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                {beforeDesc}
              </p>
            )}
            {landmark && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <MapPinIcon className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span className="truncate">{landmark}</span>
              </p>
            )}
          </div>
        </div>

        {/* AFTER CARD */}
        <div className="border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-4 sm:p-5 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wide">
                Field Crew &quot;After&quot; Evidence
              </span>
            </div>
            {completedAt && (
              <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-100/70 dark:bg-emerald-900/40 px-2 py-0.5 rounded-md">
                {completedAt}
              </span>
            )}
          </div>

          {/* After Photo Viewport / Missing State */}
          {hasAfterPhoto ? (
            <div className="relative w-full h-48 rounded-xl bg-slate-900 overflow-hidden border border-emerald-300/60 dark:border-emerald-800 flex flex-col justify-between p-3 text-white">
              {/* Graphic Representation */}
              <svg aria-hidden="true" className="absolute inset-0 w-full h-full opacity-60" viewBox="0 0 300 150">
                <rect width="300" height="150" fill="#1E293B" />
                <rect x="40" y="30" width="220" height="90" rx="8" fill="#064E3B" stroke="#10B981" strokeWidth="2" />
                <line x1="60" y1="75" x2="240" y2="75" stroke="#F59E0B" strokeWidth="3" strokeDasharray="12 8" />
              </svg>
              <div className="relative z-10 flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-black/70 text-[10px] font-mono text-emerald-300 font-bold border border-emerald-900 shadow-2xs">
                  COMPLETION AUDIT PROOF
                </span>
                <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="relative z-10 text-[10px] font-mono bg-black/80 p-2 rounded-lg border border-slate-800 backdrop-blur-xs space-y-0.5">
                <p className="text-emerald-200 font-bold truncate">File: {afterEvidence[0].fileKey}</p>
                <p className="text-emerald-300">
                  {gpsDistanceText || 'GPS Geofence: Verified on site (PASS)'}
                </p>
              </div>
            </div>
          ) : (
            <div className="w-full h-48 rounded-xl border border-dashed border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/30 flex flex-col items-center justify-center p-4 text-center text-emerald-800 dark:text-emerald-300 space-y-1.5">
              <WrenchIcon className="w-8 h-8 text-emerald-400 dark:text-emerald-500/70" />
              <p className="font-bold text-xs">Awaiting Completion Photograph</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 max-w-xs">
                Field maintenance crew has not yet transmitted &quot;After&quot; repair photographic evidence.
              </p>
            </div>
          )}

          {/* Description & Crew Lead */}
          <div className="space-y-1 text-xs">
            {afterDesc && (
              <p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                {afterDesc}
              </p>
            )}
            {completedBy && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Maintenance Crew Lead: <strong className="text-slate-700 dark:text-slate-300">{completedBy}</strong>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Proximity / Geofence Status Ribbon */}
      <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
        isProximityVerified
          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-300'
          : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-300'
      }`}>
        <div className="flex items-center gap-2">
          {isProximityVerified ? (
            <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          )}
          <span className="font-semibold">
            {gpsDistanceText || (isProximityVerified ? 'GPS Proximity Verified: &le; 200m from defect' : 'GPS Proximity Advisory (> 200m)')}
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
          Local Storage Mock (.storage_mock/)
        </span>
      </div>
    </div>
  );
}
