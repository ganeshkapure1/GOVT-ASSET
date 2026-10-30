import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { NextRequest } from 'next/server';

import LoginPage from '@/app/(auth)/login/page';
import CitizenLayout from '@/app/(citizen)/layout';
import { POST as loginPostHandler } from '@/app/api/v1/auth/login/route';
import { POST as logoutPostHandler } from '@/app/api/v1/auth/logout/route';
import { db } from '@/lib/db';
import { PILOT_DEV_PASSWORD, verifyPassword } from '@/lib/auth-crypto';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth-session';

// Mock next/navigation
let mockPathname = '/login';
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('GovAsset — Restore Development Login Prefills for Officials & Workers', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockPathname = '/login';
    mockPush.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
  });

  // =========================================================================
  // SCENARIO 1: Government Official Tab Displays Valid Development Credentials
  // =========================================================================
  it('1. Official Tab: displays valid development official credentials (officer.csmc@govasset.in)', async () => {
    render(<LoginPage />);

    // Click Official Login Tab
    const officialTab = screen.getByRole('button', { name: /official login/i });
    fireEvent.click(officialTab);

    // Development demo label & banner must be present
    expect(screen.getByText(/development demo credentials/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /restore demo credentials/i })).toBeInTheDocument();

    // Inputs must be prefilled with valid dev official credentials
    const emailInput = screen.getByLabelText(/official email address \/ username/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;

    expect(emailInput.value).toBe('officer.csmc@govasset.in');
    expect(passwordInput.value).toBe('password123');
  });

  // =========================================================================
  // SCENARIO 2: Field Worker Tab Displays Valid Development Credentials
  // =========================================================================
  it('2. Worker Tab: displays valid development worker credentials (field.csmc@govasset.in)', async () => {
    render(<LoginPage />);

    // Click Worker Login Tab
    const workerTab = screen.getByRole('button', { name: /worker login/i });
    fireEvent.click(workerTab);

    // Development demo label & banner must be present
    expect(screen.getByText(/development demo credentials/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /restore demo credentials/i })).toBeInTheDocument();

    // Inputs must be prefilled with valid dev worker credentials
    const identifierInput = screen.getByLabelText(/registered email or staff code/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/account password/i) as HTMLInputElement;

    expect(identifierInput.value).toBe('field.csmc@govasset.in');
    expect(passwordInput.value).toBe('password123');
  });

  // =========================================================================
  // SCENARIO 3: Restoring Demo Credentials If User Clears Fields
  // =========================================================================
  it('3. Restore Buttons: restores development demo credentials after user clears fields', async () => {
    render(<LoginPage />);

    // Official Tab: Clear and Restore
    fireEvent.click(screen.getByRole('button', { name: /official login/i }));
    const emailInput = screen.getByLabelText(/official email address \/ username/i) as HTMLInputElement;
    const officialPasswordInput = screen.getByLabelText(/password/i) as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: '' } });
    fireEvent.change(officialPasswordInput, { target: { value: '' } });
    expect(emailInput.value).toBe('');
    expect(officialPasswordInput.value).toBe('');

    const restoreOfficialBtn = screen.getByRole('button', { name: /restore demo credentials/i });
    fireEvent.click(restoreOfficialBtn);

    expect(emailInput.value).toBe('officer.csmc@govasset.in');
    expect(officialPasswordInput.value).toBe('password123');

    // Worker Tab: Clear and Restore
    fireEvent.click(screen.getByRole('button', { name: /worker login/i }));
    const workerIdentifierInput = screen.getByLabelText(/registered email or staff code/i) as HTMLInputElement;
    const workerPasswordInput = screen.getByLabelText(/account password/i) as HTMLInputElement;

    fireEvent.change(workerIdentifierInput, { target: { value: '' } });
    fireEvent.change(workerPasswordInput, { target: { value: '' } });
    expect(workerIdentifierInput.value).toBe('');
    expect(workerPasswordInput.value).toBe('');

    const restoreWorkerBtn = screen.getByRole('button', { name: /restore demo credentials/i });
    fireEvent.click(restoreWorkerBtn);

    expect(workerIdentifierInput.value).toBe('field.csmc@govasset.in');
    expect(workerPasswordInput.value).toBe('password123');
  });

  // =========================================================================
  // SCENARIO 4: Citizen Login Flow Remains Clean & Unchanged
  // =========================================================================
  it('4. Citizen Tab: mobile OTP flow remains prompt-based without password prefill', async () => {
    render(<LoginPage />);

    // Default tab is Citizen Login
    expect(screen.getByText(/citizen login/i)).toBeInTheDocument();

    const mobileInput = screen.getByLabelText(/registered mobile number/i) as HTMLInputElement;
    expect(mobileInput.value).toBe('');
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  // =========================================================================
  // SCENARIO 5: Server-Side Authentication for Official Login
  // =========================================================================
  it('5. Official Sign In: authenticates official with prefilled credentials and returns /ops/triage', async () => {
    vi.spyOn(db.user, 'findFirst').mockResolvedValue({
      id: '66666666-6666-6666-6666-666666660101',
      email: 'officer.csmc@govasset.in',
      phoneNumber: '+919822010101',
      fullName: 'Sachin Waghmare',
      role: 'OFFICER' as const,
      departmentId: 'dept-roads',
      jurisdictionId: 'csmc-ward-01',
      isActive: true,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only',
      staffCode: 'CSMC-OFF-01',
      designation: 'Ward Triage Officer',
      skills: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(db.user, 'update').mockResolvedValue({} as any);

    const req = new NextRequest('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'officer.csmc@govasset.in',
        password: PILOT_DEV_PASSWORD,
        portalType: 'OFFICIAL',
      }),
    });

    const res = await loginPostHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.redirectTo).toBe('/ops/triage');

    // Cookie must be set
    const cookie = res.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie).toBeDefined();

    const session = await verifySessionToken(cookie?.value);
    expect(session?.userId).toBe('66666666-6666-6666-6666-666666660101');
    expect(session?.role).toBe('OFFICER');
  });

  // =========================================================================
  // SCENARIO 6: Server-Side Authentication for Worker Login
  // =========================================================================
  it('6. Worker Sign In: authenticates field worker with prefilled credentials and returns /ops/field', async () => {
    vi.spyOn(db.user, 'findFirst').mockResolvedValue({
      id: '66666666-6666-6666-6666-666666660103',
      email: 'field.csmc@govasset.in',
      phoneNumber: '+919822010103',
      fullName: 'Ganesh Shinde',
      role: 'FIELD_WORKER' as const,
      departmentId: 'dept-roads',
      jurisdictionId: 'csmc-ward-01',
      isActive: true,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only',
      staffCode: 'CSMC-WRK-01',
      designation: 'Senior Asphalt Lead',
      skills: 'Road Repair',
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(db.user, 'update').mockResolvedValue({} as any);

    const req = new NextRequest('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'field.csmc@govasset.in',
        staffCode: 'field.csmc@govasset.in',
        password: PILOT_DEV_PASSWORD,
        portalType: 'WORKER',
      }),
    });

    const res = await loginPostHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.redirectTo).toBe('/ops/field');

    // Cookie must be set
    const cookie = res.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie).toBeDefined();

    const session = await verifySessionToken(cookie?.value);
    expect(session?.userId).toBe('66666666-6666-6666-6666-666666660103');
    expect(session?.role).toBe('FIELD_WORKER');
  });

  // =========================================================================
  // SCENARIO 7: Staff Code Worker Login (CSMC-WRK-01)
  // =========================================================================
  it('7. Staff Code Sign In: worker can authenticate using staff code "CSMC-WRK-01"', async () => {
    vi.spyOn(db.user, 'findFirst').mockResolvedValue({
      id: '66666666-6666-6666-6666-666666660103',
      email: 'field.csmc@govasset.in',
      phoneNumber: '+919822010103',
      fullName: 'Ganesh Shinde',
      role: 'FIELD_WORKER' as const,
      departmentId: 'dept-roads',
      jurisdictionId: 'csmc-ward-01',
      isActive: true,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only',
      staffCode: 'CSMC-WRK-01',
      designation: 'Senior Asphalt Lead',
      skills: 'Road Repair',
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(db.user, 'update').mockResolvedValue({} as any);

    const req = new NextRequest('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staffCode: 'CSMC-WRK-01',
        password: PILOT_DEV_PASSWORD,
        portalType: 'WORKER',
      }),
    });

    const res = await loginPostHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.redirectTo).toBe('/ops/field');
  });

  // =========================================================================
  // SCENARIO 8: Invalid Passwords are Strictly Rejected
  // =========================================================================
  it('8. Password Security: rejects incorrect password with 401 Unauthorized', async () => {
    vi.spyOn(db.user, 'findFirst').mockResolvedValue({
      id: 'user-01',
      email: 'officer.csmc@govasset.in',
      phoneNumber: '+919822010101',
      fullName: 'Sachin Waghmare',
      role: 'OFFICER' as const,
      departmentId: null,
      jurisdictionId: null,
      isActive: true,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only',
      staffCode: null,
      designation: null,
      skills: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = new NextRequest('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'officer.csmc@govasset.in',
        password: 'wrong_password_attempt',
        portalType: 'OFFICIAL',
      }),
    });

    const res = await loginPostHandler(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.message).toBe('Invalid email or password.');
  });

  // =========================================================================
  // SCENARIO 9: Portal Separation & Role Mismatch Prevention
  // =========================================================================
  it('9. Role Mismatch: rejects Field Worker credentials on Official portal with 403 Forbidden', async () => {
    vi.spyOn(db.user, 'findFirst').mockResolvedValue({
      id: 'wrk-01',
      email: 'field.csmc@govasset.in',
      phoneNumber: '+919822010103',
      fullName: 'Ganesh Shinde',
      role: 'FIELD_WORKER' as const,
      departmentId: null,
      jurisdictionId: null,
      isActive: true,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only',
      staffCode: 'CSMC-WRK-01',
      designation: null,
      skills: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = new NextRequest('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'field.csmc@govasset.in',
        password: PILOT_DEV_PASSWORD,
        portalType: 'OFFICIAL', // Cross-portal attempt
      }),
    });

    const res = await loginPostHandler(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('ROLE_MISMATCH');
  });

  // =========================================================================
  // SCENARIO 10: Fresh Visitor & Sign Out Isolation Preserved
  // =========================================================================
  it('10. Visitor Security: fresh visitor opening landing page is logged out; logout clears session', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: { code: 'UNAUTHORIZED' } }),
    } as Response);

    render(
      <CitizenLayout>
        <div>Landing Page</div>
      </CitizenLayout>
    );

    await waitFor(() => {
      // Fresh visitor sees Login / Get Started
      expect(screen.getAllByRole('link', { name: /login/i }).length).toBeGreaterThan(0);
      expect(screen.getByRole('link', { name: /get started/i })).toBeInTheDocument();
    });

    // Fresh visitor does not see citizen or worker identity
    expect(screen.queryByText(/ganesh/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Citizen Hub')).not.toBeInTheDocument();

    // Sign out clears cookie and returns 200
    const logoutReq = new NextRequest('http://localhost:3000/api/v1/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const logoutRes = await logoutPostHandler(logoutReq);
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.headers.get('set-cookie')).toContain(`${SESSION_COOKIE_NAME}=;`);
  });
});
