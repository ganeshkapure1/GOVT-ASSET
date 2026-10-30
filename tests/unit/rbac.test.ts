import { describe, it, expect } from 'vitest';
import { Permission, hasPermission, getDefaultRedirectForRole } from '@/lib/rbac';
import { maskPhoneNumber, maskEmail, maskFullName } from '@/lib/pii';

describe('Phase 3: Role-Based Access Control (RBAC) & PII Protection', () => {
  describe('RBAC Permission Matrix', () => {
    it('grants Citizen only citizen-scoped permissions (least privilege)', () => {
      expect(hasPermission('CITIZEN', Permission.SUBMIT_COMPLAINT)).toBe(true);
      expect(hasPermission('CITIZEN', Permission.VIEW_OWN_COMPLAINTS)).toBe(true);
      expect(hasPermission('CITIZEN', Permission.DISPUTE_COMPLAINT)).toBe(true);

      // Forbidden for citizens
      expect(hasPermission('CITIZEN', Permission.VIEW_TRIAGE_QUEUE)).toBe(false);
      expect(hasPermission('CITIZEN', Permission.TRIAGE_COMPLAINT)).toBe(false);
      expect(hasPermission('CITIZEN', Permission.ASSIGN_WORK_ORDER)).toBe(false);
      expect(hasPermission('CITIZEN', Permission.VIEW_ASSIGNED_TASKS)).toBe(false);
      expect(hasPermission('CITIZEN', Permission.COMPLETE_TASK)).toBe(false);
      expect(hasPermission('CITIZEN', Permission.VERIFY_RESOLUTION)).toBe(false);
      expect(hasPermission('CITIZEN', Permission.MANAGE_USERS)).toBe(false);
      expect(hasPermission('CITIZEN', Permission.MANAGE_JURISDICTIONS)).toBe(false);
    });

    it('grants Field Worker only task progress and completion permissions', () => {
      expect(hasPermission('FIELD_WORKER', Permission.VIEW_ASSIGNED_TASKS)).toBe(true);
      expect(hasPermission('FIELD_WORKER', Permission.UPDATE_TASK_PROGRESS)).toBe(true);
      expect(hasPermission('FIELD_WORKER', Permission.COMPLETE_TASK)).toBe(true);

      // Forbidden for field workers
      expect(hasPermission('FIELD_WORKER', Permission.VIEW_TRIAGE_QUEUE)).toBe(false);
      expect(hasPermission('FIELD_WORKER', Permission.TRIAGE_COMPLAINT)).toBe(false);
      expect(hasPermission('FIELD_WORKER', Permission.ASSIGN_WORK_ORDER)).toBe(false);
      expect(hasPermission('FIELD_WORKER', Permission.VERIFY_RESOLUTION)).toBe(false);
      expect(hasPermission('FIELD_WORKER', Permission.MANAGE_USERS)).toBe(false);
    });

    it('grants Triage Officer queue, triage, and assignment permissions', () => {
      expect(hasPermission('OFFICER', Permission.VIEW_TRIAGE_QUEUE)).toBe(true);
      expect(hasPermission('OFFICER', Permission.TRIAGE_COMPLAINT)).toBe(true);
      expect(hasPermission('OFFICER', Permission.ASSIGN_WORK_ORDER)).toBe(true);
      expect(hasPermission('OFFICER', Permission.VIEW_ASSIGNED_TASKS)).toBe(true);

      // Forbidden for officers
      expect(hasPermission('OFFICER', Permission.VERIFY_RESOLUTION)).toBe(false);
      expect(hasPermission('OFFICER', Permission.MANAGE_USERS)).toBe(false);
      expect(hasPermission('OFFICER', Permission.MANAGE_JURISDICTIONS)).toBe(false);
      expect(hasPermission('OFFICER', Permission.VIEW_AUDIT_LOGS)).toBe(false);
    });

    it('grants Supervisor resolution verification in addition to officer operations', () => {
      expect(hasPermission('SUPERVISOR', Permission.VIEW_TRIAGE_QUEUE)).toBe(true);
      expect(hasPermission('SUPERVISOR', Permission.TRIAGE_COMPLAINT)).toBe(true);
      expect(hasPermission('SUPERVISOR', Permission.ASSIGN_WORK_ORDER)).toBe(true);
      expect(hasPermission('SUPERVISOR', Permission.VERIFY_RESOLUTION)).toBe(true);
      expect(hasPermission('SUPERVISOR', Permission.REJECT_RESOLUTION)).toBe(true);

      // Forbidden for supervisors
      expect(hasPermission('SUPERVISOR', Permission.MANAGE_USERS)).toBe(false);
      expect(hasPermission('SUPERVISOR', Permission.MANAGE_JURISDICTIONS)).toBe(false);
      expect(hasPermission('SUPERVISOR', Permission.CONFIGURE_PLATFORM)).toBe(false);
    });

    it('grants Platform Admin comprehensive administrative control', () => {
      expect(hasPermission('PLATFORM_ADMIN', Permission.MANAGE_USERS)).toBe(true);
      expect(hasPermission('PLATFORM_ADMIN', Permission.MANAGE_JURISDICTIONS)).toBe(true);
      expect(hasPermission('PLATFORM_ADMIN', Permission.MANAGE_SLA_POLICIES)).toBe(true);
      expect(hasPermission('PLATFORM_ADMIN', Permission.VIEW_AUDIT_LOGS)).toBe(true);
      expect(hasPermission('PLATFORM_ADMIN', Permission.CONFIGURE_PLATFORM)).toBe(true);
      expect(hasPermission('PLATFORM_ADMIN', Permission.VIEW_TRIAGE_QUEUE)).toBe(true);
    });

    it('denies access by default for undefined roles or null values', () => {
      expect(hasPermission(null, Permission.VIEW_TRIAGE_QUEUE)).toBe(false);
      expect(hasPermission(undefined, Permission.VIEW_TRIAGE_QUEUE)).toBe(false);
      expect(hasPermission('GUEST', Permission.VIEW_TRIAGE_QUEUE)).toBe(false);
      expect(hasPermission('INVALID_ROLE', Permission.VIEW_TRIAGE_QUEUE)).toBe(false);
    });
  });

  describe('Portal Navigation Routing by Role', () => {
    it('maps each role to its dedicated primary portal', () => {
      expect(getDefaultRedirectForRole('PLATFORM_ADMIN')).toBe('/admin');
      expect(getDefaultRedirectForRole('OFFICER')).toBe('/ops/triage');
      expect(getDefaultRedirectForRole('SUPERVISOR')).toBe('/ops/verifications');
      expect(getDefaultRedirectForRole('DEPT_ADMIN')).toBe('/ops/triage');
      expect(getDefaultRedirectForRole('FIELD_WORKER')).toBe('/ops/field');
      expect(getDefaultRedirectForRole('CITIZEN')).toBe('/my-complaints');
      expect(getDefaultRedirectForRole('UNKNOWN')).toBe('/');
    });
  });

  describe('DPDP Act 2023 Citizen PII Masking', () => {
    it('masks phone numbers preserving country code and last 3 digits', () => {
      expect(maskPhoneNumber('+919822010008')).toBe('+91 98*** **008');
      expect(maskPhoneNumber('+919822010001')).toBe('+91 98*** **001');
      expect(maskPhoneNumber(null)).toBe('Not available');
      expect(maskPhoneNumber(undefined)).toBe('Not available');
    });

    it('masks email addresses preserving first and last characters and domain', () => {
      expect(maskEmail('citizen.aarav@govasset.in')).toBe('c***v@govasset.in');
      expect(maskEmail('admin@govasset.in')).toBe('a***n@govasset.in');
      expect(maskEmail(null)).toBe('Not available');
    });

    it('masks citizen names for public status displays', () => {
      expect(maskFullName('Aarav Mehta')).toBe('A*** M***');
      expect(maskFullName('Rajesh Kumar Sharma')).toBe('R*** K*** S***');
      expect(maskFullName(null)).toBe('Anonymous Citizen');
    });
  });
});
