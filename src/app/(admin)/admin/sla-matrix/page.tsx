'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { PriorityBadge } from '@/components/ui/Badge';
import { ClockIcon, ShieldCheckIcon, AlertTriangleIcon } from '@/components/ui/icons';

interface PolicyItem {
  id: string;
  category: {
    id: string;
    name: string;
    code: string;
    department: { id: string; name: string; code: string } | null;
  };
  priority: string;
  responseSlaHours: number;
  resolutionSlaHours: number;
  escalationTier: number;
  updatedAt: string;
}

// Group policies by category for matrix presentation
interface CategoryRow {
  categoryId: string;
  categoryName: string;
  departmentName: string;
  priorities: Record<string, { id: string; response: number; resolution: number }>;
}

export default function AdminSLAMatrixPage() {
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/admin/sla-matrix');
      if (res.ok) {
        const result = await res.json();
        const polList: PolicyItem[] = result.data || result.policies || [];
        setPolicies(polList);

        // Group by category
        const map = new Map<string, CategoryRow>();
        polList.forEach((p) => {
          if (!map.has(p.category.id)) {
            map.set(p.category.id, {
              categoryId: p.category.id,
              categoryName: p.category.name,
              departmentName: p.category.department?.name || 'General Municipal',
              priorities: {},
            });
          }
          const row = map.get(p.category.id)!;
          row.priorities[p.priority] = {
            id: p.id,
            response: p.responseSlaHours,
            resolution: p.resolutionSlaHours,
          };
        });
        setRows(Array.from(map.values()));
      }
    } catch (err) {
      console.error('Failed to load SLA policies:', err);
      setFeedback({ message: 'Failed to load SLA policy matrix from server.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleResolutionChange = (categoryId: string, priority: string, value: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.categoryId !== categoryId) return r;
        const current = r.priorities[priority] || { id: '', response: 2, resolution: 24 };
        return {
          ...r,
          priorities: {
            ...r.priorities,
            [priority]: {
              ...current,
              resolution: value,
            },
          },
        };
      })
    );
  };

  const handleResponseChange = (categoryId: string, priority: string, value: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.categoryId !== categoryId) return r;
        const current = r.priorities[priority] || { id: '', response: 2, resolution: 24 };
        return {
          ...r,
          priorities: {
            ...r.priorities,
            [priority]: {
              ...current,
              response: value,
            },
          },
        };
      })
    );
  };

  const handleSave = async () => {
    // Collect and validate all items
    const updates: { id: string; responseSlaHours: number; resolutionSlaHours: number }[] = [];
    for (const r of rows) {
      for (const [prio, val] of Object.entries(r.priorities)) {
        if (!val.id) continue;
        if (val.response <= 0 || val.resolution <= 0) {
          setFeedback({
            message: `Validation failed for ${r.categoryName} (${prio}): SLA hours must be strictly positive (> 0).`,
            type: 'error',
          });
          return;
        }
        if (val.resolution < val.response) {
          setFeedback({
            message: `Validation failed for ${r.categoryName} (${prio}): Resolution SLA (${val.resolution}h) cannot be less than Response SLA (${val.response}h).`,
            type: 'error',
          });
          return;
        }
        updates.push({
          id: val.id,
          responseSlaHours: val.response,
          resolutionSlaHours: val.resolution,
        });
      }
    }

    try {
      setSaving(true);
      const res = await fetch('/api/v1/admin/sla-matrix', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policies: updates }),
      });

      if (res.ok) {
        setFeedback({
          message: `Successfully updated ${updates.length} SLA policies in the database.`,
          type: 'success',
        });
        await fetchPolicies();
      } else {
        const data = await res.json().catch(() => ({}));
        setFeedback({ message: data.error || 'Failed to update SLA policies.', type: 'error' });
      }
    } catch (err) {
      setFeedback({ message: 'Network error while saving SLA policies.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center justify-between shadow-subtle ${
            feedback.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
              : feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-brand-dark dark:text-blue-300'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="font-bold ml-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-civic-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-brand-blue dark:text-blue-400 text-xs font-bold mb-1 border border-blue-200/50 dark:border-blue-900/50">
            <ClockIcon className="w-3.5 h-3.5" />
            Turnaround Standards
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-civic-900 dark:text-white tracking-tight">
            SLA Policy Matrix &amp; Turnaround Rules
          </h1>
          <p className="text-xs sm:text-sm text-civic-600 dark:text-slate-400 mt-1">
            Configure target response and resolution turnaround deadlines (hours) per category and priority.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl font-bold bg-[#0B4FC2] hover:bg-blue-800"
        >
          {saving ? 'Saving...' : 'Save Policy Changes'}
        </Button>
      </div>

      {/* Matrix Table */}
      <div className="bg-white dark:bg-slate-900 border border-civic-200/90 dark:border-slate-800 rounded-2xl shadow-subtle p-6 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs font-mono text-civic-500">
            Loading SLA policy rules from database...
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-xs text-civic-500">
            No SLA policies configured in the system.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-civic-200 dark:border-slate-800 bg-civic-50/80 dark:bg-slate-800/60 text-civic-700 dark:text-slate-300 uppercase text-[11px] font-bold">
                  <th className="p-3.5 rounded-l-xl">Category</th>
                  <th className="p-3.5">Managing Department</th>
                  <th className="p-3.5 text-center">
                    <PriorityBadge priority="P1" /> (Resp / Res Hours)
                  </th>
                  <th className="p-3.5 text-center">
                    <PriorityBadge priority="P2" /> (Resp / Res Hours)
                  </th>
                  <th className="p-3.5 text-center">
                    <PriorityBadge priority="P3" /> (Resp / Res Hours)
                  </th>
                  <th className="p-3.5 text-center rounded-r-xl">
                    <PriorityBadge priority="P4" /> (Resp / Res Hours)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-civic-100 dark:divide-slate-800 text-civic-800 dark:text-slate-200">
                {rows.map((row) => (
                  <tr key={row.categoryId} className="hover:bg-civic-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 font-bold text-civic-900 dark:text-white">
                      {row.categoryName}
                    </td>
                    <td className="p-3.5 text-civic-600 dark:text-slate-400 font-medium text-xs">
                      {row.departmentName}
                    </td>

                    {['P1', 'P2', 'P3', 'P4'].map((prio) => {
                      const entry = row.priorities[prio];
                      if (!entry) {
                        return (
                          <td key={prio} className="p-3.5 text-center text-civic-400 font-mono text-xs">
                            —
                          </td>
                        );
                      }
                      return (
                        <td key={prio} className="p-3.5 text-center">
                          <div className="inline-flex items-center gap-1 font-mono text-xs">
                            <input
                              type="number"
                              min={1}
                              value={entry.response}
                              onChange={(e) =>
                                handleResponseChange(row.categoryId, prio, parseInt(e.target.value) || 0)
                              }
                              title="Target Response Time (Hours)"
                              className="w-12 p-1.5 text-center border border-civic-300 dark:border-slate-700 rounded-lg font-bold bg-white dark:bg-slate-800 text-civic-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-blue focus:outline-none"
                            />
                            <span className="text-civic-400">/</span>
                            <input
                              type="number"
                              min={1}
                              value={entry.resolution}
                              onChange={(e) =>
                                handleResolutionChange(row.categoryId, prio, parseInt(e.target.value) || 0)
                              }
                              title="Target Resolution Time (Hours)"
                              className="w-14 p-1.5 text-center border border-civic-300 dark:border-slate-700 rounded-lg font-extrabold bg-blue-50/60 dark:bg-blue-950/40 text-brand-blue dark:text-blue-400 focus:ring-2 focus:ring-brand-blue focus:outline-none"
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Explanatory Info Card */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-start gap-3 text-xs text-civic-600 dark:text-slate-400">
        <ShieldCheckIcon className="w-5 h-5 text-brand-blue dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-civic-900 dark:text-white">
            Administrative Turnaround Invariant Enforcement
          </p>
          <p>
            The GovAsset state machine enforces positive durations for all policies. The Resolution Target must always be greater than or equal to the Initial Response Target. Any updates made here are logged with admin actor signatures to the immutable audit trail.
          </p>
        </div>
      </div>
    </div>
  );
}
