'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ClipboardCheckIcon,
  UserCheckIcon,
  ShieldCheckIcon,
  WrenchIcon,
  FileTextIcon,
  BellIcon,
  MenuIcon,
  CloseIcon,
  BuildingIcon,
  ChevronDownIcon,
  SearchIcon,
} from '@/components/ui/icons';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { OpsContextProvider, useOpsContext } from '@/context/OpsContext';

function GovOpsLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const {
    user,
    corporation,
    locationLabel,
    hasValidJurisdiction,
    setupMessage,
    isLoading,
  } = useOpsContext();

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  };

  const homeHref =
    user?.role === 'FIELD_WORKER'
      ? '/ops/field'
      : user?.role === 'SUPERVISOR'
      ? '/ops/verifications'
      : user?.role === 'PLATFORM_ADMIN'
      ? '/admin'
      : '/ops/triage';

  let navItems: { label: string; href: string; icon: any; badge?: string }[] = [];

  if (user?.role === 'FIELD_WORKER') {
    navItems = [
      { label: 'My Assigned Work', href: '/ops/field', icon: WrenchIcon, badge: 'Tasks' },
    ];
  } else if (user?.role === 'SUPERVISOR') {
    navItems = [
      { label: 'Verifications', href: '/ops/verifications', icon: ShieldCheckIcon, badge: 'Review' },
      { label: 'Complaints Queue', href: '/ops/complaints', icon: FileTextIcon },
      { label: 'Executive Dashboard', href: '/ops/triage', icon: ClipboardCheckIcon },
      { label: 'Manage Workers', href: '/ops/crew', icon: UserCheckIcon },
      { label: 'Live Monitoring', href: '/ops/assigned', icon: ClipboardCheckIcon },
      { label: 'Reports & SLAs', href: '/ops/reports', icon: FileTextIcon },
    ];
  } else if (user?.role === 'PLATFORM_ADMIN') {
    navItems = [
      { label: 'Admin Console', href: '/admin', icon: BuildingIcon },
      { label: 'Complaints Queue', href: '/ops/complaints', icon: FileTextIcon },
      { label: 'Executive Dashboard', href: '/ops/triage', icon: ClipboardCheckIcon },
      { label: 'Manage Workers', href: '/ops/crew', icon: UserCheckIcon },
      { label: 'Verifications', href: '/ops/verifications', icon: ShieldCheckIcon },
      { label: 'Live Monitoring', href: '/ops/assigned', icon: ClipboardCheckIcon },
      { label: 'Reports & SLAs', href: '/ops/reports', icon: FileTextIcon },
      { label: 'Field Mobile View', href: '/ops/field', icon: WrenchIcon },
    ];
  } else {
    // Default: OFFICER / DEPT_ADMIN
    navItems = [
      { label: 'Executive Dashboard', href: '/ops/triage', icon: ClipboardCheckIcon },
      { label: 'Complaints Queue', href: '/ops/complaints', icon: FileTextIcon },
      { label: 'Manage Workers', href: '/ops/crew', icon: UserCheckIcon },
      { label: 'Live Monitoring', href: '/ops/assigned', icon: ClipboardCheckIcon },
      { label: 'Reports & SLAs', href: '/ops/reports', icon: FileTextIcon },
    ];
  }

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0].toUpperCase())
        .join('')
    : 'OP';

  return (
    <div className="min-h-screen flex bg-[#F4F7FB] dark:bg-[#090D16] text-civic-900 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Accessibility Skip Link */}
      <a
        href="#ops-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#0B4FC2] focus:text-white focus:rounded-md focus:shadow-elevated"
      >
        Skip to main content
      </a>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 lg:hidden backdrop-blur-xs"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Light Civic Left Navigation Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white/95 dark:bg-[#0F172A] border-r border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-auto shadow-xs backdrop-blur-md ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Operations Navigation"
      >
        {/* Brand Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60">
          <Link href={homeHref} className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#0B4FC2] dark:text-blue-400 flex items-center justify-center font-bold border border-blue-200/70 dark:border-blue-900/50 shadow-2xs shrink-0">
              <BuildingIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white block leading-tight truncate">
                GovAsset
              </span>
              <span className="text-[10px] font-bold text-[#0B4FC2] dark:text-blue-400 tracking-wider uppercase block truncate">
                {corporation ? corporation.code : 'GIS Operations'}
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg"
            aria-label="Close sidebar"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto" aria-label="Main Ops Navigation">
          {navItems.map((item, idx) => {
            const isActive =
              (item.href === '/ops/triage' && (pathname === '/ops/triage' || pathname === '/ops')) ||
              (item.href !== '/ops/triage' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={idx}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-50 text-[#0B4FC2] border border-blue-200/80 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800/80 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-[#0B4FC2] dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-1.5 py-0.2 text-[10px] font-black uppercase rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Scope Card & Sign Out */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-950/70 flex items-center justify-center font-bold text-xs text-[#0B4FC2] dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {user?.fullName || (isLoading ? 'Loading profile...' : 'Staff Officer')}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {user?.designation ||
                    (corporation?.city
                      ? `${corporation.city} Officer`
                      : user?.role
                      ? `${user.role} Officer`
                      : 'Operations Staff')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium shrink-0"
            >
              Exit
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-18 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between px-6 z-30 transition-colors">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B4FC2]"
              aria-label="Open sidebar"
            >
              <MenuIcon className="w-6 h-6" />
            </button>

            {/* Breadcrumb Title & Corporation Context Badge */}
            <div className="hidden sm:flex items-center gap-2 min-w-0">
              <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Overview
              </span>
              <span
                data-testid="officer-location-badge"
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border truncate ${
                  corporation
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-[#0B4FC2] dark:text-blue-300 border-blue-200/80 dark:border-blue-900/60'
                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                }`}
              >
                {locationLabel}
              </span>
            </div>

            {/* Global Search Bar */}
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                <SearchIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Search complaints, work orders..."
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-full focus:bg-white dark:focus:bg-slate-800/90 focus:outline-none focus:ring-2 focus:ring-[#0B4FC2] dark:focus:ring-blue-400 focus:border-transparent transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Right Action Icons & Location Indicator */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Theme Toggle */}
            <ThemeToggle variant="pill" />

            {/* Dynamic Corporation / City Badge */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <span className={`w-2 h-2 rounded-full ${corporation ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="truncate max-w-[200px]">{locationLabel}</span>
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setAlertsOpen(!alertsOpen)}
                className="relative p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full focus:outline-none focus:ring-2 focus:ring-[#0B4FC2]"
                aria-label="Notifications"
              >
                <BellIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Setup Required Alert if user has no valid jurisdiction */}
        {!hasValidJurisdiction && (
          <div className="bg-amber-50 dark:bg-amber-950/70 border-b border-amber-200 dark:border-amber-800 px-6 py-2.5 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wider text-[10px] px-1.5 py-0.5 bg-amber-200 dark:bg-amber-800 rounded text-amber-900 dark:text-amber-100">
                Action Required
              </span>
              <span>
                {setupMessage ||
                  'No valid jurisdiction or municipal body assigned to your account. Please contact your system administrator.'}
              </span>
            </div>
          </div>
        )}

        {/* Dynamic Content Container */}
        <main id="ops-content" className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function GovOpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OpsContextProvider>
      <GovOpsLayoutInner>{children}</GovOpsLayoutInner>
    </OpsContextProvider>
  );
}
