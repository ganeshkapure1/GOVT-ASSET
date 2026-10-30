import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as otpRequestHandler } from '@/app/api/v1/auth/otp/request/route';
import { POST as otpVerifyHandler } from '@/app/api/v1/auth/otp/verify/route';
import { GET as myComplaintsHandler } from '@/app/api/v1/citizen/my-complaints/route';
import { GET as authMeHandler } from '@/app/api/v1/auth/me/route';
import { middleware } from '@/middleware';
import { requestPhoneOtp, verifyPhoneOtp, clearOtpStore } from '@/server/otp-service';
import { createSessionToken, verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth-session';
import { db } from '@/lib/db';
import * as authModule from '@/server/auth';

describe('GovAsset — Citizen OTP Verification and My Grievances Access (Regression Suite)', () => {
  const citizenPhone = '+919822019901';
  const otherCitizenPhone = '+919822019902';
  const staffPhone = '+919822010101'; // CSMC Officer

  const citizenUserId = '77777777-7777-7777-7777-777777770001';
  const otherCitizenUserId = '77777777-7777-7777-7777-777777770002';
  const staffUserId = '66666666-6666-6666-6666-666666660002';

  beforeEach(() => {
    vi.restoreAllMocks();
    clearOtpStore();
  });

  // ---------------------------------------------------------------------------
  // 1. Requesting a mock OTP for a test citizen
  // ---------------------------------------------------------------------------
  describe('1. Requesting a mock OTP for a test citizen', () => {
    it('dispatches OTP challenge and returns mock notice in non-production', async () => {
      const res = await requestPhoneOtp(citizenPhone);
      expect(res.success).toBe(true);
      expect(res.message).toContain('dispatched');
      expect(res.mockOtpNotice).toBeDefined();
      expect(res.mockOtpNotice).toMatch(/\[Sandbox Mock OTP: \d{6}\]/);
    });

    it('enforces 60-second resend cooldown on immediate second request', async () => {
      const t0 = new Date('2026-10-29T10:00:00Z');
      const t1 = new Date('2026-10-29T10:00:15Z'); // 15 seconds later

      const res1 = await requestPhoneOtp(citizenPhone, t0);
      expect(res1.success).toBe(true);

      const res2 = await requestPhoneOtp(citizenPhone, t1);
      expect(res2.success).toBe(false);
      expect(res2.cooldownRemainingSeconds).toBe(45);
      expect(res2.error).toContain('Please wait 45s');
    });

    it('API route POST /api/v1/auth/otp/request normalizes input and returns mockNotice', async () => {
      vi.spyOn(authModule, 'verifyCsrfProtection').mockReturnValue(true);

      const req = new NextRequest('http://localhost:3000/api/v1/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: '9822019901' }), // 10 digits without +91
      });

      const res = await otpRequestHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.mockNotice).toMatch(/\d{6}/);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Verifying the correct OTP
  // ---------------------------------------------------------------------------
  describe('2. Verifying the correct OTP', () => {
    it('verifies valid OTP, provisions citizen, and issues session token', async () => {
      const req = await requestPhoneOtp(citizenPhone);
      const code = req.mockOtpNotice!.match(/\d{6}/)![0];

      vi.spyOn(db.user, 'findFirst').mockResolvedValue(null);
      vi.spyOn(db.user, 'create').mockResolvedValue({
        id: citizenUserId,
        phoneNumber: citizenPhone,
        fullName: 'Civic Resident',
        role: 'CITIZEN',
        isActive: true,
      } as any);
      vi.spyOn(db.complaint, 'updateMany').mockResolvedValue({ count: 1 } as any);

      const verifyRes = await verifyPhoneOtp(citizenPhone, code);
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.sessionToken).toBeTruthy();
      expect(verifyRes.user?.role).toBe('CITIZEN');
      expect(verifyRes.user?.phoneNumber).toBe(citizenPhone);
    });

    it('API route POST /api/v1/auth/otp/verify sets secure HttpOnly session cookie', async () => {
      vi.spyOn(authModule, 'verifyCsrfProtection').mockReturnValue(true);

      const reqOtp = await requestPhoneOtp(citizenPhone);
      const code = reqOtp.mockOtpNotice!.match(/\d{6}/)![0];

      vi.spyOn(db.user, 'findFirst').mockResolvedValue({
        id: citizenUserId,
        phoneNumber: citizenPhone,
        fullName: 'Civic Resident',
        role: 'CITIZEN',
        isActive: true,
      } as any);
      vi.spyOn(db.complaint, 'updateMany').mockResolvedValue({ count: 0 } as any);

      const req = new NextRequest('http://localhost:3000/api/v1/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: citizenPhone, otp: code }),
      });

      const res = await otpVerifyHandler(req);
      expect(res.status).toBe(200);

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toBeTruthy();
      expect(setCookie).toContain(SESSION_COOKIE_NAME);
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('Path=/');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Rejecting an incorrect or expired OTP
  // ---------------------------------------------------------------------------
  describe('3. Rejecting an incorrect or expired OTP', () => {
    it('rejects incorrect OTP code with remaining attempts', async () => {
      await requestPhoneOtp(citizenPhone);

      const res = await verifyPhoneOtp(citizenPhone, '000000');
      expect(res.success).toBe(false);
      expect(res.error).toContain('2 attempt(s) remaining');
    });

    it('invalidates challenge after 3 failed attempts (brute-force defense)', async () => {
      const req = await requestPhoneOtp(citizenPhone);
      const validCode = req.mockOtpNotice!.match(/\d{6}/)![0];

      await verifyPhoneOtp(citizenPhone, '000000');
      await verifyPhoneOtp(citizenPhone, '111111');
      const res3 = await verifyPhoneOtp(citizenPhone, '222222');
      expect(res3.success).toBe(false);
      expect(res3.error).toContain('Too many incorrect attempts');

      // Subsequent attempt with even the correct code is rejected
      const res4 = await verifyPhoneOtp(citizenPhone, validCode);
      expect(res4.success).toBe(false);
      expect(res4.error).toContain('No active verification code');
    });

    it('rejects expired OTP after 10 minutes TTL', async () => {
      const t0 = new Date('2026-10-29T10:00:00Z');
      const tExpired = new Date('2026-10-29T10:11:00Z'); // 11 minutes later

      const req = await requestPhoneOtp(citizenPhone, t0);
      const code = req.mockOtpNotice!.match(/\d{6}/)![0];

      const res = await verifyPhoneOtp(citizenPhone, code, tExpired);
      expect(res.success).toBe(false);
      expect(res.error).toContain('expired');
    });

    it('enforces single-use consumption invariant (replay attack prevention)', async () => {
      const req = await requestPhoneOtp(citizenPhone);
      const code = req.mockOtpNotice!.match(/\d{6}/)![0];

      vi.spyOn(db.user, 'findFirst').mockResolvedValue({
        id: citizenUserId,
        phoneNumber: citizenPhone,
        fullName: 'Civic Resident',
        role: 'CITIZEN',
        isActive: true,
      } as any);
      vi.spyOn(db.complaint, 'updateMany').mockResolvedValue({ count: 0 } as any);

      const res1 = await verifyPhoneOtp(citizenPhone, code);
      expect(res1.success).toBe(true);

      // Replaying identical code immediately fails
      const res2 = await verifyPhoneOtp(citizenPhone, code);
      expect(res2.success).toBe(false);
      expect(res2.error).toContain('No active verification code');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Creating the citizen session and confirming it persists
  // ---------------------------------------------------------------------------
  describe('4. Creating the citizen session and confirming it persists', () => {
    it('generates a valid, cryptographically signed session token', async () => {
      const token = await createSessionToken({
        userId: citizenUserId,
        email: null,
        phoneNumber: citizenPhone,
        fullName: 'Aarav Mehta',
        role: 'CITIZEN',
        departmentId: null,
        jurisdictionId: null,
      });

      const session = await verifySessionToken(token);
      expect(session).not.toBeNull();
      expect(session?.userId).toBe(citizenUserId);
      expect(session?.phoneNumber).toBe(citizenPhone);
      expect(session?.role).toBe('CITIZEN');
    });

    it('GET /api/v1/auth/me validates session persistence from cookie', async () => {
      const token = await createSessionToken({
        userId: citizenUserId,
        email: 'citizen@govasset.in',
        phoneNumber: citizenPhone,
        fullName: 'Aarav Mehta',
        role: 'CITIZEN',
        departmentId: null,
        jurisdictionId: null,
      });

      vi.spyOn(authModule, 'getServerSession').mockResolvedValue({
        userId: citizenUserId,
        email: 'citizen@govasset.in',
        phoneNumber: citizenPhone,
        fullName: 'Aarav Mehta',
        role: 'CITIZEN',
        departmentId: null,
        jurisdictionId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      });

      const res = await authMeHandler();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.user.fullName).toBe('Aarav Mehta');
      expect(json.user.role).toBe('CITIZEN');
      expect(json.user.phoneNumber).toBe('+91 98*** **901'); // Masked PII
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Opening My Grievances after login
  // ---------------------------------------------------------------------------
  describe('5. Opening My Grievances after login', () => {
    it('middleware allows access to /my-complaints when session cookie is valid', async () => {
      const token = await createSessionToken({
        userId: citizenUserId,
        email: null,
        phoneNumber: citizenPhone,
        fullName: 'Civic Resident',
        role: 'CITIZEN',
        departmentId: null,
        jurisdictionId: null,
      });

      const req = new NextRequest('http://localhost:3000/my-complaints', {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      });

      const res = await middleware(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });

    it('middleware redirects unauthenticated visitor to /login?redirect=/my-complaints', async () => {
      const req = new NextRequest('http://localhost:3000/my-complaints');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/login');
      expect(location).toContain('redirect=%2Fmy-complaints');
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Showing the citizen own complaints & account linking
  // ---------------------------------------------------------------------------
  describe('6. Showing the citizen own complaints after refresh', () => {
    it('retrieves complaints and links any prior unlinked complaints filed with verified phone', async () => {
      vi.spyOn(authModule, 'requireAuth').mockResolvedValue({
        userId: citizenUserId,
        email: null,
        phoneNumber: citizenPhone,
        fullName: 'Civic Resident',
        role: 'CITIZEN',
        departmentId: null,
        jurisdictionId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      });

      const updateManySpy = vi.spyOn(db.complaint, 'updateMany').mockResolvedValue({ count: 1 } as any);
      const findManySpy = vi.spyOn(db.complaint, 'findMany').mockResolvedValue([
        {
          id: 'complaint-001',
          referenceNumber: 'GOV-2026-00482',
          title: 'Damaged Road Pothole',
          status: 'IN_PROGRESS',
          priority: 'P1_CRITICAL',
          landmarkAddress: 'Shahaganj Market, Ward 01',
          createdAt: new Date('2026-10-24T10:00:00Z'),
          resolutionDueAt: new Date('2026-10-25T10:00:00Z'),
          category: { nameEn: 'Damaged Roads & Potholes' },
          jurisdiction: { name: 'CSMC Ward 01' },
        },
      ] as any);

      const res = await myComplaintsHandler();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(1);
      expect(json.data[0].referenceNumber).toBe('GOV-2026-00482');

      // Verify account linking query ran for this phone number
      expect(updateManySpy).toHaveBeenCalledWith({
        where: {
          citizenPhone: citizenPhone,
          citizenId: null,
        },
        data: {
          citizenId: citizenUserId,
        },
      });

      // Verify findMany included citizenId and citizenPhone in OR clause
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { citizenId: citizenUserId },
              { citizenPhone: citizenPhone },
            ],
          },
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Preventing access to another citizen's complaints (Anti-IDOR)
  // ---------------------------------------------------------------------------
  describe('7. Preventing access to another citizen complaints (Anti-IDOR)', () => {
    it('isolates citizen queries strictly to their own user ID and phone number', async () => {
      vi.spyOn(authModule, 'requireAuth').mockResolvedValue({
        userId: otherCitizenUserId,
        email: null,
        phoneNumber: otherCitizenPhone,
        fullName: 'Other Citizen',
        role: 'CITIZEN',
        departmentId: null,
        jurisdictionId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      });

      const findManySpy = vi.spyOn(db.complaint, 'findMany').mockResolvedValue([]);

      const res = await myComplaintsHandler();
      expect(res.status).toBe(200);

      // Verify other citizen can NEVER query citizen A's records
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { citizenId: otherCitizenUserId },
              { citizenPhone: otherCitizenPhone },
            ],
          },
        })
      );
      expect(findManySpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ citizenId: citizenUserId }),
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Ensuring staff/admin routes remain protected
  // ---------------------------------------------------------------------------
  describe('8. Ensuring staff/admin routes remain protected', () => {
    it('rejects citizen token attempting to access admin APIs with 403 Forbidden', async () => {
      const citizenToken = await createSessionToken({
        userId: citizenUserId,
        email: null,
        phoneNumber: citizenPhone,
        fullName: 'Civic Resident',
        role: 'CITIZEN',
        departmentId: null,
        jurisdictionId: null,
      });

      const req = new NextRequest('http://localhost:3000/api/v1/admin/overview', {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${citizenToken}` },
      });

      const res = await middleware(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe('FORBIDDEN');
      expect(json.error.message).toContain('Platform Administrator role required');
    });

    it('rejects citizen token attempting to access ops APIs with 403 Forbidden', async () => {
      const citizenToken = await createSessionToken({
        userId: citizenUserId,
        email: null,
        phoneNumber: citizenPhone,
        fullName: 'Civic Resident',
        role: 'CITIZEN',
        departmentId: null,
        jurisdictionId: null,
      });

      const req = new NextRequest('http://localhost:3000/api/v1/ops/queue', {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${citizenToken}` },
      });

      const res = await middleware(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe('FORBIDDEN');
      expect(json.error.message).toContain('Citizen role cannot access operational endpoints');
    });

    it('middleware redirects citizen visiting /ops/triage to /my-complaints', async () => {
      const citizenToken = await createSessionToken({
        userId: citizenUserId,
        email: null,
        phoneNumber: citizenPhone,
        fullName: 'Civic Resident',
        role: 'CITIZEN',
        departmentId: null,
        jurisdictionId: null,
      });

      const req = new NextRequest('http://localhost:3000/ops/triage', {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${citizenToken}` },
      });

      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/my-complaints');
    });

    it('rejects OTP authentication if phone number is registered to staff (prevents privilege escalation)', async () => {
      const req = await requestPhoneOtp(staffPhone);
      const code = req.mockOtpNotice!.match(/\d{6}/)![0];

      vi.spyOn(db.user, 'findFirst').mockResolvedValue({
        id: staffUserId,
        phoneNumber: staffPhone,
        fullName: 'Sunita Patil (Officer)',
        role: 'OFFICER',
        isActive: true,
      } as any);

      const res = await verifyPhoneOtp(staffPhone, code);
      expect(res.success).toBe(false);
      expect(res.error).toContain('official municipal staff account');
      expect(res.message).toContain('Staff account cannot authenticate via citizen OTP');
      expect(res.sessionToken).toBeUndefined();
    });
  });
});
