'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  BuildingIcon,
  ShieldCheckIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  WrenchIcon,
  UserCheckIcon,
} from '@/components/ui/icons';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

type LoginPortal = 'CITIZEN' | 'OFFICIAL' | 'WORKER';

const isDev = process.env.NODE_ENV !== 'production';

// Verified development demo credentials
const DEV_OFFICIAL_EMAIL = 'officer.csmc@govasset.in';
const DEV_OFFICIAL_PASSWORD = 'password123';

const DEV_WORKER_IDENTIFIER = 'field.csmc@govasset.in';
const DEV_WORKER_PASSWORD = 'password123';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect');

  // Exactly three primary options: Citizen, Government Official, and Worker
  const [activeTab, setActiveTab] = useState<LoginPortal>('CITIZEN');

  // Official Login Form (prefilled in development only)
  const [officialEmail, setOfficialEmail] = useState(isDev ? DEV_OFFICIAL_EMAIL : '');
  const [officialPassword, setOfficialPassword] = useState(isDev ? DEV_OFFICIAL_PASSWORD : '');

  // Worker Login Form (prefilled in development only)
  const [workerIdentifier, setWorkerIdentifier] = useState(isDev ? DEV_WORKER_IDENTIFIER : '');
  const [workerPassword, setWorkerPassword] = useState(isDev ? DEV_WORKER_PASSWORD : '');

  // Citizen Login Form (stays clean and prompt-based for mobile verification)
  const [mobile, setMobile] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpStep, setOtpStep] = useState<'INPUT_PHONE' | 'INPUT_CODE'>('INPUT_PHONE');
  const [mockNotice, setMockNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Tab change handler ensuring correct development credentials remain ready
  const handleTabChange = (portal: LoginPortal) => {
    setActiveTab(portal);
    setAuthError(null);
    if (isDev) {
      if (portal === 'OFFICIAL' && (!officialEmail || !officialPassword)) {
        setOfficialEmail(DEV_OFFICIAL_EMAIL);
        setOfficialPassword(DEV_OFFICIAL_PASSWORD);
      } else if (portal === 'WORKER' && (!workerIdentifier || !workerPassword)) {
        setWorkerIdentifier(DEV_WORKER_IDENTIFIER);
        setWorkerPassword(DEV_WORKER_PASSWORD);
      }
    }
  };

  const handleRestoreOfficialDemo = () => {
    setOfficialEmail(DEV_OFFICIAL_EMAIL);
    setOfficialPassword(DEV_OFFICIAL_PASSWORD);
    setAuthError(null);
  };

  const handleRestoreWorkerDemo = () => {
    setWorkerIdentifier(DEV_WORKER_IDENTIFIER);
    setWorkerPassword(DEV_WORKER_PASSWORD);
    setAuthError(null);
  };

  // Timer for OTP resend cooldown
  React.useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // A. Citizen Phone OTP Handlers
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/v1/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: mobile,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setAuthError(data?.error?.message || 'Failed to dispatch verification code.');
        setIsLoading(false);
        return;
      }

      setOtpStep('INPUT_CODE');
      setCooldown(60);
      setMockNotice(data.mockNotice || null);
      setIsLoading(false);
    } catch {
      setAuthError('Authentication service is currently unreachable. Please check your network.');
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setAuthError('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/v1/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: mobile,
          otp: otpCode.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setAuthError(data?.error?.message || 'Verification code failed. Please check and retry.');
        setIsLoading(false);
        return;
      }

      const destination = redirectTarget || data?.data?.redirectUrl || '/my-complaints';
      window.location.href = destination;
    } catch {
      setAuthError('Authentication service is currently unreachable. Please check your network.');
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setIsLoading(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/v1/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: mobile,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setAuthError(data?.error?.message || 'Failed to resend code.');
      } else {
        setCooldown(60);
        setMockNotice(data.mockNotice || null);
      }
    } catch {
      setAuthError('Network error while resending verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  // B. Government Official Password Handler
  const handleOfficialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: officialEmail,
          password: officialPassword,
          portalType: 'OFFICIAL',
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setAuthError(data?.error?.message || 'Invalid official email or password.');
        setIsLoading(false);
        return;
      }

      const destination = redirectTarget || data.redirectTo || '/ops/triage';
      window.location.href = destination;
    } catch {
      setAuthError('Authentication service is currently unreachable. Please check your network.');
      setIsLoading(false);
    }
  };

  // C. Field Worker Password Handler
  const handleWorkerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: workerIdentifier,
          staffCode: workerIdentifier,
          password: workerPassword,
          portalType: 'WORKER',
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setAuthError(data?.error?.message || 'Invalid worker email/staff code or password.');
        setIsLoading(false);
        return;
      }

      const destination = redirectTarget || data.redirectTo || '/ops/field';
      window.location.href = destination;
    } catch {
      setAuthError('Authentication service is currently unreachable. Please check your network.');
      setIsLoading(false);
    }
  };

  // Development Quick Presets (Only used inside development toggle)
  const devAccounts = [
    { label: 'Citizen (CSMC)', portal: 'CITIZEN' as const, phone: '+919822010108' },
    { label: 'Citizen (PMC)', portal: 'CITIZEN' as const, phone: '+919822010008' },
    { label: 'CSMC Officer (Sachin)', portal: 'OFFICIAL' as const, email: 'officer.csmc@govasset.in' },
    { label: 'Pune Officer (Sunita)', portal: 'OFFICIAL' as const, email: 'officer.kothrud@govasset.in' },
    { label: 'Ward 12 Officer (Amit)', portal: 'OFFICIAL' as const, email: 'officer.shivaji@govasset.in' },
    { label: 'CSMC Supervisor', portal: 'OFFICIAL' as const, email: 'supervisor.csmc@govasset.in' },
    { label: 'Platform Admin', portal: 'OFFICIAL' as const, email: 'admin@govasset.in' },
    { label: 'Worker: Ganesh (Road Lead)', portal: 'WORKER' as const, identifier: 'field.csmc@govasset.in' },
    { label: 'Worker: Ramesh Kale (Pipelines)', portal: 'WORKER' as const, identifier: 'ramesh12@gmail.com' },
  ];

  const handleDevAutofill = (acc: typeof devAccounts[0]) => {
    setActiveTab(acc.portal);
    setAuthError(null);
    if (acc.portal === 'CITIZEN') {
      setMobile(acc.phone || '+919822010108');
      setOtpStep('INPUT_PHONE');
      setOtpCode('');
      setMockNotice(null);
    } else if (acc.portal === 'OFFICIAL') {
      setOfficialEmail(acc.email || 'officer.csmc@govasset.in');
      setOfficialPassword('password123');
    } else if (acc.portal === 'WORKER') {
      setWorkerIdentifier(acc.identifier || 'field.csmc@govasset.in');
      setWorkerPassword('password123');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans transition-colors relative">
      {/* Top Floating Theme Toggle */}
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-3 p-1 rounded-xl group">
          <div className="w-11 h-11 rounded-xl bg-[#0B4FC2] dark:bg-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-2xs group-hover:scale-105 transition-transform">
            <BuildingIcon className="w-6 h-6 text-white" />
          </div>
          <span className="font-black text-2xl tracking-tight text-slate-900 dark:text-white">
            GovAsset
          </span>
        </Link>
        <h1 className="mt-3 text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
          Civic Governance &amp; Workforce Portal
        </h1>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Select your authorized access portal to continue
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white/95 dark:bg-slate-900 py-8 px-6 sm:px-10 shadow-xs border border-slate-200/90 dark:border-slate-800 rounded-2xl space-y-6">
          {/* Exactly Three Primary Options */}
          <div className="grid grid-cols-3 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold gap-1">
            <button
              type="button"
              onClick={() => handleTabChange('CITIZEN')}
              className={`py-2 px-1 rounded-lg text-center transition-all flex flex-col items-center gap-1 ${
                activeTab === 'CITIZEN'
                  ? 'bg-white dark:bg-slate-900 text-[#0B4FC2] dark:text-blue-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UserCheckIcon className="w-4 h-4" />
              <span>Citizen Login</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('OFFICIAL')}
              className={`py-2 px-1 rounded-lg text-center transition-all flex flex-col items-center gap-1 ${
                activeTab === 'OFFICIAL'
                  ? 'bg-white dark:bg-slate-900 text-[#0B4FC2] dark:text-blue-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BuildingIcon className="w-4 h-4" />
              <span>Official Login</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('WORKER')}
              className={`py-2 px-1 rounded-lg text-center transition-all flex flex-col items-center gap-1 ${
                activeTab === 'WORKER'
                  ? 'bg-white dark:bg-slate-900 text-[#0B4FC2] dark:text-blue-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <WrenchIcon className="w-4 h-4" />
              <span>Worker Login</span>
            </button>
          </div>

          {/* Error Alert Banner */}
          {authError && (
            <div
              role="alert"
              className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5 shadow-2xs"
            >
              <AlertTriangleIcon className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold block">Authentication Failed</span>
                <p className="text-[11px] leading-relaxed">{authError}</p>
              </div>
            </div>
          )}

          {/* OPTION A: Citizen OTP Login */}
          {activeTab === 'CITIZEN' && (
            <div className="space-y-4">
              {mockNotice && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold">{mockNotice}</span>
                    <span className="text-[10px] text-amber-700 dark:text-amber-300 uppercase tracking-wide">
                      Dev Mock OTP
                    </span>
                  </div>
                  {mockNotice.match(/\d{6}/) && (
                    <button
                      type="button"
                      onClick={() => {
                        const match = mockNotice.match(/\d{6}/);
                        if (match) setOtpCode(match[0]);
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold bg-amber-200 hover:bg-amber-300 dark:bg-amber-800 dark:hover:bg-amber-700 text-amber-950 dark:text-amber-100 rounded-lg transition-colors shrink-0"
                    >
                      Use Code
                    </button>
                  )}
                </div>
              )}

              {otpStep === 'INPUT_PHONE' ? (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div className="p-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
                    <span className="font-bold text-[#0B4FC2] dark:text-blue-300 block">
                      Citizen Mobile Authentication
                    </span>
                    <p>
                      Enter your 10-digit mobile number to access your grievances and track progress. DPDP Act 2023 protected.
                    </p>
                  </div>

                  <Input
                    label="Registered Mobile Number"
                    type="tel"
                    required
                    placeholder="+919822010108"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    helperText="10-digit Indian mobile number (+91 format supported)."
                  />

                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      fullWidth
                      isLoading={isLoading}
                      className="rounded-xl font-bold py-3 shadow-xs bg-[#0B4FC2] hover:bg-blue-800 text-white"
                    >
                      Send Verification Code (OTP)
                    </Button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 pb-1">
                    <span>Code sent to <strong className="text-slate-900 dark:text-white font-mono">{mobile}</strong></span>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpStep('INPUT_PHONE');
                        setOtpCode('');
                        setAuthError(null);
                      }}
                      className="text-[#0B4FC2] dark:text-blue-400 font-semibold hover:underline"
                    >
                      Change
                    </button>
                  </div>

                  <Input
                    label="6-Digit Verification Code"
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    helperText="Single-use OTP code valid for 10 minutes."
                  />

                  <div className="pt-2 space-y-2">
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      fullWidth
                      isLoading={isLoading}
                      className="rounded-xl font-bold py-3 shadow-xs bg-[#0B4FC2] hover:bg-blue-800 text-white"
                    >
                      Verify &amp; Sign In
                    </Button>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1 pt-1">
                      <span>Didn&apos;t receive code?</span>
                      {cooldown > 0 ? (
                        <span className="font-mono text-slate-400 dark:text-slate-500">Resend in {cooldown}s</span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResend}
                          disabled={isLoading}
                          className="text-[#0B4FC2] dark:text-blue-400 font-bold hover:underline"
                        >
                          Resend OTP
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              )}

              <div className="pt-2 text-center text-xs text-slate-500">
                <Link href="/report" className="text-[#0B4FC2] dark:text-blue-400 hover:underline font-semibold">
                  Report a new civic issue without signing in →
                </Link>
              </div>
            </div>
          )}

          {/* OPTION B: Government Official Login */}
          {activeTab === 'OFFICIAL' && (
            <form onSubmit={handleOfficialSubmit} className="space-y-4">
              <div className="p-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
                <span className="font-bold text-[#0B4FC2] dark:text-blue-300 block">
                  Government Operations Console
                </span>
                <p>
                  For Ward Triage Officers, Supervisors, and Municipal Administrators. Access complaint queues, workforce governance, and reports.
                </p>
              </div>

              {isDev && (
                <div className="flex items-center justify-between p-2.5 bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/70 rounded-xl text-xs">
                  <div className="flex items-center gap-1.5 text-blue-900 dark:text-blue-300">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                    <span className="font-bold">Development demo credentials</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRestoreOfficialDemo}
                    className="text-[11px] font-bold text-[#0B4FC2] dark:text-blue-400 hover:underline"
                  >
                    Restore demo credentials
                  </button>
                </div>
              )}

              <Input
                label="Official Email Address / Username"
                type="text"
                required
                value={officialEmail}
                onChange={(e) => setOfficialEmail(e.target.value)}
                placeholder="officer.csmc@govasset.in"
                helperText={isDev ? "Development demo: officer.csmc@govasset.in" : undefined}
              />

              <Input
                label="Password"
                type="password"
                required
                value={officialPassword}
                onChange={(e) => setOfficialPassword(e.target.value)}
                placeholder="••••••••••••"
                helperText={isDev ? "Development demo password: password123" : undefined}
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  fullWidth
                  isLoading={isLoading}
                  className="rounded-xl font-bold py-3 shadow-xs bg-[#0B4FC2] hover:bg-blue-800 text-white"
                >
                  Sign In to Government Dashboard
                </Button>
              </div>
            </form>
          )}

          {/* OPTION C: Dedicated Worker Login */}
          {activeTab === 'WORKER' && (
            <form onSubmit={handleWorkerSubmit} className="space-y-4">
              <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
                <span className="font-bold text-emerald-800 dark:text-emerald-300 block">
                  Field Maintenance Personnel Portal
                </span>
                <p>
                  Individual access for authorized field crew leads and specialists. View assigned tasks, submit repair proofs, and manage work orders.
                </p>
              </div>

              {isDev && (
                <div className="flex items-center justify-between p-2.5 bg-emerald-50/80 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/70 rounded-xl text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-900 dark:text-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                    <span className="font-bold">Development demo credentials</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRestoreWorkerDemo}
                    className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    Restore demo credentials
                  </button>
                </div>
              )}

              <Input
                label="Registered Email or Staff Code"
                type="text"
                required
                value={workerIdentifier}
                onChange={(e) => setWorkerIdentifier(e.target.value)}
                placeholder="ramesh12@gmail.com, field.csmc@govasset.in, or CSMC-100"
                helperText={isDev ? "Development demo: ramesh12@gmail.com, field.csmc@govasset.in, or CSMC-100" : "Enter your official crew email or assigned staff code."}
              />

              <Input
                label="Account Password"
                type="password"
                required
                value={workerPassword}
                onChange={(e) => setWorkerPassword(e.target.value)}
                placeholder="••••••••••••"
                helperText={isDev ? "Development demo password: password123" : undefined}
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  fullWidth
                  isLoading={isLoading}
                  className="rounded-xl font-bold py-3 shadow-xs bg-emerald-700 hover:bg-emerald-800 text-white"
                >
                  Sign In to Worker Dashboard
                </Button>
              </div>
            </form>
          )}

          {/* Trust Indicators */}
          <div className="pt-2 flex items-center justify-center gap-4 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Stateless Sealed Session
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <CheckCircleIcon className="w-3.5 h-3.5 text-[#0B4FC2] dark:text-blue-400" />
              HttpOnly Secure Cookie
            </span>
          </div>

          {/* Explicit Development-Only Mechanism (Hidden from Production) */}
          {process.env.NODE_ENV !== 'production' && (
            <details className="pt-4 border-t border-slate-200 dark:border-slate-800 group text-xs text-slate-500">
              <summary className="cursor-pointer text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 list-none flex items-center justify-center gap-1.5 select-none">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Developer Sandbox Credentials (Development Only)</span>
              </summary>
              <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <p className="text-[10px] text-slate-500 text-center">
                  Click any role below to autofill valid test credentials in development:
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {devAccounts.map((acc) => (
                    <button
                      key={acc.label}
                      type="button"
                      onClick={() => handleDevAutofill(acc)}
                      className="px-2 py-1 text-[10px] font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-[#0B4FC2] dark:hover:text-blue-300 transition-colors"
                    >
                      {acc.label}
                    </button>
                  ))}
                </div>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs font-mono text-slate-500">Loading sign in...</div>}>
      <LoginContent />
    </Suspense>
  );
}
