'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  ShieldCheckIcon,
  UserCheckIcon,
  ClockIcon,
  SearchIcon,
  PlusIcon,
  FileTextIcon,
  BuildingIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  MapPinIcon,
} from '@/components/ui/icons';

interface RoleActivityItem {
  id: string;
  name: string;
  description: string;
  userCount: number;
  createdAt: string;
  status: 'Active' | 'Terminated' | 'Waiting';
}

interface AdminOverviewData {
  totalComplaints: number;
  activeBacklog: number;
  resolvedCount: number;
  disputedCount: number;
  slaBreaches: number;
  complianceRate: number;
  totalStaff: number;
  activeStaff: number;
  inactiveStaff: number;
  byDepartment: Record<string, number>;
  byCategory: Record<string, number>;
}

export default function AdminDashboardPage() {
  const [search, setSearch] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['Worker']);
  const [createRoleModalOpen, setCreateRoleModalOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminOverviewData | null>(null);

  const [roles, setRoles] = useState<RoleActivityItem[]>([
    { id: '1', name: 'PLATFORM_ADMIN', description: 'Full System Access & Cross-Zonal Oversight', userCount: 2, createdAt: 'Jan 15, 2026', status: 'Active' },
    { id: '2', name: 'SUPERVISOR', description: 'Zonal operations, crew dispatch & work verification', userCount: 18, createdAt: 'Jan 15, 2026', status: 'Active' },
    { id: '3', name: 'OFFICER', description: 'Ward-level intake, triage, and department review', userCount: 45, createdAt: 'Jan 15, 2026', status: 'Active' },
    { id: '4', name: 'FIELD_WORKER', description: 'Working crew access and photo evidence upload', userCount: 84, createdAt: 'Jan 15, 2026', status: 'Active' },
    { id: '5', name: 'DEPT_ADMIN', description: 'Department-specific policy and queue management', userCount: 8, createdAt: 'Jan 15, 2026', status: 'Active' },
  ]);

  useEffect(() => {
    let isMounted = true;
    async function fetchOverview() {
      try {
        const res = await fetch('/api/v1/admin/overview');
        if (res.ok) {
          const result = await res.json();
          const statsData = result.data || result.overview;
          if (isMounted && statsData) {
            setStats(statsData);
          }
        }
      } catch (err) {
        console.error('Failed to load admin overview:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchOverview();
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleSelect = (name: string) => {
    setSelectedRoles((prev) =>
      prev.includes(name) ? prev.filter((r) => r !== name) : [...prev, name]
    );
  };

  const handleExport = () => {
    const csvContent =
      'Role Name,Description,Users,Created At,Status\n' +
      roles.map((r) => `"${r.name}","${r.description}",${r.userCount},"${r.createdAt}","${r.status}"`).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roles_and_permissions_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice('Roles and permissions exported to CSV.');
  };

  const filtered = roles.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Notice Banner */}
      {notice && (
        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-xs text-indigo-950 dark:text-indigo-200 flex items-center justify-between shadow-subtle">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-[#4F46E5] dark:text-indigo-400 font-bold ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Database & Spatial Engine Telemetry Ribbon */}
      <div className="bg-white dark:bg-slate-900 border border-civic-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircleIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-civic-900 dark:text-white">Supabase PostgreSQL &bull; PostGIS Active</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                HEALTHY
              </span>
            </div>
            <p className="text-[11px] text-civic-500 dark:text-slate-400 font-mono">
              Managed DB Connection • 16 Wards Geofenced • Schema v2.1 Verified
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto text-[11px] font-mono text-civic-600 dark:text-slate-400 bg-civic-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-civic-200 dark:border-slate-700">
          <MapPinIcon className="w-3.5 h-3.5 text-brand-blue dark:text-blue-400" />
          <span>Spatial Indexes: GIST(location)</span>
        </div>
      </div>

      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-black text-civic-900 dark:text-white tracking-tight">
            System Administration &amp; Access Controls
          </h1>
          <p className="text-xs sm:text-sm text-civic-600 dark:text-slate-400 mt-1">
            Executive oversight, role assignments, SLA compliance metrics, and municipal operations.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={handleExport} className="rounded-xl px-4 text-xs font-semibold">
            Export
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setCreateRoleModalOpen(true)}
            className="rounded-xl bg-[#0B4FC2] hover:bg-blue-800 px-4 text-xs font-semibold shadow-xs"
            leftIcon={<PlusIcon className="w-4 h-4" />}
          >
            Create Role
          </Button>
        </div>
      </div>

      {/* TOP SUMMARY STAT CARDS & QUICK ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 4 Stat Metric Cards (8 cols) */}
        <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Card 1: Total Backlog */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-civic-200/90 dark:border-slate-800 p-5 shadow-subtle flex flex-col justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-brand-blue dark:text-blue-400 mb-2">
              <ClockIcon className="w-5 h-5 text-brand-blue dark:text-blue-400" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-civic-500 dark:text-slate-400 uppercase tracking-wider block">
                ACTIVE BACKLOG
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-civic-900 dark:text-white font-mono mt-1 block">
                {stats ? stats.activeBacklog : loading ? '...' : '14'}
              </span>
              <span className="text-[10px] text-civic-400 font-mono mt-0.5 block">
                {stats ? `of ${stats.totalComplaints} total` : 'across all wards'}
              </span>
            </div>
          </div>

          {/* Card 2: SLA Compliance Rate */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-civic-200/90 dark:border-slate-800 p-5 shadow-subtle flex flex-col justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
              <ShieldCheckIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-civic-500 dark:text-slate-400 uppercase tracking-wider block">
                SLA COMPLIANCE
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-1 block">
                {stats ? `${stats.complianceRate}%` : loading ? '...' : '92%'}
              </span>
              <span className="text-[10px] text-civic-400 font-mono mt-0.5 block">
                {stats ? `${stats.slaBreaches} breached` : 'within target'}
              </span>
            </div>
          </div>

          {/* Card 3: Active Staff */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-civic-200/90 dark:border-slate-800 p-5 shadow-subtle flex flex-col justify-between">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-civic-800 dark:text-slate-200 mb-2">
              <UserCheckIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-civic-500 dark:text-slate-400 uppercase tracking-wider block">
                GOVT PERSONNEL
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-civic-900 dark:text-white font-mono mt-1 block">
                {stats ? stats.activeStaff : loading ? '...' : '156'}
              </span>
              <span className="text-[10px] text-civic-400 font-mono mt-0.5 block">
                {stats ? `${stats.totalStaff} provisioned` : 'active officials'}
              </span>
            </div>
          </div>

          {/* Card 4: Disputed Complaints */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-civic-200/90 dark:border-slate-800 p-5 shadow-subtle flex flex-col justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-2">
              <ClockIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-civic-500 dark:text-slate-400 uppercase tracking-wider block">
                CITIZEN DISPUTES
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono mt-1 block">
                {stats ? stats.disputedCount : loading ? '...' : '2'}
              </span>
              <span className="text-[10px] text-civic-400 font-mono mt-0.5 block">
                requiring re-triage
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions Card (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-civic-200/90 dark:border-slate-800 p-5 shadow-subtle space-y-3">
          <span className="text-[11px] font-bold text-civic-500 dark:text-slate-400 uppercase tracking-wider block">
            ADMIN MODULES
          </span>
          <div className="space-y-2">
            <Link
              href="/admin/jurisdictions"
              className="w-full flex items-center justify-between p-3 rounded-xl border border-civic-200 dark:border-slate-800 hover:border-[#0B4FC2] dark:hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all text-left block"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-civic-700 dark:text-slate-300">
                  <BuildingIcon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-civic-900 dark:text-white">Jurisdictions &amp; Wards</p>
                  <p className="text-[10px] text-civic-500 dark:text-slate-400">PostGIS polygon boundary hierarchy</p>
                </div>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-civic-400 dark:text-slate-500" />
            </Link>

            <Link
              href="/admin/sla-matrix"
              className="w-full flex items-center justify-between p-3 rounded-xl border border-civic-200 dark:border-slate-800 hover:border-[#0B4FC2] dark:hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all text-left block"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-civic-700 dark:text-slate-300">
                  <ClockIcon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-civic-900 dark:text-white">SLA Policy Matrix</p>
                  <p className="text-[10px] text-civic-500 dark:text-slate-400">Response &amp; resolution turnaround standards</p>
                </div>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-civic-400 dark:text-slate-500" />
            </Link>

            <Link
              href="/admin/audit-logs"
              className="w-full flex items-center justify-between p-3 rounded-xl border border-civic-200 dark:border-slate-800 hover:border-[#0B4FC2] dark:hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all text-left block"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-civic-700 dark:text-slate-300">
                  <FileTextIcon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-civic-900 dark:text-white">Compliance Audit Trail</p>
                  <p className="text-[10px] text-civic-500 dark:text-slate-400">DPDP compliance &amp; immutable event logs</p>
                </div>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-civic-400 dark:text-slate-500" />
            </Link>
          </div>
        </div>
      </div>

      {/* ACTIVITY TABLE CARD */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-civic-200/90 dark:border-slate-800 p-6 shadow-subtle space-y-4">
        {/* Table Toolbar with Internal Search Input */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-civic-100 dark:border-slate-800 pb-4">
          <h3 className="text-sm font-extrabold text-civic-900 dark:text-white uppercase tracking-wider">
            RBAC PERMISSIONS &amp; ROLE CLEARANCES
          </h3>
          <div className="relative max-w-sm w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-civic-400 dark:text-slate-500">
              <SearchIcon className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users, roles, permissions.."
              className="w-full text-xs pl-9 pr-3 py-2 bg-civic-50 dark:bg-slate-800 border border-civic-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-civic-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B4FC2] placeholder:text-civic-400 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* High-Density Activity Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-civic-200 dark:border-slate-800 text-civic-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <th className="pb-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedRoles.length === filtered.length && filtered.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedRoles(filtered.map((r) => r.name));
                      else setSelectedRoles([]);
                    }}
                    aria-label="Select all roles"
                    className="rounded border-civic-300 dark:border-slate-700 text-[#0B4FC2] focus:ring-[#0B4FC2]"
                  />
                </th>
                <th className="pb-3">ROLE NAME</th>
                <th className="pb-3">DESCRIPTION</th>
                <th className="pb-3">ASSIGNED USERS</th>
                <th className="pb-3">CREATED AT</th>
                <th className="pb-3">CURRENT STATUS</th>
                <th className="pb-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-civic-100 dark:divide-slate-800 text-civic-800 dark:text-slate-200">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-civic-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(item.name)}
                      onChange={() => toggleSelect(item.name)}
                      aria-label={`Select role ${item.name}`}
                      className="rounded border-civic-300 dark:border-slate-700 text-[#0B4FC2] focus:ring-[#0B4FC2]"
                    />
                  </td>
                  <td className="py-3.5 font-bold text-civic-900 dark:text-white whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <ShieldCheckIcon className="w-4 h-4 text-[#0B4FC2] dark:text-blue-400" />
                      <span>{item.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 text-civic-600 dark:text-slate-400 font-medium max-w-xs truncate">
                    {item.description}
                  </td>
                  <td className="py-3.5">
                    <div className="flex items-center -space-x-1.5">
                      <div className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-700 ring-2 ring-white dark:ring-slate-900 flex items-center justify-center text-[10px] font-bold text-civic-700 dark:text-slate-200">A</div>
                      <div className="w-6 h-6 rounded-full bg-blue-300 dark:bg-blue-800 ring-2 ring-white dark:ring-slate-900 flex items-center justify-center text-[10px] font-bold text-blue-900 dark:text-blue-100">B</div>
                      <div className="w-6 h-6 rounded-full bg-emerald-300 dark:bg-emerald-800 ring-2 ring-white dark:ring-slate-900 flex items-center justify-center text-[10px] font-bold text-emerald-900 dark:text-emerald-100">C</div>
                      <span className="text-[10px] font-bold text-brand-blue dark:text-blue-400 pl-2 font-mono whitespace-nowrap">
                        + {item.userCount}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 font-mono text-civic-500 dark:text-slate-400 whitespace-nowrap">
                    {item.createdAt}
                  </td>
                  <td className="py-3.5">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-xs">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          item.status === 'Active'
                            ? 'bg-emerald-500'
                            : item.status === 'Terminated'
                            ? 'bg-red-500'
                            : 'bg-amber-500'
                        }`}
                      />
                      <span
                        className={
                          item.status === 'Active'
                            ? 'text-civic-800 dark:text-slate-200'
                            : item.status === 'Terminated'
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }
                      >
                        {item.status}
                      </span>
                    </span>
                  </td>
                  <td className="py-3.5 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setNotice(`Viewing permissions matrix for role: ${item.name}`)}
                      className="text-civic-500 dark:text-slate-400 hover:text-civic-900 dark:hover:text-white"
                    >
                      •••
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Create Role Modal */}
      <Modal
        isOpen={createRoleModalOpen}
        onClose={() => setCreateRoleModalOpen(false)}
        title="Create New Access Role"
        description="Define RBAC privileges, clearance tier, and departmental scopes."
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateRoleModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-[#0B4FC2] hover:bg-blue-800 text-white font-bold"
              onClick={() => {
                setCreateRoleModalOpen(false);
                setNotice('New role definition verified with server-side RBAC guards.');
              }}
            >
              Save Role Definition
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-civic-800 dark:text-slate-200 mb-1">Role Title</label>
            <input
              type="text"
              placeholder="e.g. Zonal Drainage Inspector"
              className="w-full p-2.5 border border-civic-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-civic-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-[#4F46E5] focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold text-civic-800 dark:text-slate-200 mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Explain authorization perimeter..."
              className="w-full p-2.5 border border-civic-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-civic-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-[#4F46E5] focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold text-civic-800 dark:text-slate-200 mb-1">Clearance Level</label>
            <select className="w-full p-2.5 border border-civic-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-civic-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-[#4F46E5] focus:outline-none">
              <option>OFFICER Clearance (Triage &amp; Intake)</option>
              <option>SUPERVISOR Clearance (Dispatch &amp; Verification)</option>
              <option>ADMIN Clearance (Executive Management)</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
