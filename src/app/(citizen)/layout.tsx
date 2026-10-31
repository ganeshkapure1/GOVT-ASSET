'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  SearchIcon,
  PlusIcon,
  FileTextIcon,
  UserIcon,
  BuildingIcon,
  PhoneIcon,
  ShieldCheckIcon,
} from '@/components/ui/icons';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

export default function CitizenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sessionUser, setSessionUser] = useState<{ fullName: string; role: string } | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/v1/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then(async (data) => {
        if (!isMounted) return;
        // The citizen portal strictly recognizes authenticated CITIZEN accounts only.
        if (data?.success && data?.user && data.user.role === 'CITIZEN') {
          setSessionUser(data.user);
        } else {
          // If a staff/officer session was left over in the browser from previous tests,
          // automatically clear it so fresh visitors to the main citizen portal never see Sachin or any officer pre-signed in!
          if (data?.user && data.user.role !== 'CITIZEN') {
            try {
              if (typeof document !== 'undefined') {
                document.cookie = 'govasset_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;';
              }
              await fetch('/api/v1/auth/logout', { method: 'POST' });
            } catch {}
          }
          setSessionUser(null);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setSessionUser(null);
      })
      .finally(() => {
        if (isMounted) setIsLoadingAuth(false);
      });

    return () => {
      isMounted = false;
    };
  }, [pathname]);

  const isCitizen = Boolean(sessionUser && sessionUser.role === 'CITIZEN');

  const handleSignOut = async () => {
    try {
      if (typeof document !== 'undefined') {
        document.cookie = 'govasset_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;';
      }
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // Ignore network errors
    } finally {
      setSessionUser(null);
      window.location.href = '/';
    }
  };

  const navLinks = [
    { label: 'Home', href: '/', icon: HomeIcon },
    { label: 'Track Status', href: '/track', icon: SearchIcon },
    { label: 'Report a Problem', href: '/report', icon: PlusIcon },
    ...(isCitizen
      ? [{ label: 'My Grievances', href: '/my-complaints', icon: FileTextIcon }]
      : []),
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#090D16] text-civic-900 dark:text-slate-100 font-sans antialiased selection:bg-[#0B4FC2] selection:text-white transition-colors duration-200">
      {/* Civic Tri-color Top Accent Bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-white to-emerald-600 dark:from-amber-600 dark:via-slate-200 dark:to-emerald-700" aria-hidden="true" />

      {/* Accessibility Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#0B4FC2] focus:text-white focus:rounded-md focus:shadow-elevated text-xs font-bold"
      >
        Skip to main content
      </a>

      {/* Official State Civic Masthead Ribbon */}
      <div className="bg-slate-100/90 dark:bg-[#060D1A] text-slate-700 dark:text-slate-300 text-[11px] py-1.5 px-4 sm:px-6 lg:px-8 border-b border-slate-200 dark:border-slate-800/80 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
            <span className="font-semibold tracking-wide text-slate-800 dark:text-slate-200">
              GovAsset • National Civic Infrastructure &amp; Grievance Redressal Platform (Pan-India)
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-1.5">
              <PhoneIcon className="w-3 h-3 text-[#0B4FC2] dark:text-sky-400" />
              <span>
                Toll-Free Helpline: <strong className="text-slate-900 dark:text-white font-mono font-bold">1800-233-4000</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Civic Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shadow-xs transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Identity & Seal */}
            <div className="flex items-center gap-3.5">
              <Link
                href="/"
                className="flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-[#0B4FC2] rounded-xl p-1"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#0B2545] to-[#0B4FC2] dark:from-blue-600 dark:to-indigo-700 flex items-center justify-center text-white shadow-md ring-1 ring-black/5 dark:ring-white/10">
                  <BuildingIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">
                      Gov<span className="text-[#0B4FC2] dark:text-blue-400">Asset</span>
                    </span>
                    {isCitizen && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-[#0B4FC2] border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                        Citizen Hub
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Digital Civic Asset &amp; Grievance Optimization
                  </p>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1.5" aria-label="Main Navigation">
              {navLinks.map((link) => {
                const isActive =
                  link.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-blue-50 text-[#0B4FC2] font-bold shadow-2xs dark:bg-blue-950/70 dark:text-blue-400 dark:border dark:border-blue-900/60'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right Action Utilities */}
            <div className="flex items-center gap-2.5">
              {/* Theme Toggle */}
              <ThemeToggle variant="pill" />

              {/* Prominent Desktop "Report Defect" Action */}
              <Link
                href="/report"
                className="hidden lg:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B4FC2] dark:bg-blue-600 text-white text-sm font-bold hover:bg-blue-800 dark:hover:bg-blue-500 shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-[#0B4FC2] focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              >
                <PlusIcon className="w-4 h-4" />
                <span>Report a Problem</span>
              </Link>

              {/* Login / Auth */}
              {isLoadingAuth ? (
                <div className="w-20 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ) : isCitizen ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80">
                    <UserIcon className="w-3.5 h-3.5 text-[#0B4FC2] dark:text-blue-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      {sessionUser?.fullName.split(' ')[0]}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200/80 dark:border-slate-700/80"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70 rounded-xl transition-colors border border-slate-200/80 dark:border-slate-700/80"
                  >
                    <UserIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span>Login</span>
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B4FC2] dark:bg-blue-600 text-white text-sm font-bold hover:bg-blue-800 dark:hover:bg-blue-500 shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-[#0B4FC2]"
                  >
                    <span>Get Started</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main id="main-content" className="flex-1 pb-24 md:pb-16">
        {children}
      </main>

      {/* Mobile Persistent Floating Bottom App Bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 shadow-2xl flex items-center justify-around h-16 px-2 transition-colors"
        aria-label="Mobile Navigation"
      >
        <Link
          href="/"
          className={`flex flex-col items-center justify-center w-16 h-full text-xs font-semibold ${
            pathname === '/' ? 'text-[#0B4FC2] dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <HomeIcon className="w-5 h-5 mb-0.5" />
          <span>Home</span>
        </Link>

        <Link
          href="/track"
          className={`flex flex-col items-center justify-center w-16 h-full text-xs font-semibold ${
            pathname.startsWith('/track') ? 'text-[#0B4FC2] dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <SearchIcon className="w-5 h-5 mb-0.5" />
          <span>Track</span>
        </Link>

        {/* Emphasized Report Button in Mobile Dock */}
        <Link
          href="/report"
          className="flex flex-col items-center justify-center -mt-6"
          aria-label="Report New Issue"
        >
          <div className="w-13 h-13 rounded-full bg-[#0B4FC2] dark:bg-blue-600 text-white flex items-center justify-center shadow-xl hover:bg-blue-800 dark:hover:bg-blue-500 border-3 border-white dark:border-slate-900 ring-2 ring-blue-100 dark:ring-blue-900/50 transition-transform active:scale-95">
            <PlusIcon className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold text-[#0B4FC2] dark:text-blue-400 mt-0.5">Report</span>
        </Link>

        {isCitizen && (
          <Link
            href="/my-complaints"
            className={`flex flex-col items-center justify-center w-16 h-full text-xs font-semibold ${
              pathname.startsWith('/my-complaints') ? 'text-[#0B4FC2] dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <FileTextIcon className="w-5 h-5 mb-0.5" />
            <span>Grievances</span>
          </Link>
        )}

        <Link
          href={isCitizen ? '/my-complaints' : '/login'}
          className={`flex flex-col items-center justify-center w-16 h-full text-xs font-semibold ${
            pathname === '/login' || pathname.startsWith('/my-complaints')
              ? 'text-[#0B4FC2] dark:text-blue-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <UserIcon className="w-5 h-5 mb-0.5" />
          <span>{isCitizen ? sessionUser?.fullName.split(' ')[0] : 'Login'}</span>
        </Link>
      </nav>

      {/* Comprehensive Civic Municipal Footer */}
      <footer className="bg-slate-50/90 dark:bg-[#050B14] text-slate-600 dark:text-slate-400 pt-14 pb-12 border-t border-slate-200/90 dark:border-slate-900 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-slate-200 dark:border-slate-900">
            {/* Col 1: Identity & Guarantee */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#0B4FC2] dark:bg-blue-600 flex items-center justify-center text-white font-bold shadow-xs">
                  <BuildingIcon className="w-5 h-5" />
                </div>
                <span className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Gov<span className="text-[#0B4FC2] dark:text-blue-400">Asset</span>
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                An open, audited civic technology platform built to track, assign, verify, and resolve public infrastructure defects across municipal jurisdictions with transparent SLAs.
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium shadow-2xs">
                <ShieldCheckIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>DPDP Act 2023 Compliant (PII Masked)</span>
              </div>
            </div>

            {/* Col 2: Reportable Infrastructure */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Civic Asset Categories
              </h3>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <li>
                  <Link href="/report?category=CAT_ROADS" className="hover:text-brand-blue dark:hover:text-blue-300 transition-colors">
                    Damaged Roads &amp; Potholes (PWD)
                  </Link>
                </li>
                <li>
                  <Link href="/report?category=CAT_STREETLIGHT" className="hover:text-brand-blue dark:hover:text-blue-300 transition-colors">
                    Streetlights &amp; High-Mast Lamps
                  </Link>
                </li>
                <li>
                  <Link href="/report?category=CAT_DRAINAGE_WATER" className="hover:text-brand-blue dark:hover:text-blue-300 transition-colors">
                    Water Leakage &amp; Drainage Sewage
                  </Link>
                </li>
                <li>
                  <Link href="/report?category=CAT_SANITATION" className="hover:text-brand-blue dark:hover:text-blue-300 transition-colors">
                    Solid Waste &amp; Public Sanitation
                  </Link>
                </li>
                <li>
                  <Link href="/report?category=CAT_BUILDINGS_PARKS" className="hover:text-brand-blue dark:hover:text-blue-300 transition-colors">
                    Footpaths, Paver Blocks &amp; Parks
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 3: Emergency Civic Helplines */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Emergency Municipal Contacts
              </h3>
              <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
                <li className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
                  <span>National Disaster Helplines</span>
                  <span className="font-mono text-slate-900 dark:text-white font-bold">1077 / 112</span>
                </li>
                <li className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
                  <span>PWD Roads Control Room</span>
                  <span className="font-mono text-slate-900 dark:text-white font-bold">020-25501000</span>
                </li>
                <li className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
                  <span>Water Supply Control</span>
                  <span className="font-mono text-slate-900 dark:text-white font-bold">1916</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>MSEDCL Electricity Emergency</span>
                  <span className="font-mono text-slate-900 dark:text-white font-bold">1912</span>
                </li>
              </ul>
            </div>

            {/* Col 4: Platform Gateways */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Role Gateways
              </h3>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <li>
                  <Link href="/" className="hover:text-brand-blue dark:hover:text-blue-300 transition-colors flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Portal A: Citizen Public Access
                  </Link>
                </li>
                <li>
                  <Link href="/ops/triage" className="hover:text-brand-blue dark:hover:text-blue-300 transition-colors flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-600" />
                    Portal B: Government Operations Hub
                  </Link>
                </li>
                <li>
                  <Link href="/admin" className="hover:text-brand-blue dark:hover:text-blue-300 transition-colors flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                    Portal C: Platform Administration
                  </Link>
                </li>
                <li>
                  <Link href="/ops/field" className="hover:text-brand-blue dark:hover:text-blue-300 transition-colors flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Field Worker Rugged Mobile App
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-brand-blue dark:hover:text-blue-300 transition-colors flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    Unified Official Login
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright & Compliance Bar */}
          <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
            <div>
              <p>&copy; {new Date().getFullYear()} GovAsset Civic Technology Project. All rights reserved.</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Designed for Municipal Corporations &amp; Public Works Departments in accordance with Indian Digital Data Protection (DPDP) Act 2023.
              </p>
            </div>
            <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                WCAG 2.2 Level AA Accessible
              </span>
              <span>•</span>
              <span>PostGIS 17 Spatial Engine</span>
              <span>•</span>
              <span>Zero-Egress Audit Logs</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
