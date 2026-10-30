import { UserRole } from './auth-session';

/**
 * Role-Based Access Control (RBAC) Permissions for GovAsset
 *
 * Implements strict principle of least privilege:
 * - Permissions denied by default
 * - Explicit grant mapping per role
 */

export enum Permission {
  // Citizen Operations
  SUBMIT_COMPLAINT = 'complaint:submit',
  VIEW_OWN_COMPLAINTS = 'complaint:view_own',
  DISPUTE_COMPLAINT = 'complaint:dispute',

  // Municipal Triage Operations
  VIEW_TRIAGE_QUEUE = 'ops:view_triage_queue',
  TRIAGE_COMPLAINT = 'ops:triage_complaint',
  ASSIGN_WORK_ORDER = 'ops:assign_work_order',

  // Field Crew Execution
  VIEW_ASSIGNED_TASKS = 'field:view_assigned_tasks',
  UPDATE_TASK_PROGRESS = 'field:update_task_progress',
  COMPLETE_TASK = 'field:complete_task',

  // Supervision & Verification
  VERIFY_RESOLUTION = 'ops:verify_resolution',
  REJECT_RESOLUTION = 'ops:reject_resolution',

  // Platform Administration
  MANAGE_USERS = 'admin:manage_users',
  MANAGE_JURISDICTIONS = 'admin:manage_jurisdictions',
  MANAGE_SLA_POLICIES = 'admin:manage_sla_policies',
  VIEW_AUDIT_LOGS = 'admin:view_audit_logs',
  CONFIGURE_PLATFORM = 'admin:configure_platform',
}

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  CITIZEN: [
    Permission.SUBMIT_COMPLAINT,
    Permission.VIEW_OWN_COMPLAINTS,
    Permission.DISPUTE_COMPLAINT,
  ],

  FIELD_WORKER: [
    Permission.VIEW_ASSIGNED_TASKS,
    Permission.UPDATE_TASK_PROGRESS,
    Permission.COMPLETE_TASK,
  ],

  OFFICER: [
    Permission.VIEW_TRIAGE_QUEUE,
    Permission.TRIAGE_COMPLAINT,
    Permission.ASSIGN_WORK_ORDER,
    Permission.VIEW_ASSIGNED_TASKS,
  ],

  SUPERVISOR: [
    Permission.VIEW_TRIAGE_QUEUE,
    Permission.TRIAGE_COMPLAINT,
    Permission.ASSIGN_WORK_ORDER,
    Permission.VIEW_ASSIGNED_TASKS,
    Permission.VERIFY_RESOLUTION,
    Permission.REJECT_RESOLUTION,
  ],

  DEPT_ADMIN: [
    Permission.VIEW_TRIAGE_QUEUE,
    Permission.TRIAGE_COMPLAINT,
    Permission.ASSIGN_WORK_ORDER,
    Permission.VIEW_ASSIGNED_TASKS,
    Permission.VERIFY_RESOLUTION,
    Permission.REJECT_RESOLUTION,
    Permission.MANAGE_SLA_POLICIES,
  ],

  PLATFORM_ADMIN: [
    Permission.SUBMIT_COMPLAINT,
    Permission.VIEW_OWN_COMPLAINTS,
    Permission.DISPUTE_COMPLAINT,
    Permission.VIEW_TRIAGE_QUEUE,
    Permission.TRIAGE_COMPLAINT,
    Permission.ASSIGN_WORK_ORDER,
    Permission.VIEW_ASSIGNED_TASKS,
    Permission.UPDATE_TASK_PROGRESS,
    Permission.COMPLETE_TASK,
    Permission.VERIFY_RESOLUTION,
    Permission.REJECT_RESOLUTION,
    Permission.MANAGE_USERS,
    Permission.MANAGE_JURISDICTIONS,
    Permission.MANAGE_SLA_POLICIES,
    Permission.VIEW_AUDIT_LOGS,
    Permission.CONFIGURE_PLATFORM,
  ],
};

/**
 * Checks whether a given role has a specific permission.
 * Denies access by default if permission or role is unrecognized.
 */
export function hasPermission(role: UserRole | string | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role as UserRole];
  if (!permissions) return false;
  return permissions.includes(permission);
}

/**
 * Determines the primary landing destination upon successful login.
 */
export function getDefaultRedirectForRole(role: UserRole | string): string {
  switch (role) {
    case 'PLATFORM_ADMIN':
      return '/admin';
    case 'OFFICER':
    case 'DEPT_ADMIN':
      return '/ops/triage';
    case 'SUPERVISOR':
      return '/ops/verifications';
    case 'FIELD_WORKER':
      return '/ops/field';
    case 'CITIZEN':
      return '/my-complaints';
    default:
      return '/';
  }
}
