'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  UserCheckIcon,
  PlusIcon,
  SearchIcon,
  ShieldCheckIcon,
  AlertTriangleIcon,
} from '@/components/ui/icons';

interface StaffUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  departmentId: string | null;
  departmentName: string | null;
  jurisdictionId: string | null;
  jurisdictionName: string | null;
  jurisdictionType: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);

  // Invite Official Modal State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState('OFFICER');
  const [formDepartmentId, setFormDepartmentId] = useState('');
  const [formJurisdictionId, setFormJurisdictionId] = useState('');

  // Dropdown lists
  const [jurisdictionsList, setJurisdictionsList] = useState<{ id: string; name: string; type: string }[]>([]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/admin/users');
      if (res.ok) {
        const result = await res.json();
        const staffList: StaffUser[] = result.data || [];
        setUsers(staffList);
      } else {
        const err = await res.json().catch(() => ({}));
        setNotice({ message: err.error?.message || 'Failed to load staff directory.', type: 'error' });
      }
    } catch (err) {
      console.error('Failed to load staff users:', err);
      setNotice({ message: 'Network error loading staff users.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchJurisdictions = async () => {
    try {
      const res = await fetch('/api/v1/admin/jurisdictions');
      if (res.ok) {
        const result = await res.json();
        const hierarchy = result.data || result;
        const all = hierarchy.all || [];
        setJurisdictionsList(all);
      }
    } catch (err) {
      console.error('Failed to load jurisdictions for user modal:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchJurisdictions();
  }, []);

  const toggleStatus = async (user: StaffUser) => {
    const nextIsActive = user.status !== 'ACTIVE';
    const actionLabel = nextIsActive ? 'activate' : 'suspend';

    try {
      const res = await fetch(`/api/v1/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextIsActive }),
      });

      if (res.ok) {
        setNotice({
          message: `Official ${user.name} successfully ${actionLabel}d.`,
          type: 'success',
        });
        await fetchUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        setNotice({
          message: err.error?.message || `Failed to ${actionLabel} user.`,
          type: 'error',
        });
      }
    } catch (err) {
      setNotice({ message: `Network error while updating user access.`, type: 'error' });
    }
  };

  const handleInviteOfficial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setNotice({ message: 'Staff name is required.', type: 'error' });
      return;
    }
    if (!formEmail.trim() && !formPhone.trim()) {
      setNotice({ message: 'At least an email address or phone number is required.', type: 'error' });
      return;
    }

    try {
      setInviting(true);
      const res = await fetch('/api/v1/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          email: formEmail.trim() || undefined,
          phone: formPhone.trim() || undefined,
          role: formRole,
          departmentId: formDepartmentId || undefined,
          jurisdictionId: formJurisdictionId || undefined,
        }),
      });

      if (res.ok) {
        setNotice({
          message: `Staff credentials created for ${formName}. Provisioning logged in audit trail.`,
          type: 'success',
        });
        setInviteModalOpen(false);
        setFormName('');
        setFormEmail('');
        setFormPhone('');
        await fetchUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        setNotice({ message: err.error?.message || 'Failed to invite staff member.', type: 'error' });
      }
    } catch (err) {
      setNotice({ message: 'Network error inviting staff member.', type: 'error' });
    } finally {
      setInviting(false);
    }
  };

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(search.toLowerCase())) ||
      (u.phone && u.phone.includes(search)) ||
      u.role.toLowerCase().includes(search.toLowerCase()) ||
      (u.jurisdictionName && u.jurisdictionName.toLowerCase().includes(search.toLowerCase())) ||
      (u.departmentName && u.departmentName.toLowerCase().includes(search.toLowerCase()));

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Notice Banner */}
      {notice && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center justify-between shadow-subtle ${
            notice.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
              : notice.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200'
          }`}
        >
          <span>{notice.message}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="font-bold ml-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-black text-civic-900 dark:text-white tracking-tight">
            User Directory &amp; RBAC Clearances
          </h1>
          <p className="text-xs sm:text-sm text-civic-600 dark:text-slate-400 mt-1">
            Manage government staff clearances, anti-privilege escalation, department assignments, and ward boundary scopes.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setInviteModalOpen(true)}
          className="rounded-xl bg-[#0B4FC2] hover:bg-blue-800 px-4 text-xs font-semibold shadow-xs"
          leftIcon={<PlusIcon className="w-4 h-4" />}
        >
          Invite Official
        </Button>
      </div>

      {/* Users Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-civic-200/90 dark:border-slate-800 p-6 shadow-subtle space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-civic-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-civic-900 dark:text-white uppercase tracking-wider">
              GOVERNMENT PERSONNEL ({users.length})
            </h3>
            {/* Role Filter Pills */}
            <div className="hidden md:flex items-center gap-1 ml-4 text-[11px] font-bold">
              {['ALL', 'PLATFORM_ADMIN', 'SUPERVISOR', 'OFFICER', 'FIELD_WORKER'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`px-2 py-0.5 rounded-lg transition-colors ${
                    roleFilter === r
                      ? 'bg-blue-50 dark:bg-blue-950/80 text-brand-blue dark:text-blue-400 font-extrabold border border-blue-200 dark:border-blue-800'
                      : 'text-civic-500 hover:text-civic-900 dark:hover:text-white'
                  }`}
                >
                  {r === 'ALL' ? 'All Roles' : r}
                </button>
              ))}
            </div>
          </div>

          <div className="relative max-w-sm w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-civic-400 dark:text-slate-500">
              <SearchIcon className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search personnel by name, email, ward..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-civic-50 dark:bg-slate-800 border border-civic-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-civic-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B4FC2] placeholder:text-civic-400 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs font-mono text-civic-500">
            Loading government personnel directory...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-civic-500">
            No officials found matching the search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-civic-200 dark:border-slate-800 text-civic-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                  <th className="pb-3">OFFICIAL</th>
                  <th className="pb-3">ROLE CODE</th>
                  <th className="pb-3">DEPARTMENT</th>
                  <th className="pb-3">JURISDICTION SCOPE</th>
                  <th className="pb-3">STATUS</th>
                  <th className="pb-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-civic-100 dark:divide-slate-800 text-civic-800 dark:text-slate-200">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-civic-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-[#4F46E5] dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                          {u.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-bold text-civic-900 dark:text-white">{u.name}</p>
                          <p className="text-[11px] text-civic-500 dark:text-slate-400 font-mono">
                            {u.email || u.phone || 'No direct contact'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5">
                      <span className="font-mono px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-civic-200 dark:border-slate-700 text-civic-800 dark:text-slate-200">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 font-medium text-civic-700 dark:text-slate-300">
                      {u.departmentName || 'All Departments'}
                    </td>
                    <td className="py-3.5 text-civic-600 dark:text-slate-400">
                      {u.jurisdictionName ? (
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span className="text-brand-blue dark:text-blue-400 font-semibold">{u.jurisdictionName}</span>
                          <span className="text-civic-400">({u.jurisdictionType})</span>
                        </div>
                      ) : (
                        <span className="text-civic-400 italic">Entire Municipal Area</span>
                      )}
                    </td>
                    <td className="py-3.5">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-xs">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            u.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-red-500'
                          }`}
                        />
                        <span
                          className={
                            u.status === 'ACTIVE'
                              ? 'text-civic-800 dark:text-slate-200'
                              : 'text-red-700 dark:text-red-400'
                          }
                        >
                          {u.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                        </span>
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      <Button
                        variant={u.status === 'ACTIVE' ? 'outline' : 'primary'}
                        size="sm"
                        onClick={() => toggleStatus(u)}
                        className={`rounded-xl text-xs py-1 ${
                          u.status === 'ACTIVE'
                            ? 'text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/40'
                            : 'bg-[#0B4FC2] hover:bg-blue-800 text-white'
                        }`}
                      >
                        {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <Modal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        title="Invite Government Staff Member"
        description="Provision access to the Operations Console with scoped role and jurisdiction permissions."
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setInviteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={inviting}
              onClick={handleInviteOfficial}
              className="bg-[#0B4FC2] hover:bg-blue-800 text-white font-bold"
            >
              {inviting ? 'Provisioning...' : 'Send Invitation'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleInviteOfficial} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-civic-800 dark:text-slate-200 mb-1">Full Name</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Er. Ramesh Patil"
              required
              className="w-full p-2.5 border border-civic-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-civic-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-[#0B4FC2] focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold text-civic-800 dark:text-slate-200 mb-1">Official Email</label>
            <input
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="r.patil@csnmc.gov.in"
              className="w-full p-2.5 border border-civic-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-civic-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-[#0B4FC2] focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold text-civic-800 dark:text-slate-200 mb-1">Phone Number (10 digits)</label>
            <input
              type="tel"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder="9876543210"
              className="w-full p-2.5 border border-civic-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-civic-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-[#0B4FC2] focus:outline-none font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-civic-800 dark:text-slate-200 mb-1">Clearance Role</label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                className="w-full p-2.5 border border-civic-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-civic-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-[#0B4FC2] focus:outline-none"
              >
                <option value="OFFICER">OFFICER (Ward Triage)</option>
                <option value="SUPERVISOR">SUPERVISOR (Zone Dispatch)</option>
                <option value="FIELD_WORKER">FIELD_WORKER (Crew Evidence)</option>
                <option value="DEPT_ADMIN">DEPT_ADMIN (Department Policy)</option>
                <option value="PLATFORM_ADMIN">PLATFORM_ADMIN (Root Executive)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-civic-800 dark:text-slate-200 mb-1">Assigned Jurisdiction</label>
              <select
                value={formJurisdictionId}
                onChange={(e) => setFormJurisdictionId(e.target.value)}
                className="w-full p-2.5 border border-civic-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-civic-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-[#0B4FC2] focus:outline-none"
              >
                <option value="">Municipal Scope (All Wards)</option>
                {jurisdictionsList.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name} ({j.type})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
