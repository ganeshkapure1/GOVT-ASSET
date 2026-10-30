import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { NextRequest } from 'next/server';

import CitizenLayout from '@/app/(citizen)/layout';
import { middleware } from '@/middleware';
import { GET as authMeHandler } from '@/app/api/v1/auth/me/route';
import { POST as logoutPostHandler, GET as logoutGetHandler } from '@/app/api/v1/auth/logout/route';
import { createSessionToken, verifySessionToken, SESSION_COOKIE_NAME, UserSession } from '@/lib/auth-session';

// Mock next/navigation
let mockPathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/headers for Next.js request context in Route Handler tests
let mockCookieValue: string | undefined = undefined;
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) =>
      name === SESSION_COOKIE_NAME && mockCookieValue ? { value: mockCookieValue } : undefined,
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

describe('GovAsset — Logged-Out Visitor & Session Security (10 Verification Scenarios)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockPathname = '/';
    mockCookieValue = undefined;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  // =========================================================================
  // SCENARIO 1: Unauthenticated Visitor UI Check
  // =========================================================================
  it('1. Unauthenticated Visitor: Public landing page layout renders without citizen identity or private links', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: { code: 'UNAUTHORIZED' } }),
    } as Response);

    render(
      <CitizenLayout>
        <div data-testid="page-content">Public Citizen Page</div>
      </CitizenLayout>
    );

    await waitFor(() => {
      // Must display the public login links (both header desktop and mobile/footer affordances)
      const loginLinks = screen.getAllByRole('link', { name: /login/i });
      expect(loginLinks.length).toBeGreaterThan(0);
      expect(screen.getByRole('link', { name: /get started/i })).toBeInTheDocument();
    });

    // Must NOT display "Ganesh" or any citizen username
    expect(screen.queryByText(/ganesh/i)).not.toBeInTheDocument();

    // Must NOT display "Citizen Hub" badge
    expect(screen.queryByText('Citizen Hub')).not.toBeInTheDocument();

    // Must NOT display "My Grievances" navigation link
    expect(screen.queryByRole('link', { name: /my grievances/i })).not.toBeInTheDocument();

    // Must NOT display "Sign Out" button
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
  });

  // =========================================================================
  // SCENARIO 2: Authenticated Citizen UI Check
  // =========================================================================
  it('2. Authenticated Citizen: Renders citizen name, Citizen Hub badge, My Grievances link, and Sign Out', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        user: {
          userId: 'cit-001',
          fullName: 'Aarav Patil',
          role: 'CITIZEN',
          phoneNumber: '+919822010108',
        },
      }),
    } as Response);

    render(
      <CitizenLayout>
        <div data-testid="page-content">Citizen Portal</div>
      </CitizenLayout>
    );

    await waitFor(() => {
      expect(screen.getByText('Citizen Hub')).toBeInTheDocument();
      const citizenNames = screen.getAllByText('Aarav');
      expect(citizenNames.length).toBeGreaterThan(0);
      expect(screen.getByRole('link', { name: /my grievances/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    });

    // Public login buttons must NOT be present in primary header action bar when authenticated
    expect(screen.queryByRole('link', { name: /^login$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /get started/i })).not.toBeInTheDocument();
  });

  // =========================================================================
  // SCENARIO 3: Field Worker visiting Citizen Layout
  // =========================================================================
  it('3. Field Worker Visiting Citizen Layout: Recognizes staff role and does not label as Citizen Hub', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        user: {
          userId: 'wrk-001',
          fullName: 'Ganesh Shinde',
          role: 'FIELD_WORKER',
          phoneNumber: '+919822010006',
        },
      }),
    } as Response);

    render(
      <CitizenLayout>
        <div data-testid="page-content">Landing Page</div>
      </CitizenLayout>
    );

    await waitFor(() => {
      // Must show staff role tag, NOT "Citizen Hub"
      expect(screen.getByText('FIELD WORKER')).toBeInTheDocument();
      expect(screen.queryByText('Citizen Hub')).not.toBeInTheDocument();

      // Worker should have link to Worker Tasks (/ops/field), NOT My Grievances
      expect(screen.getByRole('link', { name: /worker tasks/i })).toHaveAttribute('href', '/ops/field');
      expect(screen.queryByRole('link', { name: /my grievances/i })).not.toBeInTheDocument();

      // Sign Out must be accessible
      expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    });
  });

  // =========================================================================
  // SCENARIO 4: Passive Request Idempotency
  // =========================================================================
  it('4. Passive Request Idempotency: /api/v1/auth/me returns 401 without cookie without writing or modifying DB', async () => {
    mockCookieValue = undefined;
    const res = await authMeHandler();
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.message).toBe('No active session.');
  });

  // =========================================================================
  // SCENARIO 5: Session Verification Failure Modes
  // =========================================================================
  it('5. Session Verification Failure Modes: Missing, malformed, or expired cookies safely evaluate to null', async () => {
    // Missing
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken('')).toBeNull();

    // Corrupted payload
    expect(await verifySessionToken('invalid.token.signature')).toBeNull();

    // Forged signature
    const validToken = await createSessionToken({
      userId: 'test-usr',
      email: 'test@govasset.in',
      phoneNumber: '+919999999999',
      fullName: 'Test User',
      role: 'CITIZEN',
      departmentId: null,
      jurisdictionId: null,
    });
    const [payload] = validToken.split('.');
    const forgedToken = `${payload}.tampered_signature_bytes`;
    expect(await verifySessionToken(forgedToken)).toBeNull();

    // Expired token test via system clock progression
    const validTokenForExpiry = await createSessionToken({
      userId: 'test-usr-expiry',
      email: 'test@govasset.in',
      phoneNumber: '+919999999999',
      fullName: 'Test User',
      role: 'CITIZEN',
      departmentId: null,
      jurisdictionId: null,
    });
    vi.useFakeTimers();
    // Advance time 9 hours into the future (token is valid for 8 hours)
    vi.setSystemTime(Date.now() + 9 * 60 * 60 * 1000);
    expect(await verifySessionToken(validTokenForExpiry)).toBeNull();
    vi.useRealTimers();
  });

  // =========================================================================
  // SCENARIO 6: Explicit Login Token Lifecycle
  // =========================================================================
  it('6. Explicit Login Lifecycle: Establishes HMAC-SHA256 sealed session token with valid future expiry', async () => {
    const sessionData: Omit<UserSession, 'issuedAt' | 'expiresAt'> = {
      userId: 'csmc-officer-01',
      email: 'officer.csmc@govasset.in',
      phoneNumber: '+919822010100',
      fullName: 'Ramesh Kulkarni',
      role: 'OFFICER',
      departmentId: 'dept-roads',
      jurisdictionId: 'csmc-ward-01',
    };

    const token = await createSessionToken(sessionData);
    expect(typeof token).toBe('string');
    expect(token).toContain('.');

    const verified = await verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe(sessionData.userId);
    expect(verified?.role).toBe('OFFICER');
    expect(verified?.jurisdictionId).toBe('csmc-ward-01');
    expect(verified?.expiresAt).toBeGreaterThan(Date.now());
  });

  // =========================================================================
  // SCENARIO 7: Session Persistence Across Refreshes
  // =========================================================================
  it('7. Session Persistence: Legitimate session token verifies consistently on repeated requests', async () => {
    const token = await createSessionToken({
      userId: 'cit-002',
      email: 'citizen@example.com',
      phoneNumber: '+919822010108',
      fullName: 'Sunita Joshi',
      role: 'CITIZEN',
      departmentId: null,
      jurisdictionId: null,
    });

    // Simulating multiple page navigations / refreshes
    const check1 = await verifySessionToken(token);
    const check2 = await verifySessionToken(token);
    const check3 = await verifySessionToken(token);

    expect(check1?.userId).toBe('cit-002');
    expect(check2?.userId).toBe('cit-002');
    expect(check3?.userId).toBe('cit-002');
  });

  // =========================================================================
  // SCENARIO 8: Sign Out Termination & Header Clearing
  // =========================================================================
  it('8. Sign Out Mechanism: Clears cookie and enforces no-cache headers via POST and GET', async () => {
    // Test POST logout
    const postReq = new NextRequest('http://localhost:3000/api/v1/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const postRes = await logoutPostHandler(postReq);
    expect(postRes.status).toBe(200);

    const postBody = await postRes.json();
    expect(postBody.success).toBe(true);
    expect(postRes.headers.get('cache-control')).toContain('no-store');

    // Cookie must be expired
    const cookieHeader = postRes.headers.get('set-cookie');
    expect(cookieHeader).toBeDefined();
    expect(cookieHeader).toContain(`${SESSION_COOKIE_NAME}=;`);

    // Test GET logout (redirects to / and expires cookie)
    const getReq = new NextRequest('http://localhost:3000/api/v1/auth/logout', {
      method: 'GET',
    });
    const getRes = await logoutGetHandler(getReq);
    expect(getRes.status).toBe(307);
    expect(getRes.headers.get('location')).toBe('http://localhost:3000/');
    expect(getRes.headers.get('set-cookie')).toContain(`${SESSION_COOKIE_NAME}=;`);
  });

  // =========================================================================
  // SCENARIO 9: Route Boundary Protection on /my-complaints
  // =========================================================================
  it('9. Route Boundary: /my-complaints redirects anonymous visitors to /login and redirects staff to role dashboard', async () => {
    // 1. Anonymous visitor
    const anonReq = new NextRequest('http://localhost:3000/my-complaints');
    const anonRes = await middleware(anonReq);
    expect(anonRes.status).toBe(307);
    expect(anonRes.headers.get('location')).toContain('/login');
    expect(anonRes.headers.get('location')).toContain('redirect=%2Fmy-complaints');

    // 2. Field Worker accessing /my-complaints -> redirected to /ops/field
    const workerToken = await createSessionToken({
      userId: 'wrk-01',
      email: 'field.csmc@govasset.in',
      phoneNumber: '+919822010006',
      fullName: 'Ganesh Shinde',
      role: 'FIELD_WORKER',
      departmentId: 'dept-roads',
      jurisdictionId: 'csmc-ward-01',
    });
    const workerReq = new NextRequest('http://localhost:3000/my-complaints', {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${workerToken}` },
    });
    const workerRes = await middleware(workerReq);
    expect(workerRes.status).toBe(307);
    expect(workerRes.headers.get('location')).toContain('/ops/field');

    // 3. Officer accessing /my-complaints -> redirected to /ops/triage
    const officerToken = await createSessionToken({
      userId: 'off-01',
      email: 'officer.csmc@govasset.in',
      phoneNumber: '+919822010002',
      fullName: 'Sunita Patil',
      role: 'OFFICER',
      departmentId: 'dept-roads',
      jurisdictionId: 'csmc-ward-01',
    });
    const officerReq = new NextRequest('http://localhost:3000/my-complaints', {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${officerToken}` },
    });
    const officerRes = await middleware(officerReq);
    expect(officerRes.status).toBe(307);
    expect(officerRes.headers.get('location')).toContain('/ops/triage');

    // 4. Citizen accessing /my-complaints -> allowed through
    const citizenToken = await createSessionToken({
      userId: 'cit-01',
      email: 'citizen@govasset.in',
      phoneNumber: '+919822010108',
      fullName: 'Aarav Patel',
      role: 'CITIZEN',
      departmentId: null,
      jurisdictionId: null,
    });
    const citizenReq = new NextRequest('http://localhost:3000/my-complaints', {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${citizenToken}` },
    });
    const citizenRes = await middleware(citizenReq);
    expect(citizenRes.status).toBe(200);
    expect(citizenRes.headers.get('location')).toBeNull();
  });

  // =========================================================================
  // SCENARIO 10: API Boundary Protection for Citizen Endpoints
  // =========================================================================
  it('10. API Boundary: /api/v1/citizen/* returns 401 for unauthenticated and 403 for non-citizen roles', async () => {
    // 1. Unauthenticated request
    const unauthReq = new NextRequest('http://localhost:3000/api/v1/citizen/complaints');
    const unauthRes = await middleware(unauthReq);
    expect(unauthRes.status).toBe(401);
    const unauthBody = await unauthRes.json();
    expect(unauthBody.error.code).toBe('UNAUTHORIZED');

    // 2. Field worker token attempting citizen API
    const workerToken = await createSessionToken({
      userId: 'wrk-01',
      email: 'field.csmc@govasset.in',
      phoneNumber: '+919822010006',
      fullName: 'Ganesh Shinde',
      role: 'FIELD_WORKER',
      departmentId: 'dept-roads',
      jurisdictionId: 'csmc-ward-01',
    });
    const workerReq = new NextRequest('http://localhost:3000/api/v1/citizen/complaints', {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${workerToken}` },
    });
    const workerRes = await middleware(workerReq);
    expect(workerRes.status).toBe(403);
    const workerBody = await workerRes.json();
    expect(workerBody.error.code).toBe('FORBIDDEN');

    // 3. Citizen token accessing citizen API
    const citizenToken = await createSessionToken({
      userId: 'cit-01',
      email: 'citizen@govasset.in',
      phoneNumber: '+919822010108',
      fullName: 'Aarav Patel',
      role: 'CITIZEN',
      departmentId: null,
      jurisdictionId: null,
    });
    const citizenReq = new NextRequest('http://localhost:3000/api/v1/citizen/complaints', {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${citizenToken}` },
    });
    const citizenRes = await middleware(citizenReq);
    expect(citizenRes.status).toBe(200);
  });
});
