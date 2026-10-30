import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as loginHandler } from '@/app/api/v1/auth/login/route';
import { POST as logoutHandler } from '@/app/api/v1/auth/logout/route';
import { db } from '@/lib/db';
import { PILOT_DEV_PASSWORD } from '@/lib/auth-crypto';
import { SESSION_COOKIE_NAME } from '@/lib/auth-session';

describe('Phase 3: Authentication API Endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns 400 when email or password is missing for staff login', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'officer@govasset.in' }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INVALID_INPUT');
    });

    it('returns 401 with generic error when user is not found (anti-enumeration)', async () => {
      vi.spyOn(db.user, 'findFirst').mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent.user@govasset.in',
          password: 'password123',
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toBe('Invalid email or password.');
    });

    it('returns 401 with generic error when password is incorrect', async () => {
      vi.spyOn(db.user, 'findFirst').mockResolvedValue({
        id: 'user-01',
        email: 'officer.kothrud@govasset.in',
        phoneNumber: '+919822010002',
        fullName: 'Sunita Patil',
        role: 'OFFICER' as const,
        departmentId: 'dept-roads',
        jurisdictionId: 'ward-kothrud',
        isActive: true,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only',
        staffCode: null,
        designation: null,
        skills: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      });

      const req = new NextRequest('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'officer.kothrud@govasset.in',
          password: 'WrongPassword456!',
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toBe('Invalid email or password.');
    });

    it('returns 403 when user account is inactive', async () => {
      vi.spyOn(db.user, 'findFirst').mockResolvedValue({
        id: 'user-01',
        email: 'inactive@govasset.in',
        phoneNumber: '+919822010999',
        fullName: 'Terminated Staff',
        role: 'FIELD_WORKER' as const,
        departmentId: null,
        jurisdictionId: null,
        isActive: false, // Inactive
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only',
        staffCode: null,
        designation: null,
        skills: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      });

      const req = new NextRequest('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'inactive@govasset.in',
          password: PILOT_DEV_PASSWORD,
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('ACCOUNT_DISABLED');
    });

    it('authenticates valid staff credentials and sets HttpOnly session cookie', async () => {
      vi.spyOn(db.user, 'findFirst').mockResolvedValue({
        id: '66666666-6666-6666-6666-666666660002',
        email: 'officer.kothrud@govasset.in',
        phoneNumber: '+919822010002',
        fullName: 'Sunita Patil (Ward 28 Triage Officer)',
        role: 'OFFICER' as const,
        departmentId: 'dept-roads',
        jurisdictionId: 'ward-kothrud',
        isActive: true,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only',
        staffCode: null,
        designation: null,
        skills: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      });

      vi.spyOn(db.user, 'update').mockResolvedValue({} as any);

      const req = new NextRequest('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'officer.kothrud@govasset.in',
          password: PILOT_DEV_PASSWORD,
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.fullName).toBe('Sunita Patil (Ward 28 Triage Officer)');
      expect(data.user.role).toBe('OFFICER');
      expect(data.redirectTo).toBe('/ops/triage');

      // Verify cookie is set
      const cookie = res.cookies.get(SESSION_COOKIE_NAME);
      expect(cookie).toBeDefined();
      expect(cookie?.value).toBeTruthy();
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.path).toBe('/');
    });

    it('authenticates citizen by phone number and sets session cookie', async () => {
      vi.spyOn(db.user, 'findFirst').mockResolvedValue({
        id: '66666666-6666-6666-6666-666666660008',
        email: 'citizen.aarav@govasset.in',
        phoneNumber: '+919822010008',
        fullName: 'Aarav Mehta (Registered Citizen)',
        role: 'CITIZEN' as const,
        departmentId: null,
        jurisdictionId: null,
        isActive: true,
        passwordHash: null,
        staffCode: null,
        designation: null,
        skills: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      });

      vi.spyOn(db.user, 'update').mockResolvedValue({} as any);

      const req = new NextRequest('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: '+919822010008',
          isCitizen: true,
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.role).toBe('CITIZEN');
      expect(data.redirectTo).toBe('/my-complaints');
      expect(res.cookies.get(SESSION_COOKIE_NAME)).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('terminates active session and expires session cookie', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/logout', {
        method: 'POST',
      });
      const res = await logoutHandler(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);

      const cookie = res.cookies.get(SESSION_COOKIE_NAME);
      expect(cookie).toBeDefined();
      expect(cookie?.maxAge).toBe(0);
    });
  });
});
