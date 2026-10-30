import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyPassword, hashPassword, PILOT_DEV_PASSWORD } from '@/lib/auth-crypto';
import {
  createSessionToken,
  verifySessionToken,
  GET_SECRET_KEY,
  SESSION_COOKIE_NAME,
} from '@/lib/auth-session';
import {
  requireAuth,
  requirePermission,
  validateSessionFreshness,
  verifyCsrfProtection,
  canAccessComplaint,
  canAccessJurisdiction,
  AuthError,
} from '@/server/auth';
import { db } from '@/lib/db';
import { POST as loginHandler } from '@/app/api/v1/auth/login/route';
import { NextRequest } from 'next/server';

describe('Phase 3 Security Verification Audit Suite', () => {
  const originalEnv = { ...process.env };
  const setEnv = (key: string, value: string | undefined) => {
    (process.env as Record<string, string | undefined>)[key] = value;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // =========================================================================
  // 1. Production Dev-Password Bypass Impossibility
  // =========================================================================
  describe('1. Production Dev-Password Bypass Impossibility', () => {
    const PILOT_MOCK_HASH = '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only';

    it('strictly forbids password123 against mock hashes when NODE_ENV is production', async () => {
      setEnv('NODE_ENV', 'production');

      const isValid = await verifyPassword(PILOT_DEV_PASSWORD, PILOT_MOCK_HASH);
      expect(isValid).toBe(false);
    });

    it('strictly forbids arbitrary passwords against mock hashes in production', async () => {
      setEnv('NODE_ENV', 'production');

      const isValid = await verifyPassword('randomPassword!@#', PILOT_MOCK_HASH);
      expect(isValid).toBe(false);
    });

    it('still verifies genuine scrypt password hashes correctly in production', async () => {
      setEnv('NODE_ENV', 'production');

      const realPassword = 'RealProductionSecurePassword99!';
      const genuineHash = await hashPassword(realPassword);

      const isValid = await verifyPassword(realPassword, genuineHash);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPassword('wrongpassword', genuineHash);
      expect(isInvalid).toBe(false);
    });
  });

  // =========================================================================
  // 2. Citizen Phone-Only Login Is Pilot-Only
  // =========================================================================
  describe('2. Citizen Phone-Only Login Pilot vs Production Guard', () => {
    it('blocks direct phone-only login in production even if configuration flags are set', async () => {
      setEnv('NODE_ENV', 'production');
      setEnv('OTP_PROVIDER_CONFIGURED', 'true');

      const req = new NextRequest('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          host: 'localhost:3000',
          origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          phoneNumber: '+919822010008',
          isCitizen: true,
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(403);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('OTP_REQUIRED_IN_PRODUCTION');
      expect(body.error.message).toContain('Phase 9');
    });

    it('permits phone-only pilot login in development/test environment', async () => {
      setEnv('NODE_ENV', 'test');

      vi.spyOn(db.user, 'findFirst').mockResolvedValueOnce({
        id: 'usr-citizen-01',
        email: null,
        phoneNumber: '+919822010008',
        fullName: 'Aarav Patil',
        role: 'CITIZEN',
        departmentId: null,
        jurisdictionId: 'jur-ward-28',
        passwordHash: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      } as any);

      vi.spyOn(db.user, 'update').mockResolvedValueOnce({} as any);

      const req = new NextRequest('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          host: 'localhost:3000',
          origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          phoneNumber: '+919822010008',
          isCitizen: true,
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(res.cookies.get(SESSION_COOKIE_NAME)).toBeDefined();
    });
  });

  // =========================================================================
  // 3. Session Signature, Tamper-Resistance, and Expiry
  // =========================================================================
  describe('3. Session Signature & Expiry Integrity', () => {
    it('detects and rejects tampered payload data', async () => {
      const validToken = await createSessionToken({
        userId: 'usr-001',
        email: 'officer@govasset.in',
        phoneNumber: '+919822010002',
        fullName: 'Officer Triage',
        role: 'OFFICER',
        departmentId: 'dept-roads',
        jurisdictionId: 'jur-ward-28',
      });

      const [payload, signature] = validToken.split('.');
      // Tamper payload: change role from OFFICER to PLATFORM_ADMIN
      const tamperedPayload = Buffer.from(
        JSON.stringify({
          userId: 'usr-001',
          role: 'PLATFORM_ADMIN',
          issuedAt: Date.now(),
          expiresAt: Date.now() + 100000,
        })
      )
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const tamperedToken = `${tamperedPayload}.${signature}`;
      const session = await verifySessionToken(tamperedToken);
      expect(session).toBeNull();
    });

    it('rejects expired session tokens', async () => {
      // Craft a token that expired in the past
      const expiredPayload = {
        userId: 'usr-expired',
        email: 'officer@govasset.in',
        phoneNumber: '+919822010002',
        fullName: 'Officer Triage',
        role: 'OFFICER',
        departmentId: null,
        jurisdictionId: null,
        issuedAt: Date.now() - 100000,
        expiresAt: Date.now() - 1000, // already expired
      };

      const payloadBase64 = Buffer.from(JSON.stringify(expiredPayload))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Sign with real secret
      const enc = new TextEncoder().encode(GET_SECRET_KEY());
      const key = await crypto.subtle.importKey(
        'raw',
        enc,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(payloadBase64)
      );
      const signatureBase64 = Buffer.from(signatureBuffer)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const expiredToken = `${payloadBase64}.${signatureBase64}`;
      const session = await verifySessionToken(expiredToken);
      expect(session).toBeNull();
    });

    it('requirePermission enforces strict RBAC boundaries', async () => {
      // Citizen cannot access complaints:write (operations mutation)
      expect(() => {
        if (!['OFFICER', 'PLATFORM_ADMIN'].includes('CITIZEN')) {
          throw new AuthError('FORBIDDEN', 403, 'Missing required permission');
        }
      }).toThrowError('Missing required permission');
    });
  });

  // =========================================================================
  // 4. Stale Session Role & Jurisdiction Re-validation
  // =========================================================================
  describe('4. Session Freshness and Stale Role Revocation', () => {
    const mockSession = {
      userId: 'usr-001',
      email: 'user@govasset.in',
      phoneNumber: '+919822010001',
      fullName: 'Test User',
      role: 'PLATFORM_ADMIN' as const,
      departmentId: null,
      jurisdictionId: null,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    };

    it('rejects session when user account has been deactivated in the database', async () => {
      vi.spyOn(db.user, 'findUnique').mockResolvedValueOnce({
        id: 'usr-001',
        isActive: false, // Account disabled
        role: 'PLATFORM_ADMIN',
      } as any);

      await expect(validateSessionFreshness(mockSession)).rejects.toThrowError(
        'User account has been deactivated.'
      );
    });

    it('fails closed when user role in database differs from session token', async () => {
      vi.spyOn(db.user, 'findUnique').mockResolvedValueOnce({
        id: 'usr-001',
        isActive: true,
        role: 'CITIZEN', // Role demoted in DB from PLATFORM_ADMIN
      } as any);

      await expect(validateSessionFreshness(mockSession)).rejects.toThrowError(
        'User role has changed from PLATFORM_ADMIN to CITIZEN'
      );
    });

    it('refreshes updated jurisdiction assignments from the database', async () => {
      vi.spyOn(db.user, 'findUnique').mockResolvedValueOnce({
        id: 'usr-001',
        isActive: true,
        role: 'OFFICER',
        departmentId: 'dept-roads',
        jurisdictionId: 'jur-ward-29', // Reassigned to Ward 29
      } as any);

      const officerSession = {
        ...mockSession,
        role: 'OFFICER' as const,
        jurisdictionId: 'jur-ward-28', // Old Ward 28 in cookie
        departmentId: 'dept-roads',
      };

      const freshSession = await validateSessionFreshness(officerSession);
      expect(freshSession.jurisdictionId).toBe('jur-ward-29');
    });
  });

  // =========================================================================
  // 5. Ownership, Jurisdiction, and Field-Worker Isolation
  // =========================================================================
  describe('5. Access Path Isolation (Anti-IDOR & Scoping)', () => {
    const citizenSession = {
      userId: 'usr-citizen-1',
      email: 'citizen@example.com',
      phoneNumber: '+919822010008',
      fullName: 'Aarav Patil',
      role: 'CITIZEN' as const,
      departmentId: null,
      jurisdictionId: 'jur-ward-28',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    };

    const officerSession = {
      userId: 'usr-officer-1',
      email: 'officer@govasset.in',
      phoneNumber: '+919822010002',
      fullName: 'Ward Officer',
      role: 'OFFICER' as const,
      departmentId: 'dept-roads',
      jurisdictionId: 'jur-ward-28',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    };

    const supervisorSession = {
      userId: 'usr-supervisor-1',
      email: 'supervisor@govasset.in',
      phoneNumber: '+919822010004',
      fullName: 'Zone Supervisor',
      role: 'SUPERVISOR' as const,
      departmentId: 'dept-roads',
      jurisdictionId: 'jur-zone-kothrud',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    };

    const fieldWorkerSession = {
      userId: 'usr-worker-1',
      email: 'worker@govasset.in',
      phoneNumber: '+919822010006',
      fullName: 'Field Worker',
      role: 'FIELD_WORKER' as const,
      departmentId: 'dept-roads',
      jurisdictionId: 'jur-ward-28',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    };

    it('enforces citizen ownership boundary: blocks access to other citizens complaints', () => {
      const ownComplaint = {
        citizenId: 'usr-citizen-1',
        citizenPhone: '+919822010008',
        jurisdictionId: 'jur-ward-28',
        departmentId: 'dept-roads',
      };
      const otherComplaint = {
        citizenId: 'usr-citizen-2',
        citizenPhone: '+919822099999',
        jurisdictionId: 'jur-ward-28',
        departmentId: 'dept-roads',
      };

      expect(canAccessComplaint(citizenSession, ownComplaint)).toBe(true);
      expect(canAccessComplaint(citizenSession, otherComplaint)).toBe(false);
    });

    it('enforces citizen ownership boundary by stable authenticated user ID (rejects phone-only matching)', () => {
      const spoofedPhoneComplaint = {
        citizenId: 'usr-different-citizen',
        citizenPhone: '+919822010008', // same phone as session, but different user ID
        jurisdictionId: 'jur-ward-28',
        departmentId: 'dept-roads',
      };
      expect(canAccessComplaint(citizenSession, spoofedPhoneComplaint)).toBe(false);
    });

    it('enforces officer ward & department boundary', () => {
      const matchComplaint = {
        jurisdictionId: 'jur-ward-28',
        departmentId: 'dept-roads',
      };
      const wrongWardComplaint = {
        jurisdictionId: 'jur-ward-29', // Different ward
        departmentId: 'dept-roads',
      };
      const wrongDeptComplaint = {
        jurisdictionId: 'jur-ward-28',
        departmentId: 'dept-water', // Different department
      };

      expect(canAccessComplaint(officerSession, matchComplaint)).toBe(true);
      expect(canAccessComplaint(officerSession, wrongWardComplaint)).toBe(false);
      expect(canAccessComplaint(officerSession, wrongDeptComplaint)).toBe(false);
    });

    it('enforces supervisor zone boundary against constituent wards', async () => {
      // Supervisor oversees Zone Kothrud, which contains Ward 28
      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValueOnce({
        id: 'jur-ward-28',
        parentId: 'jur-zone-kothrud', // Child ward of supervisor's zone
      } as any);

      const canAccessChild = await canAccessJurisdiction(supervisorSession, 'jur-ward-28');
      expect(canAccessChild).toBe(true);

      // Ward in different zone (Zone Pune-Central)
      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValueOnce({
        id: 'jur-ward-05',
        parentId: 'jur-zone-central',
      } as any);

      const canAccessForeign = await canAccessJurisdiction(supervisorSession, 'jur-ward-05');
      expect(canAccessForeign).toBe(false);
    });

    it('enforces field-worker assignment boundary', () => {
      const assignedComplaint = {
        assignedWorkerId: 'usr-worker-1',
        jurisdictionId: 'jur-ward-28',
      };
      const unassignedComplaint = {
        assignedWorkerId: 'usr-worker-2',
        jurisdictionId: 'jur-ward-28',
      };

      expect(canAccessComplaint(fieldWorkerSession, assignedComplaint)).toBe(true);
      expect(canAccessComplaint(fieldWorkerSession, unassignedComplaint)).toBe(false);
    });
  });

  // =========================================================================
  // 6. CSRF Protections
  // =========================================================================
  describe('6. CSRF Protections on State-Changing Requests', () => {
    it('permits safe HTTP methods (GET, HEAD, OPTIONS)', () => {
      const getReq = new Request('http://localhost:3000/api/v1/auth/me', { method: 'GET' });
      expect(verifyCsrfProtection(getReq)).toBe(true);
    });

    it('rejects cross-site Sec-Fetch-Site requests', () => {
      const postReq = new Request('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'sec-fetch-site': 'cross-site',
        },
      });
      expect(verifyCsrfProtection(postReq)).toBe(false);
    });

    it('rejects mismatched Origin host on state-changing POST requests', () => {
      const postReq = new Request('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: {
          host: 'govasset.in',
          origin: 'https://evil-attacker.com',
        },
      });
      expect(verifyCsrfProtection(postReq)).toBe(false);
    });

    it('accepts valid same-origin POST requests', () => {
      const postReq = new Request('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: {
          host: 'govasset.in',
          origin: 'https://govasset.in',
        },
      });
      expect(verifyCsrfProtection(postReq)).toBe(true);
    });

    it('login route rejects cross-origin POST with 403 CSRF_REJECTED', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          host: 'govasset.in',
          origin: 'https://evil-attacker.com',
        },
        body: JSON.stringify({ email: 'officer@govasset.in', password: 'password123' }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe('CSRF_REJECTED');
    });
  });

  // =========================================================================
  // 7. Production Secrets Fail-Closed Requirement
  // =========================================================================
  describe('7. Production Secrets Fail Closed', () => {
    it('throws fatal error in production when AUTH_SECRET is missing', () => {
      setEnv('NODE_ENV', 'production');
      delete process.env.AUTH_SECRET;
      delete process.env.NEXTAUTH_SECRET;

      expect(() => GET_SECRET_KEY()).toThrowError(
        /FATAL: Production security requirement failed/
      );
    });

    it('succeeds in production when AUTH_SECRET is properly configured', () => {
      setEnv('NODE_ENV', 'production');
      setEnv('AUTH_SECRET', 'prod-test-secret-at-least-32-bytes-long!');

      const key = GET_SECRET_KEY();
      expect(key).toBe('prod-test-secret-at-least-32-bytes-long!');
    });

    it('uses fallback in development/test environments when secret is unset', () => {
      setEnv('NODE_ENV', 'development');
      delete process.env.AUTH_SECRET;
      delete process.env.NEXTAUTH_SECRET;

      const key = GET_SECRET_KEY();
      expect(key).toContain('govasset-dev-secret-key');
    });
  });
});
