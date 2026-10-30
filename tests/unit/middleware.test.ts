import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { createSessionToken, SESSION_COOKIE_NAME, UserSession } from '@/lib/auth-session';

describe('Phase 3: Next.js Edge Middleware Portal Protection', () => {
  let citizenToken: string;
  let officerToken: string;
  let fieldWorkerToken: string;
  let adminToken: string;

  beforeEach(async () => {
    citizenToken = await createSessionToken({
      userId: 'user-citizen-01',
      email: 'citizen.aarav@govasset.in',
      phoneNumber: '+919822010008',
      fullName: 'Aarav Mehta',
      role: 'CITIZEN',
      departmentId: null,
      jurisdictionId: null,
    });

    officerToken = await createSessionToken({
      userId: 'user-officer-01',
      email: 'officer.kothrud@govasset.in',
      phoneNumber: '+919822010002',
      fullName: 'Sunita Patil',
      role: 'OFFICER',
      departmentId: 'dept-roads',
      jurisdictionId: 'ward-kothrud-28',
    });

    fieldWorkerToken = await createSessionToken({
      userId: 'user-field-01',
      email: 'field.vikram@govasset.in',
      phoneNumber: '+919822010006',
      fullName: 'Vikram Singh',
      role: 'FIELD_WORKER',
      departmentId: 'dept-roads',
      jurisdictionId: 'ward-kothrud-28',
    });

    adminToken = await createSessionToken({
      userId: 'user-admin-01',
      email: 'admin@govasset.in',
      phoneNumber: '+919822010001',
      fullName: 'Rajesh Sharma',
      role: 'PLATFORM_ADMIN',
      departmentId: null,
      jurisdictionId: null,
    });
  });

  describe('Public Route Access (No Auth Required)', () => {
    it('allows public access to Citizen Landing Page (/)', async () => {
      const req = new NextRequest('http://localhost:3000/');
      const res = await middleware(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });

    it('allows public access to Defect Report Page (/report)', async () => {
      const req = new NextRequest('http://localhost:3000/report');
      const res = await middleware(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });

    it('allows public access to Status Tracker (/track and /track/GOV-2026-00482)', async () => {
      const req1 = new NextRequest('http://localhost:3000/track');
      const res1 = await middleware(req1);
      expect(res1.status).toBe(200);

      const req2 = new NextRequest('http://localhost:3000/track/GOV-2026-00482');
      const res2 = await middleware(req2);
      expect(res2.status).toBe(200);
    });

    it('allows public access to reverse geocoding API (/api/geocode/reverse)', async () => {
      const req = new NextRequest('http://localhost:3000/api/geocode/reverse?lat=18.5&lng=73.8');
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });
  });

  describe('Unauthenticated Access Redirections', () => {
    it('redirects anonymous visitor from /admin to /login?redirect=/admin', async () => {
      const req = new NextRequest('http://localhost:3000/admin');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/login');
      expect(location).toContain('redirect=%2Fadmin');
    });

    it('redirects anonymous visitor from /ops/triage to /login', async () => {
      const req = new NextRequest('http://localhost:3000/ops/triage');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login');
    });

    it('redirects anonymous visitor from /my-complaints to /login', async () => {
      const req = new NextRequest('http://localhost:3000/my-complaints');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login');
    });
  });

  describe('Role-Based Route Boundaries for Authenticated Users', () => {
    it('redirects Citizen trying to access /ops/triage to /my-complaints', async () => {
      const req = new NextRequest('http://localhost:3000/ops/triage', {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${citizenToken}` },
      });
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/my-complaints');
    });

    it('redirects Field Worker trying to access /ops/triage to /ops/field', async () => {
      const req = new NextRequest('http://localhost:3000/ops/triage', {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${fieldWorkerToken}` },
      });
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/ops/field');
    });

    it('allows Field Worker to access /ops/field', async () => {
      const req = new NextRequest('http://localhost:3000/ops/field', {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${fieldWorkerToken}` },
      });
      const res = await middleware(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });

    it('allows Officer to access /ops/triage', async () => {
      const req = new NextRequest('http://localhost:3000/ops/triage', {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${officerToken}` },
      });
      const res = await middleware(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });

    it('redirects non-admin (Officer) trying to access /admin to their portal', async () => {
      const req = new NextRequest('http://localhost:3000/admin', {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${officerToken}` },
      });
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/ops/triage');
    });

    it('allows Platform Admin to access /admin', async () => {
      const req = new NextRequest('http://localhost:3000/admin', {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${adminToken}` },
      });
      const res = await middleware(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });

    it('redirects already logged-in user visiting /login to their role dashboard', async () => {
      const req = new NextRequest('http://localhost:3000/login', {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${officerToken}` },
      });
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/ops/triage');
    });
  });
});
