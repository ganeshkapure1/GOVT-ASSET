'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { BellIcon, ShieldCheckIcon, CheckCircleIcon, ClockIcon, AlertTriangleIcon } from '@/components/ui/icons';

interface DiagnosticData {
  queue: {
    totalJobs: number;
    pendingCount: number;
    processingCount: number;
    completedCount: number;
    failedCount: number;
    deadLetterCount: number;
    oldestPendingAgeMs: number;
    isSchedulerConfigured: boolean;
  };
  deadLetterJobs: Array<{
    id: string;
    type: string;
    attempts: number;
    lastError: string | null;
    failedAt: string | null;
  }>;
  notifications: {
    totalCount: number;
    sentCount: number;
    failedCount: number;
    pendingCount: number;
    deliverySuccessRate: number;
    smsProvider: { name: string; isConfigured: boolean; mode: string };
    emailProvider: { name: string; isConfigured: boolean; mode: string };
    recentLogs: Array<{
      id: string;
      channel: string;
      recipientMasked: string;
      templateCode: string;
      status: string;
      dispatchedAt: string;
      provider: string;
    }>;
  };
  systemStatus: {
    isSchedulerConfigured: boolean;
    smsMode: string;
    emailMode: string;
    timestamp: string;
  };
}

export default function AdminNotificationsPage() {
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testChannel, setTestChannel] = useState<'SMS' | 'EMAIL'>('SMS');
  const [testRecipient, setTestRecipient] = useState('+919822000001');
  const [sendingTest, setSendingTest] = useState(false);

  const fetchDiagnostics = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/admin/jobs/health');
      if (res.ok) {
        const result = await res.json();
        setData(result.data);
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedback({ message: err.error?.message || 'Failed to retrieve notification diagnostics.', type: 'error' });
      }
    } catch (err) {
      console.error('Failed to load health metrics:', err);
      setFeedback({ message: 'Network error retrieving gateway telemetry.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSendingTest(true);
      const res = await fetch('/api/v1/admin/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: testChannel,
          recipientPhone: testChannel === 'SMS' ? testRecipient : undefined,
          recipientEmail: testChannel === 'EMAIL' ? testRecipient : undefined,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setFeedback({
          message: `Test notification dispatched successfully via ${result.data.mode} (${result.data.provider}).`,
          type: 'success',
        });
        setTestModalOpen(false);
        await fetchDiagnostics();
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedback({ message: err.error?.message || 'Failed to dispatch test notification.', type: 'error' });
      }
    } catch (err) {
      setFeedback({ message: 'Network error dispatching test notification.', type: 'error' });
    } finally {
      setSendingTest(false);
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
          <button type="button" onClick={() => setFeedback(null)} className="font-bold ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-civic-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-brand-blue dark:text-blue-400 text-xs font-bold mb-1 border border-blue-200/50 dark:border-blue-900/50">
            <BellIcon className="w-3.5 h-3.5" />
            Communication Infrastructure &amp; Workers
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-civic-900 dark:text-white tracking-tight">
            Notification Delivery Health &amp; Gateway Monitors
          </h1>
          <p className="text-xs sm:text-sm text-civic-600 dark:text-slate-400 mt-1">
            Track transactional SMS delivery rates, DLT template compliance, background queue backlogs, and dead-letter queues.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchDiagnostics} className="rounded-xl text-xs font-semibold">
            Refresh Metrics
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setTestModalOpen(true)}
            leftIcon={<BellIcon className="w-4 h-4" />}
            className="rounded-xl font-bold bg-[#0B4FC2] hover:bg-blue-800"
          >
            Send Test Notification
          </Button>
        </div>
      </div>

      {/* Gateway Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Card 1: SMS Gateway */}
        <div className="bg-white dark:bg-slate-900 border border-civic-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-civic-500 dark:text-slate-400 uppercase tracking-wider">
                Transactional SMS (DLT)
              </span>
              <Badge
                className={`font-bold ${
                  data?.notifications.smsProvider.isConfigured
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200'
                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200'
                }`}
              >
                {data?.notifications.smsProvider.isConfigured ? 'PRODUCTION_LIVE' : 'MOCK_SANDBOX'}
              </Badge>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-extrabold text-civic-900 dark:text-white font-mono">
                {data ? `${data.notifications.deliverySuccessRate}%` : loading ? '...' : '100%'}
              </span>
              <span className="text-xs text-civic-500 dark:text-slate-400 block mt-0.5">
                Delivery Success Rate ({data?.notifications.sentCount || 0} Sent)
              </span>
            </div>
          </div>
          <p className="text-[11px] text-civic-500 dark:text-slate-400 mt-3 pt-3 border-t border-civic-100 dark:border-slate-800 font-mono">
            Provider: {data?.notifications.smsProvider.name || 'MSG91 / Fast2SMS'}
          </p>
        </div>

        {/* Card 2: Email Gateway */}
        <div className="bg-white dark:bg-slate-900 border border-civic-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-civic-500 dark:text-slate-400 uppercase tracking-wider">
                Transactional Email
              </span>
              <Badge
                className={`font-bold ${
                  data?.notifications.emailProvider.isConfigured
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200'
                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200'
                }`}
              >
                {data?.notifications.emailProvider.isConfigured ? 'PRODUCTION_LIVE' : 'MOCK_SANDBOX'}
              </Badge>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-extrabold text-civic-900 dark:text-white font-mono">
                {data ? `${data.notifications.deliverySuccessRate}%` : loading ? '...' : '100%'}
              </span>
              <span className="text-xs text-civic-500 dark:text-slate-400 block mt-0.5">
                Delivery Success Rate
              </span>
            </div>
          </div>
          <p className="text-[11px] text-civic-500 dark:text-slate-400 mt-3 pt-3 border-t border-civic-100 dark:border-slate-800 font-mono">
            Provider: {data?.notifications.emailProvider.name || 'Resend / AWS SES'}
          </p>
        </div>

        {/* Card 3: Queue & Dead-Letter Backlog */}
        <div className="bg-white dark:bg-slate-900 border border-civic-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-civic-500 dark:text-slate-400 uppercase tracking-wider">
                Background Queue &amp; DLQ
              </span>
              <Badge
                className={`font-bold ${
                  (data?.queue.deadLetterCount || 0) > 0
                    ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200'
                }`}
              >
                {(data?.queue.deadLetterCount || 0) > 0 ? 'FAILURES_DETECTED' : 'CLEAN'}
              </Badge>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-extrabold text-civic-900 dark:text-white font-mono">
                {data ? `${data.queue.deadLetterCount} Failed` : loading ? '...' : '0 Failed'}
              </span>
              <span className="text-xs text-civic-500 dark:text-slate-400 block mt-0.5">
                {data?.queue.pendingCount || 0} Pending &bull; {data?.queue.completedCount || 0} Completed
              </span>
            </div>
          </div>
          <p className="text-[11px] text-civic-500 dark:text-slate-400 mt-3 pt-3 border-t border-civic-100 dark:border-slate-800 font-mono">
            Scheduler Status: {data?.systemStatus.isSchedulerConfigured ? 'CRON CONFIGURED' : 'ON-DEMAND'}
          </p>
        </div>
      </div>

      {/* Dead-Letter Queue Section if any failures exist */}
      {data && data.deadLetterJobs.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-2xl p-5 shadow-subtle space-y-3">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-bold text-xs uppercase tracking-wider">
            <AlertTriangleIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span>Dead-Letter Queue (Terminal Failures)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400 uppercase text-[10px] font-bold">
                  <th className="pb-2">Job ID</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Attempts</th>
                  <th className="pb-2">Failure Error</th>
                  <th className="pb-2">Failed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-200/60 dark:divide-red-900/40 font-mono text-red-900 dark:text-red-200">
                {data.deadLetterJobs.map((j) => (
                  <tr key={j.id}>
                    <td className="py-2 font-bold">{j.id.slice(0, 12)}</td>
                    <td className="py-2">{j.type}</td>
                    <td className="py-2">{j.attempts} attempts</td>
                    <td className="py-2 text-xs font-sans max-w-xs truncate">{j.lastError}</td>
                    <td className="py-2 text-[11px]">{j.failedAt ? new Date(j.failedAt).toLocaleTimeString() : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Dispatches Preview */}
      <div className="bg-white dark:bg-slate-900 border border-civic-200/90 dark:border-slate-800 rounded-2xl shadow-subtle p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-civic-100 dark:border-slate-800 pb-3">
          <h2 className="text-sm font-extrabold text-civic-900 dark:text-white uppercase tracking-wider">
            Recent Transactional Messages Log
          </h2>
          <span className="text-xs text-civic-500 dark:text-slate-400 font-mono">Real-time Stream</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs font-mono text-civic-500">
            Loading gateway delivery records...
          </div>
        ) : !data || data.notifications.recentLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-civic-500">
            No notifications dispatched yet. Use &ldquo;Send Test Notification&rdquo; to test dispatching.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-civic-200 dark:border-slate-800 text-civic-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3">Recipient (Masked)</th>
                  <th className="py-3">Channel</th>
                  <th className="py-3">Template Code</th>
                  <th className="py-3">Dispatched At</th>
                  <th className="py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-civic-100 dark:divide-slate-800 font-mono text-civic-800 dark:text-slate-200">
                {data.notifications.recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-civic-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 font-bold text-civic-900 dark:text-white">
                      {log.recipientMasked}
                    </td>
                    <td className="py-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-brand-blue dark:text-blue-400 font-bold text-[11px] border border-blue-200/50 dark:border-blue-900/50">
                        {log.channel}
                      </span>
                    </td>
                    <td className="py-3.5 font-sans font-medium">{log.templateCode}</td>
                    <td className="py-3.5 text-civic-500 dark:text-slate-400 text-xs">
                      {new Date(log.dispatchedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </td>
                    <td className="py-3.5 text-right">
                      <span
                        className={`font-bold text-xs ${
                          log.status === 'SENT' || log.status === 'DELIVERED'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : log.status === 'FAILED'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Send Test Notification Modal */}
      <Modal
        isOpen={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        title="Send Administrative Test Notification"
        description="Verify gateway delivery configuration and check sandbox payload logging."
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setTestModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={sendingTest}
              onClick={handleSendTest}
              className="bg-[#0B4FC2] hover:bg-blue-800 text-white font-bold"
            >
              {sendingTest ? 'Dispatching...' : 'Dispatch Message'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSendTest} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-civic-800 dark:text-slate-200 mb-1">
              Delivery Channel
            </label>
            <select
              value={testChannel}
              onChange={(e) => {
                const ch = e.target.value as 'SMS' | 'EMAIL';
                setTestChannel(ch);
                setTestRecipient(ch === 'SMS' ? '+919822000001' : 'admin@csnmc.gov.in');
              }}
              className="w-full p-2.5 border border-civic-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-civic-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-[#0B4FC2] focus:outline-none"
            >
              <option value="SMS">SMS Gateway (Fast2SMS / MSG91)</option>
              <option value="EMAIL">Transactional Email (Resend / AWS SES)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-civic-800 dark:text-slate-200 mb-1">
              {testChannel === 'SMS' ? 'Recipient Mobile (10-digit Indian Number)' : 'Recipient Email'}
            </label>
            <input
              type={testChannel === 'SMS' ? 'tel' : 'email'}
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              placeholder={testChannel === 'SMS' ? '+919822000001' : 'official@govasset.in'}
              required
              className="w-full p-2.5 border border-civic-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-civic-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-[#0B4FC2] focus:outline-none font-mono"
            />
          </div>

          <div className="p-3 bg-civic-50 dark:bg-slate-800/80 rounded-xl text-civic-600 dark:text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-civic-800 dark:text-slate-200">
              <ShieldCheckIcon className="w-4 h-4 text-brand-blue" />
              <span>Sandbox Delivery Policy</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              If real gateway API keys are unconfigured in server environment variables, this dispatch will execute safely via the offline mock sandbox adapter and log the payload without external charges or failures.
            </p>
          </div>
        </form>
      </Modal>
    </div>
  );
}
