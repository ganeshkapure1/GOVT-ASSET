'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FileTextIcon, ShieldCheckIcon, ClockIcon, SearchIcon } from '@/components/ui/icons';

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  action: string;
  entityType: 'COMPLAINT' | 'STAFF' | 'SLA_POLICY' | 'JURISDICTION' | 'SYSTEM';
  entityId: string;
  details: string;
  diff: Record<string, any> | null;
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async (actionFilter?: string) => {
    try {
      setLoading(true);
      const url = actionFilter && actionFilter !== 'ALL'
        ? `/api/v1/admin/audit-logs?action=${actionFilter}`
        : `/api/v1/admin/audit-logs`;
      const res = await fetch(url);
      if (res.ok) {
        const result = await res.json();
        const items: AuditEntry[] = result.data || [];
        setLogs(items);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error?.message || 'Failed to retrieve compliance audit logs.');
      }
    } catch (err) {
      console.error('Failed to load audit trail:', err);
      setError('Network error retrieving audit trail.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(filter);
  }, [filter]);

  const filtered = logs.filter((log) => {
    const term = search.toLowerCase();
    return (
      log.id.toLowerCase().includes(term) ||
      log.actor.toLowerCase().includes(term) ||
      log.actorRole.toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term) ||
      log.entityId.toLowerCase().includes(term) ||
      log.details.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-2xl text-xs text-red-900 dark:text-red-200 flex items-center justify-between shadow-subtle">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-civic-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-brand-blue dark:text-blue-400 text-xs font-bold mb-1 border border-blue-200/50 dark:border-blue-900/50">
            <ShieldCheckIcon className="w-3.5 h-3.5" />
            DPDP Act Compliance &amp; Governance
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-civic-900 dark:text-white tracking-tight">
            Security &amp; Administrative Audit Trail
          </h1>
          <p className="text-xs sm:text-sm text-civic-600 dark:text-slate-400 mt-1">
            Immutable log of status transitions, SLA configuration updates, RBAC role assignments, and administrative actions.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchLogs(filter)}
          className="rounded-xl font-bold"
        >
          Refresh Logs
        </Button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-civic-100 dark:bg-slate-800 rounded-xl border border-civic-200 dark:border-slate-700 text-xs font-semibold self-start max-w-fit overflow-x-auto">
          {[
            { id: 'ALL', label: 'All Records' },
            { id: 'STATUS_CHANGE', label: 'Status Changes' },
            { id: 'SLA_POLICY_UPDATE', label: 'SLA Updates' },
            { id: 'STAFF_ACCESS_UPDATE', label: 'RBAC Grants' },
            { id: 'JURISDICTION_CREATED', label: 'Jurisdiction' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-white dark:bg-slate-900 text-brand-blue dark:text-blue-400 shadow-2xs font-bold'
                  : 'text-civic-600 dark:text-slate-400 hover:text-civic-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-civic-400 dark:text-slate-500">
            <SearchIcon className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit trail..."
            className="w-full text-xs pl-9 pr-3 py-1.5 bg-civic-50 dark:bg-slate-800 border border-civic-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-civic-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B4FC2] placeholder:text-civic-400 dark:placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-slate-900 border border-civic-200/90 dark:border-slate-800 rounded-2xl shadow-subtle p-6 overflow-hidden space-y-4">
        {loading ? (
          <div className="p-8 text-center text-xs font-mono text-civic-500">
            Retrieving immutable compliance records...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-civic-500">
            No audit records found matching the filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-civic-200 dark:border-slate-800 bg-civic-50/80 dark:bg-slate-800/60 text-civic-600 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                  <th className="p-3.5 rounded-l-xl">Log ID</th>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Actor &amp; Role</th>
                  <th className="p-3.5">Action Event</th>
                  <th className="p-3.5">Target Entity</th>
                  <th className="p-3.5">Summary</th>
                  <th className="p-3.5 text-right rounded-r-xl">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-civic-100 dark:divide-slate-800 text-civic-800 dark:text-slate-200">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-civic-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-civic-900 dark:text-white whitespace-nowrap">
                      {log.id.slice(0, 12)}
                    </td>
                    <td className="p-3.5 font-mono text-civic-600 dark:text-slate-400 text-[11px] whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="font-semibold text-civic-900 dark:text-white block">{log.actor}</span>
                      <span className="font-mono text-[10px] text-civic-500 dark:text-slate-400">{log.actorRole}</span>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold ${
                          log.action.includes('SLA')
                            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                            : log.action.includes('STAFF')
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                            : log.action.includes('JURISDICTION')
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            : 'bg-blue-50 dark:bg-blue-950/60 text-brand-blue dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-brand-blue dark:text-blue-400 font-bold whitespace-nowrap">
                      <span className="text-[10px] text-civic-400 block font-normal">{log.entityType}</span>
                      {log.entityId ? log.entityId.slice(0, 16) : 'SYSTEM'}
                    </td>
                    <td className="p-3.5 text-civic-600 dark:text-slate-400 max-w-xs truncate text-[11px]">
                      {log.details}
                    </td>
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                        className="rounded-xl text-xs py-1"
                      >
                        Inspect Diff
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspect Diff Modal */}
      {selectedLog && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedLog(null)}
          title={`Audit Event Inspection: ${selectedLog.id}`}
          description={`Action: ${selectedLog.action} executed by ${selectedLog.actor} (${selectedLog.actorRole})`}
          footer={
            <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
              Close Inspector
            </Button>
          }
        >
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2 p-3 bg-civic-50 dark:bg-slate-800 rounded-xl font-mono text-[11px] text-civic-700 dark:text-slate-300">
              <div>
                <span className="text-civic-400 dark:text-slate-500 block">Target Entity:</span>
                <span className="font-bold text-civic-900 dark:text-white">
                  {selectedLog.entityType}: {selectedLog.entityId}
                </span>
              </div>
              <div>
                <span className="text-civic-400 dark:text-slate-500 block">Timestamp:</span>
                <span className="font-bold text-civic-900 dark:text-white">{selectedLog.timestamp}</span>
              </div>
            </div>

            <div>
              <span className="block font-bold text-civic-800 dark:text-slate-200 mb-1">Event Summary</span>
              <p className="p-2.5 bg-civic-50 dark:bg-slate-800 rounded-xl text-civic-700 dark:text-slate-300 text-xs">
                {selectedLog.details}
              </p>
            </div>

            {selectedLog.diff && (
              <div>
                <span className="block font-bold text-civic-800 dark:text-slate-200 mb-1">
                  JSON Mutation Diff Payload
                </span>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-xs overflow-x-auto border border-slate-800 max-h-56">
                  {JSON.stringify(selectedLog.diff, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
