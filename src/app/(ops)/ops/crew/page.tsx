'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge';
import {
  WrenchIcon,
  SearchIcon,
  UserCheckIcon,
  ShieldCheckIcon,
  ClockIcon,
  CloseIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
} from '@/components/ui/icons';
import { useOpsContext } from '@/context/OpsContext';
import { CONTROLLED_WORK_TYPES } from '@/lib/skills-taxonomy';

interface WorkerTask {
  assignmentId: string;
  complaintId: string;
  ref: string;
  title: string;
  status: string;
  priority: string;
  landmark: string;
  targetCompletionAt?: string;
  completedAt?: string;
}

interface Worker {
  id: string;
  fullName: string;
  email: string | null;
  phoneNumber: string;
  staffCode: string | null;
  designation: string;
  skills: string;
  isActive: boolean;
  departmentId: string | null;
  departmentName: string;
  jurisdictionId: string | null;
  wardName: string;
  activeWorkload: number;
  assignedTasks?: WorkerTask[];
  completedTasks?: WorkerTask[];
  createdAt: string;
}

export default function CrewDirectoryPage() {
  const { corporation, selectedWardId, authorizedWards } = useOpsContext();

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [workerDetailTab, setWorkerDetailTab] = useState<'ACTIVE' | 'COMPLETED'>('ACTIVE');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Invite Form State
  const [inviteName, setInviteName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStaffCode, setInviteStaffCode] = useState('');
  const [inviteDesignation, setInviteDesignation] = useState('');
  const [inviteSkills, setInviteSkills] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteWardId, setInviteWardId] = useState('');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);

  const fetchWorkers = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set('includeInactive', 'true');
      params.set('includeTasks', 'true');
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }
      const res = await fetch(`/api/v1/ops/workers?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setWorkers(json.data);
        }
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Failed to load crew directory.' });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  const handleToggleStatus = async (worker: Worker) => {
    try {
      const newStatus = !worker.isActive;
      const res = await fetch('/api/v1/ops/workers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: worker.id,
          isActive: newStatus,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionNotice({
          type: 'success',
          message: `Worker "${worker.fullName}" ${newStatus ? 'activated' : 'deactivated'} successfully.`,
        });
        fetchWorkers();
      } else {
        setActionNotice({
          type: 'error',
          message: json?.error?.message || 'Failed to update worker status.',
        });
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Network error updating worker status.' });
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingInvite(true);
    setActionNotice(null);

    try {
      const res = await fetch('/api/v1/ops/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: inviteName.trim(),
          phoneNumber: invitePhone.trim(),
          email: inviteEmail.trim(),
          staffCode: inviteStaffCode.trim() || undefined,
          designation: inviteDesignation.trim() || undefined,
          skills: inviteSkills.trim() || undefined,
          password: invitePassword.trim() || undefined,
          jurisdictionId: inviteWardId || undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setActionNotice({
          type: 'success',
          message: `Crew member "${inviteName}" successfully onboarded.`,
        });
        setIsInviteModalOpen(false);
        setInviteName('');
        setInvitePhone('');
        setInviteEmail('');
        setInviteStaffCode('');
        setInviteDesignation('');
        setInviteSkills('');
        setInvitePassword('');
        setInviteWardId('');
        fetchWorkers();
      } else {
        setActionNotice({
          type: 'error',
          message: json?.error?.message || 'Failed to onboard crew member.',
        });
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Network error submitting onboarding form.' });
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const filteredWorkers = workers.filter((w) => {
    if (statusFilter === 'ACTIVE') return w.isActive;
    if (statusFilter === 'INACTIVE') return !w.isActive;
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Manage Workers &amp; Crew Directory
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950 text-[#0B4FC2] dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              National Workforce (Pan-India)
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Official municipal workforce roster, multi-skill qualification, active task distribution, and worker onboarding.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={fetchWorkers}
            className="text-xs font-semibold"
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            onClick={() => setIsInviteModalOpen(true)}
            className="text-xs font-semibold flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Add Worker / Onboard</span>
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <SearchIcon className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by worker name, staff code, skills..."
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B4FC2]"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">Status:</span>
          {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                statusFilter === st
                  ? 'bg-[#0B4FC2] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {st === 'ALL' ? 'All' : st === 'ACTIVE' ? 'Active' : 'Inactive'}
            </button>
          ))}
        </div>
      </div>

      {/* Crew Table / Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-slate-500">
            Loading crew personnel records...
          </div>
        ) : filteredWorkers.length === 0 ? (
          <div className="p-12 text-center">
            <UserCheckIcon className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Crew Members Found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No crew personnel match "${searchQuery}". Try clearing search filters.`
                : 'No field workers onboarded in this municipal corporation yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Personnel</th>
                  <th className="px-5 py-3.5">Staff Code</th>
                  <th className="px-5 py-3.5">Department &amp; Location</th>
                  <th className="px-5 py-3.5">Skills &amp; Specialization</th>
                  <th className="px-5 py-3.5 text-center">Active Jobs</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredWorkers.map((worker) => {
                  const initials = worker.fullName
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((n) => n[0].toUpperCase())
                    .join('');

                  return (
                    <tr
                      key={worker.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-950 text-[#0B4FC2] dark:text-blue-300 font-bold flex items-center justify-center text-xs shrink-0 border border-blue-200 dark:border-blue-800">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {worker.fullName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {worker.phoneNumber} • {worker.email || 'No email registered'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                          {worker.staffCode || 'UNASSIGNED'}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {worker.departmentName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {worker.wardName}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="text-slate-700 dark:text-slate-300 font-medium">
                          {worker.designation}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs">
                          {worker.skills}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            worker.activeWorkload > 0
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          }`}
                        >
                          {worker.activeWorkload} {worker.activeWorkload === 1 ? 'task' : 'tasks'}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            worker.isActive
                              ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              worker.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                          <span>{worker.isActive ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedWorker(worker)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#0B4FC2] dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                          >
                            Work Orders
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(worker)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                              worker.isActive
                                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                            }`}
                          >
                            {worker.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Worker Work Orders Modal */}
      {selectedWorker && (
        <Modal
          isOpen={Boolean(selectedWorker)}
          onClose={() => setSelectedWorker(null)}
          title={`Crew Member Profile — ${selectedWorker.fullName}`}
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Staff Code:</span>
                <span className="font-bold text-slate-800 dark:text-white font-mono">{selectedWorker.staffCode || 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Designation:</span>
                <span className="font-bold text-slate-800 dark:text-white">{selectedWorker.designation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Department:</span>
                <span className="font-bold text-slate-800 dark:text-white">{selectedWorker.departmentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Verified Skills:</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">{selectedWorker.skills || 'None'}</span>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 gap-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setWorkerDetailTab('ACTIVE')}
                className={`pb-2 border-b-2 -mb-px transition-colors ${
                  workerDetailTab === 'ACTIVE'
                    ? 'border-[#0B4FC2] text-[#0B4FC2] dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                Active Tasks ({selectedWorker.assignedTasks?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setWorkerDetailTab('COMPLETED')}
                className={`pb-2 border-b-2 -mb-px transition-colors ${
                  workerDetailTab === 'COMPLETED'
                    ? 'border-[#0B4FC2] text-[#0B4FC2] dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                Completed History ({selectedWorker.completedTasks?.length || 0})
              </button>
            </div>

            {workerDetailTab === 'ACTIVE' ? (
              (!selectedWorker.assignedTasks || selectedWorker.assignedTasks.length === 0) ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  No active work orders currently assigned to this worker.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {selectedWorker.assignedTasks.map((t) => (
                    <div
                      key={t.assignmentId}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#0B4FC2] dark:text-blue-400">{t.ref}</span>
                        <div className="flex items-center gap-1.5">
                          <PriorityBadge priority={t.priority as any} />
                          <StatusBadge status={t.status as any} />
                        </div>
                      </div>
                      <div className="font-semibold text-slate-900 dark:text-white">{t.title}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.landmark}</div>
                      {t.targetCompletionAt && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                          Target: {new Date(t.targetCompletionAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : (
              (!selectedWorker.completedTasks || selectedWorker.completedTasks.length === 0) ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  No completed work history on file for this worker yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {selectedWorker.completedTasks.map((t) => (
                    <div
                      key={t.assignmentId}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{t.ref}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Verified &amp; Resolved
                        </span>
                      </div>
                      <div className="font-semibold text-slate-900 dark:text-white">{t.title}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.landmark}</div>
                      {t.completedAt && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                          Completed: {new Date(t.completedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            <div className="pt-2 flex justify-end">
              <Button variant="secondary" onClick={() => setSelectedWorker(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Invite New Crew Member Modal */}
      {isInviteModalOpen && (
        <Modal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          title="Add / Onboard Field Crew Personnel"
        >
          <form onSubmit={handleInviteSubmit} className="space-y-3.5 text-xs">
            {/* Corporation Scoping Notice */}
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl text-[11px] text-slate-700 dark:text-slate-300">
              <span className="font-bold text-[#0B4FC2] dark:text-blue-300 block">
                Corporation: {corporation ? `${corporation.name} (${corporation.code})` : 'Authorized Corporation'}
              </span>
              <p>Onboarded personnel will be officially authorized to receive work orders across the municipal corporation jurisdiction.</p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Full Name *
              </label>
              <Input
                required
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="e.g. Ramesh Kale"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mobile Phone *
                </label>
                <Input
                  required
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  placeholder="+919822010105"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Official Email Address / Username *
                </label>
                <Input
                  required
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="ramesh.kale@govasset.in"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Staff Code *
                </label>
                <Input
                  required
                  value={inviteStaffCode}
                  onChange={(e) => setInviteStaffCode(e.target.value)}
                  placeholder="CSMC-FW-003"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Jurisdiction Scope
                </label>
                <div className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-xs">
                  {corporation ? `${corporation.name} (${corporation.city})` : 'City-Wide Jurisdiction'}
                </div>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Designation
              </label>
              <Input
                value={inviteDesignation}
                onChange={(e) => setInviteDesignation(e.target.value)}
                placeholder="e.g. Electrical Lineman Lead"
              />
            </div>

            {/* Multi-Skill Work Type Tag Selector */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Technical Work Types &amp; Specializations (Select Multiple)
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
                Click work types below to qualify this worker for automated task matching:
              </p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {Object.values(CONTROLLED_WORK_TYPES).map((wt) => {
                  const isSelected =
                    inviteSkills.toLowerCase().includes(wt.label.toLowerCase()) ||
                    inviteSkills.toLowerCase().includes(wt.primarySkills[0]?.toLowerCase() || '');
                  return (
                    <button
                      key={wt.id}
                      type="button"
                      onClick={() => {
                        const current = inviteSkills
                          ? inviteSkills
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean)
                          : [];
                        if (isSelected) {
                          setInviteSkills(
                            current
                              .filter(
                                (s) =>
                                  s.toLowerCase() !== wt.label.toLowerCase() &&
                                  s.toLowerCase() !== wt.primarySkills[0]?.toLowerCase()
                              )
                              .join(', ')
                          );
                        } else {
                          setInviteSkills([...current, wt.label].join(', '));
                        }
                      }}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-all ${
                        isSelected
                          ? 'bg-[#0B4FC2] text-white border-[#0B4FC2]'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {wt.label}
                    </button>
                  );
                })}
              </div>
              <Input
                value={inviteSkills}
                onChange={(e) => setInviteSkills(e.target.value)}
                placeholder="e.g. Streetlight Repair, Electrical Maintenance, Cable Splicing"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Initial Account Password
              </label>
              <Input
                type="password"
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                placeholder="Leave blank to use secure default (password123)"
                helperText="Cryptographically hashed with scrypt before persistence. Never stored in plaintext."
              />
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsInviteModalOpen(false)}
                disabled={isSubmittingInvite}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmittingInvite}
              >
                {isSubmittingInvite ? 'Onboarding...' : 'Confirm & Onboard'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
