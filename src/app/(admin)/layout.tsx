'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BuildingIcon,
  ShieldCheckIcon,
  UserCheckIcon,
  FileTextIcon,
  BellIcon,
  MenuIcon,
  CloseIcon,
  SearchIcon,
  SettingsIcon,
} from '@/components/ui/icons';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  };

  // Grouped Navigation matching Reference Image 2 ("MAIN MENU" & "CONFIGURATIONS")
  const mainMenu = [
    { label: 'Dashboard', href: '/admin', icon: BuildingIcon },
    { label: 'Users Directory', href: '/admin/users', icon: UserCheckIcon },
    { label: 'Roles & Permissions', href: '/admin/users', icon: ShieldCheckIcon },
    { label: 'Audit Log', href: '/admin/audit-logs', icon: FileTextIcon },
  ];

  const configMenu = [
    { label: 'SLA Policy Matrix', href: '/admin/sla-matrix', icon: ShieldCheckIcon },
    { label: 'Jurisdictions Hierarchy', href: '/admin/jurisdictions', icon: BuildingIcon },
    { label: 'Notification Delivery', href: '/admin/notifications', icon: BellIcon },
  ];

  return (
    <div className="min-h-screen flex bg-[#F4F7FB] dark:bg-slate-950 text-civic-900 dark:text-slate-100 font-sans">
      {/* Accessibility Skip Link */}
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#4F46E5] focus:text-white focus:rounded-md focus:shadow-elevated"
      >
        Skip to main content
      </a>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden backdrop-blur-xs"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Light Public-Sector Administration Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white/95 dark:bg-[#0F172A] border-r border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-auto shadow-xs backdrop-blur-md ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Platform Administration Navigation"
      >
        {/* Masthead */}
        <div className="h-18 flex items-center justify-between px-6 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#0B4FC2] dark:text-blue-400 border border-blue-200/70 dark:border-blue-900/50 flex items-center justify-center font-bold shadow-2xs">
              <ShieldCheckIcon className="w-5 h-5 text-[#0B4FC2] dark:text-blue-400" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white block leading-tight">
                GovAsset
              </span>
              <span className="text-[10px] font-bold text-[#0B4FC2] dark:text-blue-400 uppercase tracking-widest">
                Platform Admin
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close sidebar"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
          {/* Section 1: MAIN MENU */}
          <div>
            <span className="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2">
              MAIN MENU
            </span>
            <div className="space-y-1">
              {mainMenu.map((item, idx) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={idx}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-blue-50 text-[#0B4FC2] border border-blue-200/80 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800/80 shadow-2xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#0B4FC2] dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Section 2: CONFIGURATIONS */}
          <div>
            <span className="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2">
              CONFIGURATIONS
            </span>
            <div className="space-y-1">
              {configMenu.map((item, idx) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={idx}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-blue-50 text-[#0B4FC2] border border-blue-200/80 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800/80 shadow-2xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#0B4FC2] dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Superadmin User Footer */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/70 flex items-center justify-center text-[#0B4FC2] dark:text-blue-300 shrink-0 font-bold text-xs border border-blue-200 dark:border-blue-800">
              SA
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">Administrator</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">PLATFORM_ADMIN</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium"
          >
            Exit
          </button>
        </div>
      </aside>

      {/* Main Administrative Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar Matching Reference Image 2 */}
        <header className="h-18 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-civic-200 dark:border-slate-800 shadow-xs flex items-center justify-between px-6 z-30 transition-colors">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-civic-700 dark:text-slate-300 hover:text-civic-900 dark:hover:text-white hover:bg-civic-100 dark:hover:bg-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
              aria-label="Open sidebar"
            >
              <MenuIcon className="w-6 h-6" />
            </button>

            {/* Global Search Input Matching Image 2 */}
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-civic-400 dark:text-slate-500">
                <SearchIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Search globally across wards, users, roles, audit records..."
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-civic-50 dark:bg-slate-800 border border-civic-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-civic-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent transition-all placeholder:text-civic-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Right Actions Matching Image 2 */}
          <div className="flex items-center gap-3">
            <ThemeToggle />

            <button
              type="button"
              className="p-2 text-civic-600 dark:text-slate-300 hover:text-civic-900 dark:hover:text-white hover:bg-civic-100 dark:hover:bg-slate-800 rounded-full focus:outline-none focus:ring-2 focus:ring-[#4F46E5] transition-colors"
              aria-label="View notifications"
            >
              <BellIcon className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => alert('Platform Admin Docs: Reference architecture and DPDP Act compliance guides.')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-civic-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-civic-50 dark:hover:bg-slate-700 text-xs font-semibold text-civic-800 dark:text-slate-200 shadow-2xs transition-colors"
            >
              <span>Help &amp; Docs</span>
            </button>
          </div>
        </header>

        {/* Administrative Content Area */}
        <main id="admin-content" className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
