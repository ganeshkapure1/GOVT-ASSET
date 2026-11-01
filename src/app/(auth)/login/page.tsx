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

const isDev =
  process.env.NODE_ENV !== 'production' ||
  process.env.NEXT_PUBLIC_ENABLE_DEMO_CREDENTIALS === 'true' ||
  process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const [fillSuccessNotice, setFillSuccessNotice] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleUseCitizenDemo = (phone: string) => {
    setActiveTab('CITIZEN');
    setMobile(phone);
    setOtpStep('INPUT_PHONE');
    setOtpCode('');
    setAuthError(null);
    setFillSuccessNotice('Demo credentials filled successfully.');
    setTimeout(() => setFillSuccessNotice(null), 3500);
  };

  const handleUseOfficialDemo = (email: string, password = 'password123') => {
    setActiveTab('OFFICIAL');
    setOfficialEmail(email);
    setOfficialPassword(password);
    setAuthError(null);
    setFillSuccessNotice('Demo credentials filled successfully.');
    setTimeout(() => setFillSuccessNotice(null), 3500);
  };

  const handleUseWorkerDemo = (identifier: string, password = 'password123') => {
    setActiveTab('WORKER');
    setWorkerIdentifier(identifier);
    setWorkerPassword(password);
    setAuthError(null);
    setFillSuccessNotice('Demo credentials filled successfully.');
    setTimeout(() => setFillSuccessNotice(null), 3500);
  };

  const copyToClipboard = (text: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

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

    // Structured Demo Accounts for College Pilot Evaluation
  const citizenDemoAccounts = [
    {
      id: 'cit_csmc',
      label: 'Demo Citizen (CSMC Ward 01)',
      name: 'Aniket Deshpande',
      phone: '+919822010108',
      roleBadge: 'CSMC Resident',
      description: 'Pre-registered citizen in CSMC Shahaganj ward with active road repair tickets.',
    },
    {
      id: 'cit_pmc',
      label: 'Demo Citizen (Pune PMC)',
      name: 'Aarav Mehta',
      phone: '+919822010008',
      roleBadge: 'PMC Resident',
      description: 'Pre-registered citizen in PMC Ward 28 with streetlight and drainage tickets.',
    },
  ];

  const officialDemoAccounts = [
    {
      id: 'off_csmc',
      label: 'CSMC Ward Triage Officer',
      name: 'Sachin Waghmare',
      email: 'officer.csmc@govasset.in',
      password: 'password123',
      roleBadge: 'Ward Triage Officer',
      jurisdiction: 'CSMC Ward 01 (Shahaganj)',
      description: 'Evaluates civic tickets, assigns priority levels, and dispatches field maintenance crews.',
    },
    {
      id: 'sup_csmc',
      label: 'Civil Works Supervisor',
      name: 'Pooja Gaikwad',
      email: 'supervisor.csmc@govasset.in',
      password: 'password123',
      roleBadge: 'Civil Supervisor',
      jurisdiction: 'CSMC Zone 01 Roads & Infrastructure',
      description: 'Performs quality inspections, reviews work completion proofs, and certifies resolution.',
    },
    {
      id: 'off_pmc',
      label: 'Pune Ward 28 Officer',
      name: 'Sunita Patil',
      email: 'officer.kothrud@govasset.in',
      password: 'password123',
      roleBadge: 'Ward Triage Officer',
      jurisdiction: 'PMC Ward 28 (Kothrud)',
      description: 'Manages incoming municipal complaints within PMC jurisdiction.',
    },
    {
      id: 'admin_platform',
      label: 'Platform Administrator',
      name: 'Rajesh Sharma',
      email: 'admin@govasset.in',
      password: 'password123',
      roleBadge: 'Platform Admin',
      jurisdiction: 'Pan-India Cross-Corporation Oversight',
      description: 'Complete administrative oversight across municipal corporations, SLA matrices, and audit logs.',
    },
  ];

  const workerDemoAccounts = [
    {
      id: 'wrk_csmc_road',
      label: 'Senior Road Crew Lead',
      name: 'Ganesh Shinde',
      identifier: 'field.csmc@govasset.in',
      staffCode: 'CSMC-WRK-01',
      password: 'password123',
      roleBadge: 'Road Crew Lead',
      skills: 'Road Repair, Asphalt Paving, Roller Operation, Cold Mix Patching',
      description: 'Assigned to active road maintenance, pothole repairs, and asphalt leveling work orders.',
    },
    {
      id: 'wrk_csmc_elec',
      label: 'Electrical & Pipelines Crew',
      name: 'Ramesh Kale',
      identifier: 'ramesh12@gmail.com',
      staffCode: 'CSMC-100',
      password: 'password123',
      roleBadge: 'Field Specialist',
      skills: 'Streetlight Repair, Electrical Maintenance, Pipeline Repair',
      description: 'Specialist managing street lighting and water pipeline maintenance orders.',
    },
    {
      id: 'wrk_pmc_road',
      label: 'Pune Road Maintenance Lead',
      name: 'Vikram Singh',
      identifier: 'field.vikram@govasset.in',
      staffCode: 'PMC-FW-001',
      password: 'password123',
      roleBadge: 'Road Crew Lead',
      skills: 'Road Repair, Bitumen Rolling, Heavy Equipment Operation',
      description: 'Field crew lead executing work orders in Pune Municipal Corporation.',
    },
  ];

  const isDemoQuery = searchParams.get('demo') === 'true' || searchParams.get('demo') === '1';
  const showDemoCredentials = isDev || isDemoQuery;

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
              <div className="space-y-1 w-full">
                <span className="font-bold block">Authentication Notice</span>
                <p className="text-[11px] leading-relaxed">{authError}</p>
                {authError.includes('SMS OTP service is currently unconfigured') && (
                  <div className="mt-2 pt-2 border-t border-rose-200 dark:border-rose-900/80 text-[11px] space-y-1 text-slate-700 dark:text-slate-300">
                    <span className="font-semibold block text-slate-900 dark:text-white">To resolve this in Vercel:</span>
                    <ul className="list-disc pl-4 space-y-0.5 text-[10px]">
                      <li>For Live SMS delivery: Configure <code className="font-mono bg-rose-100 dark:bg-rose-900/40 px-1 py-0.5 rounded font-bold">FAST2SMS_API_KEY</code> or <code className="font-mono bg-rose-100 dark:bg-rose-900/40 px-1 py-0.5 rounded font-bold">MSG91_AUTH_KEY</code></li>
                      <li>For Demonstration / Review: Set <code className="font-mono bg-rose-100 dark:bg-rose-900/40 px-1 py-0.5 rounded font-bold">ENABLE_DEMO_OTP=true</code></li>
                    </ul>
                  </div>
                )}
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
                      Sandbox OTP
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

              {isDev && (
                <div className="flex items-center justify-between p-2.5 bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/70 rounded-xl text-xs">
                  <div className="flex items-center gap-1.5 text-blue-900 dark:text-blue-300">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                    <span className="font-bold">Demo Citizen Mobile:</span>
                    <span className="font-mono font-semibold">+919822010108</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyToClipboard('+919822010108', 'citizen_phone')}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      {copiedKey === 'citizen_phone' ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobile('+919822010108');
                        setOtpStep('INPUT_PHONE');
                        setAuthError(null);
                      }}
                      className="text-[11px] font-bold text-[#0B4FC2] dark:text-blue-400 hover:underline"
                    >
                      Fill Number
                    </button>
                  </div>
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
                    <div>
                      <span className="font-bold block">Development Demo Credentials:</span>
                      <span className="font-mono text-[11px] text-blue-700 dark:text-blue-200">
                        officer.csmc@govasset.in / password123
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => copyToClipboard('officer.csmc@govasset.in', 'official_email')}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-1"
                    >
                      {copiedKey === 'official_email' ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      aria-label="Restore demo credentials"
                      onClick={handleRestoreOfficialDemo}
                      className="text-[11px] font-bold text-[#0B4FC2] dark:text-blue-400 hover:underline"
                    >
                      Restore Demo Credentials
                    </button>
                  </div>
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
                    <div>
                      <span className="font-bold block">Development Demo Credentials:</span>
                      <span className="font-mono text-[11px] text-emerald-800 dark:text-emerald-200">
                        field.csmc@govasset.in / password123
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => copyToClipboard('field.csmc@govasset.in', 'worker_email')}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-1"
                    >
                      {copiedKey === 'worker_email' ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      aria-label="Restore demo credentials"
                      onClick={handleRestoreWorkerDemo}
                      className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                    >
                      Restore Demo Credentials
                    </button>
                  </div>
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

          {/* Professional Demo Credentials - Pilot Evaluation Section */}
          {showDemoCredentials ? (
            <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Demo Credentials – Pilot Evaluation
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Select a demo account to automatically fill the login details.
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-mono font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  Pilot Demo
                </span>
              </div>

              {/* Citizen Demo Accounts */}
              {activeTab === 'CITIZEN' && (
                <div className="space-y-2.5">
                  <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                    <UserCheckIcon className="w-3.5 h-3.5 text-[#0B4FC2] dark:text-blue-400" />
                    <span>Demonstration Citizen Accounts:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {citizenDemoAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 hover:border-blue-300 dark:hover:border-blue-700 transition-all flex flex-col justify-between gap-2.5 shadow-2xs"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {acc.label}
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-[#0B4FC2] dark:text-blue-300 font-bold shrink-0">
                              {acc.roleBadge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
                            {acc.name}
                          </p>
                          <div className="mt-1.5 flex items-center justify-between text-xs font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                            <span className="text-slate-800 dark:text-slate-200 font-semibold">{acc.phone}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(acc.phone, acc.id)}
                              className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-sans font-bold"
                            >
                              {copiedKey === acc.id ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                            {acc.description}
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          fullWidth
                          onClick={() => handleUseCitizenDemo(acc.phone)}
                          className="rounded-lg text-xs font-bold py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-950 text-[#0B4FC2] dark:text-blue-300"
                        >
                          Use Demo Account
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Official Demo Accounts */}
              {activeTab === 'OFFICIAL' && (
                <div className="space-y-2.5">
                  <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                    <BuildingIcon className="w-3.5 h-3.5 text-[#0B4FC2] dark:text-blue-400" />
                    <span>Demonstration Government Official Accounts:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {officialDemoAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 hover:border-blue-300 dark:hover:border-blue-700 transition-all flex flex-col justify-between gap-2.5 shadow-2xs"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {acc.label}
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-[#0B4FC2] dark:text-blue-300 font-bold shrink-0">
                              {acc.roleBadge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
                            {acc.name}
                          </p>

                          <div className="mt-1.5 flex items-center justify-between text-xs font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                            <span className="text-slate-800 dark:text-slate-200 truncate pr-1 text-[11px]">{acc.email}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(acc.email, acc.id + '_email')}
                              className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-sans font-bold shrink-0"
                            >
                              {copiedKey === acc.id + '_email' ? 'Copied!' : 'Copy'}
                            </button>
                          </div>

                          <div className="mt-1 flex items-center justify-between text-xs font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                            <span className="text-slate-700 dark:text-slate-300 text-[11px]">
                              {showPasswords[acc.id] ? acc.password : '••••••••••••'}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility(acc.id)}
                                className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-sans font-bold"
                              >
                                {showPasswords[acc.id] ? 'Hide' : 'Show'}
                              </button>
                              <span>·</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(acc.password, acc.id + '_pwd')}
                                className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-sans font-bold"
                              >
                                {copiedKey === acc.id + '_pwd' ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          </div>

                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                            {acc.jurisdiction}
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          fullWidth
                          onClick={() => handleUseOfficialDemo(acc.email, acc.password)}
                          className="rounded-lg text-xs font-bold py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-950 text-[#0B4FC2] dark:text-blue-300"
                        >
                          Use Demo Account
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Worker Demo Accounts */}
              {activeTab === 'WORKER' && (
                <div className="space-y-2.5">
                  <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                    <WrenchIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Demonstration Field Worker Accounts:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {workerDemoAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all flex flex-col justify-between gap-2.5 shadow-2xs"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {acc.label}
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold shrink-0">
                              {acc.staffCode}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
                            {acc.name}
                          </p>

                          <div className="mt-1.5 flex items-center justify-between text-xs font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                            <span className="text-slate-800 dark:text-slate-200 truncate pr-1 text-[11px]">{acc.identifier}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(acc.identifier, acc.id + '_id')}
                              className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-sans font-bold shrink-0"
                            >
                              {copiedKey === acc.id + '_id' ? 'Copied!' : 'Copy'}
                            </button>
                          </div>

                          <div className="mt-1 flex items-center justify-between text-xs font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                            <span className="text-slate-700 dark:text-slate-300 text-[11px]">
                              {showPasswords[acc.id] ? acc.password : '••••••••••••'}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility(acc.id)}
                                className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-sans font-bold"
                              >
                                {showPasswords[acc.id] ? 'Hide' : 'Show'}
                              </button>
                              <span>·</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(acc.password, acc.id + '_pwd')}
                                className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-sans font-bold"
                              >
                                {copiedKey === acc.id + '_pwd' ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          </div>

                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                            Skills: {acc.skills}
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          fullWidth
                          onClick={() => handleUseWorkerDemo(acc.identifier, acc.password)}
                          className="rounded-lg text-xs font-bold py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                        >
                          Use Demo Account
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Roles Quick Switcher */}
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-1.5">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Quick Portal Switch:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleTabChange('CITIZEN')}
                    className={`px-2 py-0.5 rounded font-bold transition-colors ${activeTab === 'CITIZEN' ? 'bg-[#0B4FC2] text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                  >
                    Citizen Demo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabChange('OFFICIAL')}
                    className={`px-2 py-0.5 rounded font-bold transition-colors ${activeTab === 'OFFICIAL' ? 'bg-[#0B4FC2] text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                  >
                    Official Demo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabChange('WORKER')}
                    className={`px-2 py-0.5 rounded font-bold transition-colors ${activeTab === 'WORKER' ? 'bg-emerald-700 text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                  >
                    Worker Demo
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-center">
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Production mode active • Demo credentials disabled. Configure <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[9px]">NEXT_PUBLIC_ENABLE_DEMO_CREDENTIALS=true</code> in Vercel to activate pilot evaluation accounts.
              </p>
            </div>
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
