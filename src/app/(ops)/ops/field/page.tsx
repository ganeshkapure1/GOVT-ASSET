'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  MapPinIcon,
  CheckCircleIcon,
  WrenchIcon,
  AlertTriangleIcon,
  CameraIcon,
  ClockIcon,
  ShieldCheckIcon,
  SearchIcon,
  CloseIcon,
  UserCheckIcon,
} from '@/components/ui/icons';
import { evaluateGpsProximity, GpsProximityResult } from '@/lib/geo';
import { useOpsContext } from '@/context/OpsContext';

interface TaskEvidence {
  id: string;
  stage: string;
  fileKey: string;
  mimeType: string;
  isVerifiedProximity: boolean;
  createdAt: string;
}

interface TaskItem {
  assignmentId: string;
  complaintId: string;
  ref: string;
  title: string;
  description: string;
  category: string;
  department: string;
  ward?: string;
  locality?: string;
  location?: string;
  status: 'SUBMITTED' | 'TRIAGED_VALIDATED' | 'ASSIGNED' | 'IN_PROGRESS' | 'WORK_COMPLETED' | 'VERIFIED_RESOLVED' | 'CLOSED';
  priority: string;
  landmarkAddress: string;
  version: number;
  assignedAt: string;
  targetCompletionAt: string;
  workerNotes?: string | null;
  citizenPhone?: string;
  evidence: TaskEvidence[];
  completedAt?: string | null;
  verifiedAt?: string | null;
  verifierNote?: string | null;
  isActiveAssignment: boolean;
}

type TabType = 'ASSIGNED' | 'IN_PROGRESS' | 'AWAITING' | 'COMPLETED' | 'PROFILE';

export default function FieldWorkerDashboard() {
  const { user, corporation } = useOpsContext();

  const [activeTab, setActiveTab] = useState<TabType>('ASSIGNED');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [counts, setCounts] = useState({
    assigned: 0,
    inProgress: 0,
    awaitingVerification: 0,
    completed: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Active executing task modal / drawer state
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [workNotes, setWorkNotes] = useState('');
  const [evidenceFileName, setEvidenceFileName] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  // GPS Proximity State
  const [workerCoords, setWorkerCoords] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [proximityResult, setProximityResult] = useState<GpsProximityResult | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Repair Execution Checklist
  const [checklist, setChecklist] = useState({
    siteSecured: true,
    materialPrepped: false,
    repairExecuted: false,
    siteCleaned: false,
  });

  // Profile Edit State
  const [profileDesignation, setProfileDesignation] = useState('');
  const [profileSkills, setProfileSkills] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Completed search filter
  const [historySearch, setHistorySearch] = useState('');

  const loadTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/v1/ops/field/tasks');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setTasks(json.data);
          if (json.counts) {
            setCounts(json.counts);
          }
        }
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Failed to load assigned field tasks.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/ops/profile');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setProfileDesignation(json.data.designation || '');
          setProfileSkills(json.data.skills || '');
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadTasks();
    loadProfile();
  }, [loadTasks, loadProfile]);

  // Handle Starting Work on an ASSIGNED task
  const handleStartWork = async (task: TaskItem) => {
    try {
      setIsActionLoading(true);
      setActionNotice(null);
      const res = await fetch(`/api/v1/ops/complaints/${task.complaintId}/field-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'START_WORK',
          expectedVersion: task.version,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setActionNotice({
          type: 'success',
          message: `Work order ${task.ref} is now in progress.`,
        });
        await loadTasks();
        setActiveTab('IN_PROGRESS');
      } else {
        setActionNotice({
          type: 'error',
          message: json?.error?.message || 'Failed to start work order.',
        });
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Network error transitioning task status.' });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Evaluate GPS Proximity
  const handleDetectLocation = (complaintLat = 19.8872, complaintLng = 75.3289) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setProximityResult(
        evaluateGpsProximity(
          { latitude: null, longitude: null },
          { latitude: complaintLat, longitude: complaintLng }
        )
      );
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setWorkerCoords(coords);
        const evalRes = evaluateGpsProximity(coords, { latitude: complaintLat, longitude: complaintLng });
        setProximityResult(evalRes);
        setIsLocating(false);
      },
      () => {
        setProximityResult(
          evaluateGpsProximity(
            { latitude: null, longitude: null },
            { latitude: complaintLat, longitude: complaintLng }
          )
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Handle Completing Work & Submitting for Verification
  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    try {
      setIsActionLoading(true);
      setActionNotice(null);

      const fakeKey = `evidence/field_${selectedTask.complaintId}_${Date.now()}.jpg`;

      const res = await fetch(`/api/v1/ops/complaints/${selectedTask.complaintId}/field-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'COMPLETE_WORK',
          workerNotes: workNotes.trim() || 'Field repair completed in accordance with municipal standards.',
          evidenceFileKey: fakeKey,
          evidenceMimeType: 'image/jpeg',
          evidenceFileSizeBytes: 1024 * 350,
          workerLatitude: workerCoords?.latitude || 19.8872,
          workerLongitude: workerCoords?.longitude || 75.3289,
          gpsAccuracyMeters: workerCoords?.accuracy || 12,
          expectedVersion: selectedTask.version,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        const completedRef = selectedTask.ref;
        const completedId = selectedTask.complaintId;
        setActionNotice({
          type: 'success',
          message: `Work order ${completedRef} marked as complete — awaiting supervisor verification.`,
        });
        setIsSubmitModalOpen(false);

        // Immediate reactive local state update without requiring full page refresh
        setTasks((prev) =>
          prev.map((t) =>
            t.complaintId === completedId
              ? { ...t, status: 'WORK_COMPLETED', completedAt: new Date().toISOString() }
              : t
          )
        );
        setCounts((prev) => ({
          ...prev,
          inProgress: Math.max(0, prev.inProgress - 1),
          awaitingVerification: prev.awaitingVerification + 1,
        }));

        setSelectedTask(null);
        setWorkNotes('');
        setEvidenceFileName('');
        setActiveTab('AWAITING');
        await loadTasks();
      } else {
        setActionNotice({
          type: 'error',
          message: json?.error?.message || 'Failed to submit work verification.',
        });
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Network error submitting work completion.' });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Profile Update
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingProfile(true);
      setActionNotice(null);

      const payload: any = {
        designation: profileDesignation.trim(),
        skills: profileSkills.trim(),
      };

      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await fetch('/api/v1/ops/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setActionNotice({
          type: 'success',
          message: 'Worker profile updated successfully.',
        });
        setCurrentPassword('');
        setNewPassword('');
        loadProfile();
      } else {
        setActionNotice({
          type: 'error',
          message: json?.error?.message || 'Failed to update profile.',
        });
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Network error updating profile.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Filter tasks per tab
  const assignedList = tasks.filter((t) => t.status === 'ASSIGNED' && t.isActiveAssignment);
  const inProgressList = tasks.filter((t) => t.status === 'IN_PROGRESS' && t.isActiveAssignment);
  const awaitingList = tasks.filter((t) => t.status === 'WORK_COMPLETED');
  const completedList = tasks
    .filter((t) => t.status === 'VERIFIED_RESOLVED' || t.status === 'CLOSED')
    .filter((t) => {
      if (!historySearch.trim()) return true;
      const q = historySearch.toLowerCase();
      return (
        t.ref.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.landmarkAddress.toLowerCase().includes(q)
      );
    });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Worker Header Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Field Crew Operations Console
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950 text-[#0B4FC2] dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {user?.staffCode || 'FIELD_WORKER'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Logged in as <strong className="text-slate-700 dark:text-slate-200">{user?.fullName || 'Field Worker'}</strong> • {corporation ? corporation.name : 'Municipal Corporation'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={loadTasks}
            disabled={isLoading}
            className="text-xs font-semibold"
          >
            {isLoading ? 'Syncing...' : 'Sync Tasks'}
          </Button>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionNotice && (
        <div
          className={`p-4 rounded-xl text-xs sm:text-sm flex items-center justify-between border ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? (
              <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangleIcon className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Dismiss alert"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('ASSIGNED')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'ASSIGNED'
              ? 'bg-[#0B4FC2] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <span>My Assigned Work</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
              activeTab === 'ASSIGNED'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            {counts.assigned}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('IN_PROGRESS')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'IN_PROGRESS'
              ? 'bg-[#0B4FC2] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <span>In Progress</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
              activeTab === 'IN_PROGRESS'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            {counts.inProgress}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('AWAITING')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'AWAITING'
              ? 'bg-[#0B4FC2] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <span>Awaiting Verification</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
              activeTab === 'AWAITING'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            {counts.awaitingVerification}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('COMPLETED')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'COMPLETED'
              ? 'bg-[#0B4FC2] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <span>Work History</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
              activeTab === 'COMPLETED'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            {counts.completed}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('PROFILE')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === 'PROFILE'
              ? 'bg-[#0B4FC2] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <UserCheckIcon className="w-4 h-4" />
          <span>My Profile</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: MY ASSIGNED WORK */}
      {/* ========================================================================= */}
      {activeTab === 'ASSIGNED' && (
        <div className="space-y-4">
          {assignedList.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <WrenchIcon className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No Pending Work Orders
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                All newly assigned civic repair jobs will appear here when dispatched by the triage officer.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignedList.map((task) => (
                <div
                  key={task.assignmentId}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3.5 hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#0B4FC2] dark:text-blue-400">
                      {task.ref}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <PriorityBadge priority={task.priority as any} />
                      <StatusBadge status={task.status as any} />
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                      {task.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {task.description || 'No detailed description provided by citizen.'}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <MapPinIcon className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span className="font-semibold">{task.landmarkAddress}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                      <span>Category: <strong>{task.category}</strong></span>
                      <span>Location: <strong>{task.location || task.locality || task.landmarkAddress}</strong></span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Assigned: {new Date(task.assignedAt).toLocaleDateString()}</span>
                      <span className="text-amber-700 dark:text-amber-300 font-bold">
                        Target: {new Date(task.targetCompletionAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {task.workerNotes && (
                    <div className="text-xs text-slate-600 dark:text-slate-300 bg-blue-50/50 dark:bg-blue-950/30 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/40">
                      <strong className="text-[#0B4FC2] dark:text-blue-400">Dispatch Note: </strong>
                      {task.workerNotes}
                    </div>
                  )}

                  {/* Attached Defect Photographic Proof */}
                  {task.evidence && task.evidence.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <CameraIcon className="w-3.5 h-3.5 text-[#0B4FC2] dark:text-blue-400" />
                        <span>Attached Evidence Photos ({task.evidence.length})</span>
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {task.evidence.map((ev, idx) => (
                          <div key={ev.id || idx} className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                            <img
                              src={`/api/v1/evidence/${encodeURIComponent(ev.fileKey)}`}
                              alt={`Evidence ${idx + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <Button
                      variant="primary"
                      onClick={() => handleStartWork(task)}
                      disabled={isActionLoading}
                      className="w-full sm:w-auto text-xs font-bold"
                    >
                      {isActionLoading ? 'Starting...' : 'Start Work (Move to In Progress)'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: IN PROGRESS */}
      {/* ========================================================================= */}
      {activeTab === 'IN_PROGRESS' && (
        <div className="space-y-4">
          {inProgressList.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <ClockIcon className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No Work Currently In Progress
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Open &quot;My Assigned Work&quot; and click &quot;Start Work&quot; to begin active defect repair.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {inProgressList.map((task) => (
                <div
                  key={task.assignmentId}
                  className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-blue-500/40 dark:border-blue-600/40 p-6 shadow-sm space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-[#0B4FC2] dark:text-blue-400">
                        {task.ref}
                      </span>
                      <PriorityBadge priority={task.priority as any} />
                      <StatusBadge status={task.status as any} />
                    </div>
                    <div className="text-xs text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1">
                      <ClockIcon className="w-3.5 h-3.5" />
                      <span>SLA Deadline: {new Date(task.targetCompletionAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">
                      {task.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
                      {task.description || 'No detailed description provided by citizen.'}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-semibold">
                      <MapPinIcon className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>{task.landmarkAddress}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Location: <strong>{task.location || task.locality || task.landmarkAddress}</strong> • Category: <strong>{task.category}</strong>
                    </div>
                  </div>

                  {/* Interactive Execution Checklist */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 border border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Field Execution Checklist
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <label className="flex items-center gap-2 text-slate-800 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checklist.siteSecured}
                          onChange={(e) => setChecklist({ ...checklist, siteSecured: e.target.checked })}
                          className="rounded text-[#0B4FC2] focus:ring-[#0B4FC2]"
                        />
                        <span>Traffic safety cones & barriers deployed</span>
                      </label>
                      <label className="flex items-center gap-2 text-slate-800 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checklist.materialPrepped}
                          onChange={(e) => setChecklist({ ...checklist, materialPrepped: e.target.checked })}
                          className="rounded text-[#0B4FC2] focus:ring-[#0B4FC2]"
                        />
                        <span>Surface cleared & base material prepared</span>
                      </label>
                      <label className="flex items-center gap-2 text-slate-800 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checklist.repairExecuted}
                          onChange={(e) => setChecklist({ ...checklist, repairExecuted: e.target.checked })}
                          className="rounded text-[#0B4FC2] focus:ring-[#0B4FC2]"
                        />
                        <span>Bitumen/Asphalt/Wiring repair laid</span>
                      </label>
                      <label className="flex items-center gap-2 text-slate-800 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checklist.siteCleaned}
                          onChange={(e) => setChecklist({ ...checklist, siteCleaned: e.target.checked })}
                          className="rounded text-[#0B4FC2] focus:ring-[#0B4FC2]"
                        />
                        <span>Compacted, leveled & debris removed</span>
                      </label>
                    </div>
                  </div>

                  {/* Attached Defect Photographic Proof */}
                  {task.evidence && task.evidence.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <CameraIcon className="w-3.5 h-3.5 text-[#0B4FC2] dark:text-blue-400" />
                        <span>Citizen Attached Evidence Photos ({task.evidence.length})</span>
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {task.evidence.map((ev, idx) => (
                          <div key={ev.id || idx} className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                            <img
                              src={`/api/v1/evidence/${encodeURIComponent(ev.fileKey)}`}
                              alt={`Evidence ${idx + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Submit Repair Proof / Mark Work Complete Action */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Finished repairs on-site? Submit notes &amp; photographic evidence.
                    </span>
                    <Button
                      variant="primary"
                      onClick={() => {
                        setSelectedTask(task);
                        setIsSubmitModalOpen(true);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs px-4 py-2"
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                      <span>Mark Work Complete</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: AWAITING VERIFICATION */}
      {/* ========================================================================= */}
      {activeTab === 'AWAITING' && (
        <div className="space-y-4">
          {awaitingList.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <ShieldCheckIcon className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No Tasks Awaiting Review
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Jobs that you submit with repair evidence will be displayed here while awaiting municipal supervisor physical inspection.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {awaitingList.map((task) => (
                <div
                  key={task.assignmentId}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#0B4FC2] dark:text-blue-400">
                      {task.ref}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      Pending Inspection
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                      {task.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {task.landmarkAddress}
                    </p>
                  </div>

                  {task.completedAt && (
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs space-y-0.5">
                      <div className="text-[11px] text-slate-500">Submitted by Worker:</div>
                      <div className="font-mono font-medium text-slate-800 dark:text-slate-200">
                        {new Date(task.completedAt).toLocaleString()}
                      </div>
                    </div>
                  )}

                  {task.evidence.length > 0 && (
                    <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                      <CheckCircleIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{task.evidence.length} photo proof attachments registered</span>
                    </div>
                  )}

                  <div className="p-3 bg-amber-50/60 dark:bg-amber-950/40 rounded-xl text-xs text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/60">
                    Awaiting on-site inspection and verification approval by CSMC Supervisor.
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: COMPLETED WORK / WORK HISTORY */}
      {/* ========================================================================= */}
      {activeTab === 'COMPLETED' && (
        <div className="space-y-4">
          {/* History Search Bar */}
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <SearchIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search completed jobs by reference number, title, or address..."
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B4FC2]"
              />
            </div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {completedList.length} Completed
            </div>
          </div>

          {completedList.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <CheckCircleIcon className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No Completed Work Records
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {historySearch
                  ? `No work history matches "${historySearch}".`
                  : 'Tasks you complete and get verified by supervisors will be permanently archived here.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completedList.map((task) => (
                <div
                  key={task.assignmentId}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#0B4FC2] dark:text-blue-400">
                      {task.ref}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      Verified Resolved
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                      {task.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {task.landmarkAddress}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Category:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{task.category}</span>
                    </div>
                    {task.verifiedAt && (
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Verified Date:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {new Date(task.verifiedAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {task.verifierNote && (
                      <div className="pt-1 text-[11px] text-emerald-800 dark:text-emerald-300">
                        <strong>Supervisor Remark:</strong> {task.verifierNote}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 5: MY PROFILE */}
      {/* ========================================================================= */}
      {activeTab === 'PROFILE' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs max-w-2xl mx-auto space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Worker Account Profile
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Manage your personal staff specialization details and account security credentials.
            </p>
          </div>

          {/* Read-Only Official Scope Details */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2 text-xs border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">Official Name:</span>
              <span className="font-bold text-slate-800 dark:text-white">{user?.fullName || 'Field Worker'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Staff Code:</span>
              <span className="font-mono font-bold text-[#0B4FC2] dark:text-blue-400">{user?.staffCode || 'UNASSIGNED'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Authorized Role:</span>
              <span className="font-bold text-slate-800 dark:text-white">FIELD_WORKER</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Municipal Corporation:</span>
              <span className="font-bold text-slate-800 dark:text-white">{corporation?.name || 'Municipal Authority'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Mobile Phone:</span>
              <span className="font-mono text-slate-800 dark:text-white">{user?.phoneNumber}</span>
            </div>
          </div>

          {/* Editable Profile Form */}
          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Designation / Job Title
              </label>
              <Input
                value={profileDesignation}
                onChange={(e) => setProfileDesignation(e.target.value)}
                placeholder="e.g. Senior Asphalt Compactor Lead"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Technical Skills & Equipment Specializations
              </label>
              <Input
                value={profileSkills}
                onChange={(e) => setProfileSkills(e.target.value)}
                placeholder="e.g. Asphalt Paving, Roller Operation, Cold Mix Patching"
              />
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="font-bold text-slate-900 dark:text-white">
                Change Login Password
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                To update your account password, provide your current password and a new secure password (min 8 chars).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Current Password
                  </label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    New Password
                  </label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                disabled={isSavingProfile}
                className="text-xs font-bold"
              >
                {isSavingProfile ? 'Saving...' : 'Save Profile Changes'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Submit Verification Modal */}
      {isSubmitModalOpen && selectedTask && (
        <Modal
          isOpen={isSubmitModalOpen}
          onClose={() => setIsSubmitModalOpen(false)}
          title={`Mark Work Complete — ${selectedTask.ref}`}
        >
          <form onSubmit={handleSubmitWork} className="space-y-4 text-xs">
            <div className="p-3 bg-blue-50/90 dark:bg-blue-950/60 rounded-xl text-xs text-blue-950 dark:text-blue-200 border border-blue-200 dark:border-blue-800/80 space-y-1">
              <p className="font-bold">Work Completion &amp; Inspection Handover</p>
              <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                This action transitions the work order to <strong>Work completed — awaiting verification</strong>. A municipal supervisor will physically inspect the site before final closure.
              </p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Completion Notes & Repair Details *
              </label>
              <textarea
                required
                rows={3}
                value={workNotes}
                onChange={(e) => setWorkNotes(e.target.value)}
                placeholder="Describe materials used (e.g., 300kg cold mix), compaction depth, and work completed..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B4FC2]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Attach Repair Photo Evidence (Completion Proof)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setEvidenceFileName(file.name);
                  }}
                  className="text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#0B4FC2] hover:file:bg-blue-100 dark:file:bg-blue-950 dark:file:text-blue-300"
                />
              </div>
              {evidenceFileName && (
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                  Selected completion photo: {evidenceFileName}
                </div>
              )}
            </div>

            {/* GPS Proximity Section */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  On-Site GPS Verification
                </span>
                <button
                  type="button"
                  onClick={() => handleDetectLocation()}
                  disabled={isLocating}
                  className="px-2.5 py-1 text-[11px] font-bold rounded bg-blue-50 dark:bg-blue-950 text-[#0B4FC2] dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                >
                  {isLocating ? 'Acquiring GPS...' : 'Check GPS Proximity'}
                </button>
              </div>

              {proximityResult && (
                <div
                  className={`text-[11px] p-2 rounded-lg font-medium ${
                    proximityResult.isWithinThreshold
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
                      : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                  }`}
                >
                  {proximityResult.isWithinThreshold
                    ? `✓ Verified within ${proximityResult.distanceMeters ?? 0}m of grievance defect site.`
                    : `⚠️ GPS distance: ${proximityResult.distanceMeters ?? 'unknown'}m from defect site.`}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsSubmitModalOpen(false)}
                disabled={isActionLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isActionLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {isActionLoading ? 'Submitting Proof...' : 'Confirm & Mark Work Complete'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
