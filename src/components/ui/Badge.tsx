import React from 'react';
import {
  ClockIcon,
  ClipboardCheckIcon,
  UserCheckIcon,
  WrenchIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  XCircleIcon,
  AlertTriangleIcon,
} from './icons';

export type ComplaintStatus =
  | 'SUBMITTED'
  | 'TRIAGED'
  | 'TRIAGED_VALIDATED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WORK_COMPLETED'
  | 'VERIFIED_RESOLVED'
  | 'REJECTED_INVALID'
  | 'DUPLICATE_LINKED'
  | 'DISPUTED_REOPENED'
  | 'CLOSED';

export type ComplaintPriority = 'P1' | 'P2' | 'P3' | 'P4' | 'P1_CRITICAL' | 'P2_HIGH' | 'P3_MEDIUM' | 'P4_LOW';

export type SLAHealth = 'ON_TRACK' | 'AT_RISK' | 'BREACHED';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
  className?: string;
}

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: ComplaintStatus;
  showIcon?: boolean;
  className?: string;
}

export interface PriorityBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  priority: ComplaintPriority;
  className?: string;
}

export interface SLAHealthBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  health: SLAHealth;
  remainingTime?: string;
  className?: string;
}

// Canonical Status Configuration matching UI_UX.md Section 5.1
const statusConfig: Record<
  ComplaintStatus,
  { label: string; bg: string; text: string; border: string; darkBg: string; darkText: string; darkBorder: string; icon: React.ComponentType<{ className?: string }> }
> = {
  SUBMITTED: {
    label: 'Submitted',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    darkBg: 'dark:bg-blue-950/60',
    darkText: 'dark:text-blue-300',
    darkBorder: 'dark:border-blue-800',
    icon: ClockIcon,
  },
  TRIAGED: {
    label: 'Triaged',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    darkBg: 'dark:bg-purple-950/60',
    darkText: 'dark:text-purple-300',
    darkBorder: 'dark:border-purple-800',
    icon: ClipboardCheckIcon,
  },
  TRIAGED_VALIDATED: {
    label: 'Triaged',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    darkBg: 'dark:bg-purple-950/60',
    darkText: 'dark:text-purple-300',
    darkBorder: 'dark:border-purple-800',
    icon: ClipboardCheckIcon,
  },
  ASSIGNED: {
    label: 'Assigned',
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    darkBg: 'dark:bg-emerald-950/60',
    darkText: 'dark:text-emerald-300',
    darkBorder: 'dark:border-emerald-800',
    icon: UserCheckIcon,
  },
  IN_PROGRESS: {
    label: 'In Progress',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    darkBg: 'dark:bg-amber-950/60',
    darkText: 'dark:text-amber-300',
    darkBorder: 'dark:border-amber-800',
    icon: WrenchIcon,
  },
  WORK_COMPLETED: {
    label: 'Work completed — awaiting verification',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    darkBg: 'dark:bg-emerald-950/60',
    darkText: 'dark:text-emerald-300',
    darkBorder: 'dark:border-emerald-800',
    icon: CheckCircleIcon,
  },
  VERIFIED_RESOLVED: {
    label: 'Resolved',
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
    darkBg: 'dark:bg-emerald-900/50',
    darkText: 'dark:text-emerald-200',
    darkBorder: 'dark:border-emerald-700',
    icon: ShieldCheckIcon,
  },
  REJECTED_INVALID: {
    label: 'Rejected',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    darkBg: 'dark:bg-rose-950/60',
    darkText: 'dark:text-rose-300',
    darkBorder: 'dark:border-rose-800',
    icon: XCircleIcon,
  },
  DUPLICATE_LINKED: {
    label: 'Duplicate Linked',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    darkBg: 'dark:bg-slate-800/80',
    darkText: 'dark:text-slate-300',
    darkBorder: 'dark:border-slate-700',
    icon: ClipboardCheckIcon,
  },
  DISPUTED_REOPENED: {
    label: 'Disputed / Reopened',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    darkBg: 'dark:bg-rose-950/60',
    darkText: 'dark:text-rose-300',
    darkBorder: 'dark:border-rose-800',
    icon: AlertTriangleIcon,
  },
  CLOSED: {
    label: 'Closed',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-300',
    darkBg: 'dark:bg-slate-800/80',
    darkText: 'dark:text-slate-400',
    darkBorder: 'dark:border-slate-700',
    icon: CheckCircleIcon,
  },
};

export function StatusBadge({ status, showIcon = true, className = '', ...props }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.SUBMITTED;
  const IconComponent = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.bg} ${config.text} ${config.border} ${config.darkBg} ${config.darkText} ${config.darkBorder} ${className}`}
      {...props}
    >
      {showIcon && <IconComponent className="w-3.5 h-3.5 shrink-0" />}
      <span>{config.label}</span>
    </span>
  );
}

// Canonical Priority Configuration matching UI_UX.md Section 5.2
export function PriorityBadge({ priority, className = '', ...props }: PriorityBadgeProps) {
  const normalizedPriority = priority.startsWith('P1')
    ? 'P1'
    : priority.startsWith('P2')
    ? 'P2'
    : priority.startsWith('P3')
    ? 'P3'
    : 'P4';

  switch (normalizedPriority) {
    case 'P1':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-danger-700 text-white shadow-sm dark:bg-red-700 dark:text-white ${className}`}
          {...props}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" aria-hidden="true" />
          P1 - Critical
        </span>
      );
    case 'P2':
      return (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border-2 border-orange-500 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-600 ${className}`}
          {...props}
        >
          P2 - High
        </span>
      );
    case 'P3':
      return (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-500 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-600 ${className}`}
          {...props}
        >
          P3 - Medium
        </span>
      );
    case 'P4':
    default:
      return (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 ${className}`}
          {...props}
        >
          P4 - Low
        </span>
      );
  }
}

// SLA Health Badge
export function SLAHealthBadge({ health, remainingTime, className = '', ...props }: SLAHealthBadgeProps) {
  switch (health) {
    case 'ON_TRACK':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-success-50 text-success-700 border border-success-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 ${className}`}
          {...props}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-success-700 dark:bg-emerald-400" aria-hidden="true" />
          {remainingTime ? `${remainingTime} left` : 'On Track'}
        </span>
      );
    case 'AT_RISK':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-warning-50 text-warning-700 border border-warning-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 ${className}`}
          {...props}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-warning-700 dark:bg-amber-400 animate-pulse" aria-hidden="true" />
          {remainingTime ? `At Risk (${remainingTime})` : 'At Risk'}
        </span>
      );
    case 'BREACHED':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-danger-50 text-danger-700 border border-danger-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 ${className}`}
          {...props}
        >
          <AlertTriangleIcon className="w-3.5 h-3.5 text-danger-700 dark:text-rose-400" />
          SLA Breached
        </span>
      );
  }
}

// General Custom Badge
export function Badge({ children, className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-civic-100 text-civic-700 border border-civic-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
