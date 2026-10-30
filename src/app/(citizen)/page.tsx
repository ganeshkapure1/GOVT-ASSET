'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { CivicHeroGraphic } from '@/components/shared/CivicHeroGraphic';
import {
  SearchIcon,
  PlusIcon,
  MapPinIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  ClockIcon,
  LightbulbIcon,
  DropletIcon,
  TrashIcon,
  ArrowRightIcon,
  CameraIcon,
  ShieldAlertIcon,
  ActivityIcon,
} from '@/components/ui/icons';

export default function CitizenLandingPage() {
  const router = useRouter();
  const [trackRef, setTrackRef] = useState('');

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackRef.trim()) {
      router.push(`/track?ref=${encodeURIComponent(trackRef.trim().toUpperCase())}`);
    } else {
      router.push('/track');
    }
  };

  const categories = [
    {
      id: 'CAT_ROADS',
      label: 'Damaged Roads & Potholes',
      dept: 'Public Works Dept (PWD)',
      sla: '48h SLA',
      prio: 'P2',
      icon: MapPinIcon,
      color: 'text-blue-700 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/50',
      border: 'hover:border-blue-500 dark:hover:border-blue-500',
      description: 'Crater potholes, caved-in asphalt, damaged dividers, sunken utility cuts.',
    },
    {
      id: 'CAT_STREETLIGHT',
      label: 'Streetlights & Electrical',
      dept: 'Electrical Department',
      sla: '24h SLA',
      prio: 'P1',
      icon: LightbulbIcon,
      color: 'text-amber-700 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/50',
      border: 'hover:border-amber-500 dark:hover:border-amber-500',
      description: 'Non-functional streetlights, dark zones, leaning poles, exposed live cables.',
    },
    {
      id: 'CAT_DRAINAGE_WATER',
      label: 'Water Leakage & Sewage',
      dept: 'Water & Sewerage Board',
      sla: '24h SLA',
      prio: 'P1',
      icon: DropletIcon,
      color: 'text-cyan-700 dark:text-cyan-400',
      bg: 'bg-cyan-50 dark:bg-cyan-950/50',
      border: 'hover:border-cyan-500 dark:hover:border-cyan-500',
      description: 'Main pipeline leaks, overflowing sewage manholes, low pressure, dirty water.',
    },
    {
      id: 'CAT_SANITATION',
      label: 'Solid Waste & Sanitation',
      dept: 'Solid Waste Management',
      sla: '12h SLA',
      prio: 'P2',
      icon: TrashIcon,
      color: 'text-emerald-700 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/50',
      border: 'hover:border-emerald-500 dark:hover:border-emerald-500',
      description: 'Uncleaned garbage bins, illegal roadside dumping, open debris, sanitation bio-hazards.',
    },
    {
      id: 'CAT_BUILDINGS_PARKS',
      label: 'Footpaths & Public Parks',
      dept: 'Horticulture & Civil Works',
      sla: '72h SLA',
      prio: 'P3',
      icon: ClockIcon,
      color: 'text-purple-700 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-950/50',
      border: 'hover:border-purple-500 dark:hover:border-purple-500',
      description: 'Broken paver blocks, damaged park benches, fallen tree branches, damaged railings.',
    },
    {
      id: 'CAT_DRAIN_COVERS',
      label: 'Missing Drain Grates & Safety',
      dept: 'Stormwater Drainage',
      sla: '12h SLA',
      prio: 'P1',
      icon: ShieldAlertIcon,
      color: 'text-rose-700 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/50',
      border: 'hover:border-rose-500 dark:hover:border-rose-500',
      description: 'Missing stormwater storm grates, dangerous open trenches, hazardous road obstructions.',
    },
  ];

  const recentResolutions = [
    {
      ref: 'GOV-2026-00482',
      title: 'Deep crater pothole opposite Metro Station Gate 2',
      ward: 'Shivaji Nagar Sector',
      category: 'Damaged Roads',
      status: 'IN_PROGRESS' as const,
      time: '18m ago',
      slaRemaining: '11h left',
    },
    {
      ref: 'GOV-2026-00483',
      title: 'Dark streetlight junction outside City Dispensary',
      ward: 'Kothrud Central',
      category: 'Streetlights',
      status: 'VERIFIED_RESOLVED' as const,
      time: '1h ago',
      slaRemaining: 'Resolved in 14h',
    },
    {
      ref: 'GOV-2026-00485',
      title: 'Sewage manhole overflow near Community Hall',
      ward: 'Hadapsar Bypass',
      category: 'Water & Sewage',
      status: 'TRIAGED' as const,
      time: '2h ago',
      slaRemaining: '22h left',
    },
  ];

  return (
    <div className="space-y-16">
      {/* =========================================================================
          HERO SECTION: Civic Identity, Value Proposition & Two Prominent Action Cards
          ========================================================================= */}
      <section className="relative overflow-hidden bg-gradient-to-b from-sky-50/70 via-slate-50/40 to-white dark:from-[#050C1A] dark:via-[#09152E] dark:to-[#090D16] text-slate-900 dark:text-white pt-10 pb-16 px-4 sm:px-6 lg:px-8 -mx-4 sm:-mx-6 lg:-mx-8 border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div className="max-w-7xl mx-auto relative z-10">
          {/* Top Badge & System Status */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[#0B4FC2] dark:text-blue-300 text-xs font-semibold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
              Live Civic Infrastructure Tracking • Chhatrapati Sambhajinagar Municipal Corporation
            </div>
            <div className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>DPDP Act 2023 Compliant (PII Masked)</span>
            </div>
          </div>

          {/* Main Hero Header & Graphic Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center mb-10">
            <div className="lg:col-span-7 space-y-5">
              <h1 className="text-3xl sm:text-5xl lg:text-[42px] font-black tracking-tight leading-[1.18] text-slate-900 dark:text-white">
                Fixing Public Infrastructure,{' '}
                <span className="text-[#0B4FC2] dark:text-sky-300">
                  One Geotagged Report
                </span>{' '}
                at a Time.
              </h1>
              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed font-normal">
                Directly report damaged roads, dark streetlights, burst pipelines, and garbage dumps to municipal field engineers. Backed by timestamped before/after photographic proof and guaranteed turnaround SLAs.
              </p>

              {/* Highlights List */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="flex items-center gap-2.5 bg-white/90 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700 rounded-xl px-3.5 py-2.5 shadow-2xs">
                  <CameraIcon className="w-4 h-4 text-[#0B4FC2] dark:text-sky-300 shrink-0" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">GPS &amp; Photo Proof</span>
                </div>
                <div className="flex items-center gap-2.5 bg-white/90 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700 rounded-xl px-3.5 py-2.5 shadow-2xs">
                  <ClockIcon className="w-4 h-4 text-amber-600 dark:text-amber-300 shrink-0" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Enforced Turnaround SLAs</span>
                </div>
                <div className="flex items-center gap-2.5 bg-white/90 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700 rounded-xl px-3.5 py-2.5 shadow-2xs">
                  <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-300 shrink-0" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">72h Citizen Dispute Gate</span>
                </div>
              </div>
            </div>

            {/* Right Hero Graphic: Civic Vector Illustration */}
            <div className="lg:col-span-5 hidden lg:block">
              <CivicHeroGraphic className="w-full max-w-lg mx-auto" />
            </div>
          </div>

          {/* =========================================================================
              THE TWO PROMINENT & VISUALLY DISTINCT ACTION CARDS
              Card 1: Report a Problem (Action Primary)
              Card 2: Track Existing Status (Search Primary)
              ========================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
            {/* ACTION CARD 1: REPORT A PROBLEM (Clean Light Government Card) */}
            <div className="md:col-span-6 bg-white/95 dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl p-6 sm:p-8 shadow-xs border-2 border-blue-500/30 dark:border-blue-500/40 flex flex-col justify-between relative overflow-hidden transition-all">
              <div className="space-y-4 relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[#0B4FC2] dark:text-blue-300 text-xs font-bold uppercase tracking-wider">
                  <PlusIcon className="w-3.5 h-3.5" />
                  Submit New Grievance
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Encountered a Civic Defect?
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Take a photo from your phone. Our system automatically attaches GPS coordinates and routes to the responsible municipal engineer.
                </p>

                <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 pt-1">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Average 45 seconds to submit • No password required</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Automatic SMS tracking updates to your mobile</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 relative z-10">
                <Link href="/report" className="block w-full">
                  <Button
                    variant="primary"
                    size="lg"
                    leftIcon={<PlusIcon className="w-5 h-5 text-white" />}
                    className="w-full bg-[#0B4FC2] hover:bg-blue-800 text-white font-extrabold text-base py-3.5 rounded-xl shadow-xs transition-all"
                  >
                    Report a Civic Problem Now
                  </Button>
                </Link>
              </div>
            </div>

            {/* ACTION CARD 2: TRACK EXISTING COMPLAINT (High-Affordance Crisp Card) */}
            <div className="md:col-span-6 bg-white/95 dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl p-6 sm:p-8 shadow-xs border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between relative transition-colors">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-wider">
                  <SearchIcon className="w-3.5 h-3.5 text-[#0B4FC2] dark:text-blue-400" />
                  Real-time Status Audit
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Track Your Grievance
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Enter your unique reference number to inspect the live 10-state lifecycle, assigned field engineer, and timestamped before/after photo proof.
                </p>

                {/* Input Search Form */}
                <form onSubmit={handleTrackSubmit} className="pt-2 space-y-3">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                      <SearchIcon className="w-5 h-5" />
                    </div>
                    <input
                      type="text"
                      value={trackRef}
                      onChange={(e) => setTrackRef(e.target.value)}
                      placeholder="e.g. GOV-2026-00482"
                      aria-label="Complaint Reference Number"
                      className="block w-full pl-11 pr-4 py-3.5 text-base font-mono uppercase text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800/90 focus:outline-none focus:ring-2 focus:ring-[#0B4FC2] dark:focus:ring-blue-400 focus:border-transparent placeholder:normal-case placeholder:font-sans font-semibold transition-all"
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    rightIcon={<ArrowRightIcon className="w-4 h-4" />}
                    className="w-full bg-[#0B4FC2] hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-extrabold text-base py-3.5 rounded-xl shadow-xs transition-all"
                  >
                    Track Grievance Status
                  </Button>
                </form>
              </div>

              {/* Sample References for Quick Testing */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">Try test samples:</span>
                <button
                  type="button"
                  onClick={() => {
                    setTrackRef('GOV-2026-00482');
                    router.push('/track?ref=GOV-2026-00482');
                  }}
                  className="font-mono font-bold text-[#0B4FC2] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                >
                  GOV-2026-00482
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => {
                    setTrackRef('GOV-2026-00483');
                    router.push('/track?ref=GOV-2026-00483');
                  }}
                  className="font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
                >
                  GOV-2026-00483
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          PLATFORM IMPACT STATS TICKER (Real-Time Transparency)
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
        <div className="bg-white/95 dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-6 sm:p-8 transition-colors">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
            <div className="pt-2 md:pt-0 sm:px-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Civic Defects Resolved
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">18,420+</span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                  +12% mo
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-1">Verified with physical &quot;After&quot; photos</p>
            </div>

            <div className="pt-4 md:pt-0 sm:px-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                On-Time SLA Compliance
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-[#0B4FC2] dark:text-blue-400">94.8%</span>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
                  Target: 75%
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-1">Across all 5 civic departments</p>
            </div>

            <div className="pt-4 md:pt-0 sm:px-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Avg Resolution Time
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">38.4 hrs</span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                  -4.2h faster
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-1">From geotag intake to completed fix</p>
            </div>

            <div className="pt-4 md:pt-0 sm:px-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Cities &amp; Local Bodies
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">Pan-India</span>
                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 rounded">
                  36 States &amp; UTs
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-1">Full GIS boundary reverse-lookup</p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: PROFESSIONALLY DESIGNED INFRASTRUCTURE CATEGORIES
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0B4FC2] dark:text-blue-400 uppercase tracking-wider mb-2">
              <ActivityIcon className="w-3.5 h-3.5" />
              Direct Jurisdiction Routing
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Reportable Civic Infrastructure Categories
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              Select an infrastructure defect category to launch the geotagged intake wizard. Each category routes directly to the designated department and initiates an automated SLA countdown.
            </p>
          </div>
          <Link
            href="/report"
            className="inline-flex items-center gap-1 text-sm font-bold text-[#0B4FC2] dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 shrink-0"
          >
            <span>View All Categories</span>
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>

        {/* Categories 6-Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.id}
                href={`/report?category=${encodeURIComponent(cat.id)}`}
                className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 flex flex-col justify-between shadow-subtle hover:shadow-xl dark:hover:shadow-2xl ${cat.border} transition-all duration-200 group relative overflow-hidden`}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className={`w-13 h-13 rounded-xl ${cat.bg} flex items-center justify-center ${cat.color} group-hover:scale-105 transition-transform shadow-2xs`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {cat.sla}
                      </span>
                      <PriorityBadge priority={cat.prio as any} />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white group-hover:text-[#0B4FC2] dark:group-hover:text-blue-400 transition-colors">
                      {cat.label}
                    </h3>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mt-0.5">
                      {cat.dept}
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-2.5">
                      {cat.description}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-[#0B4FC2] dark:text-blue-400">
                  <span>Submit {cat.label.split('&')[0].trim()} Report</span>
                  <span className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                    <ArrowRightIcon className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: STEP-BY-STEP CLOSED-LOOP EXPLAINER (How It Works)
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white/95 dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl p-8 sm:p-12 shadow-sm relative overflow-hidden border border-slate-200/90 dark:border-slate-800 transition-colors">
          <div className="max-w-3xl mb-12 relative z-10">
            <span className="text-xs font-bold text-[#0B4FC2] dark:text-sky-400 uppercase tracking-widest block mb-2">
              Citizen Accountability Standard
            </span>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              How GovAsset Ensures No Grievance Is Ignored
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
              Unlike traditional helpdesks where tickets vanish into black-box queues, GovAsset operates on a 4-step deterministic closed loop with mandatory field photo proof.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
            {/* Step 1 */}
            <div className="space-y-4 relative">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-400/30 flex items-center justify-center font-black text-sm">
                  01
                </div>
                <span className="text-xs font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider">Intake</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Snap &amp; Geotag
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Take a photograph on your smartphone. The platform captures precise GPS coordinates and automatically links the issue to the correct local government jurisdiction.
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-4 relative">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/20 text-[#0B4FC2] dark:text-blue-300 border border-blue-200 dark:border-blue-400/30 flex items-center justify-center font-black text-sm">
                  02
                </div>
                <span className="text-xs font-bold text-[#0B4FC2] dark:text-blue-400 uppercase tracking-wider">Triage &amp; Assign</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Automated Crew Dispatch
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                The designated department engineer is alerted immediately. A strict SLA timer starts (e.g. 24h for lighting, 48h for roads), with automated escalation triggers.
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-4 relative">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-400/30 flex items-center justify-center font-black text-sm">
                  03
                </div>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Field Repair</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Physical &quot;After&quot; Proof
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Field teams execute physical repairs and must upload a geotagged, timestamped &quot;After&quot; photograph before the work order can be closed.
              </p>
            </div>

            {/* Step 4 */}
            <div className="space-y-4 relative">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-400/30 flex items-center justify-center font-black text-sm">
                  04
                </div>
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Verification</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Citizen 72h Dispute Gate
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                You receive Before/After proof via SMS. You have 72 hours to accept the resolution or reopen the ticket with a single tap if the fix was substandard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: TRANSPARENCY FEED (Recent Public Resolutions)
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Recent Transparent Municipal Grievances
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live civic tracking feed. Personal citizen details (names and mobile numbers) are cryptographically redacted under DPDP Act 2023.
            </p>
          </div>
          <Link
            href="/track"
            className="text-xs font-bold text-[#0B4FC2] dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 inline-flex items-center gap-1"
          >
            <span>Open Public Tracker</span>
            <ArrowRightIcon className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {recentResolutions.map((item) => (
            <div
              key={item.ref}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-subtle flex flex-col justify-between space-y-4 transition-colors"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-extrabold text-[#0B4FC2] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full">
                    {item.ref}
                  </span>
                  <StatusBadge status={item.status} />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                  {item.title}
                </h4>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <MapPinIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{item.ward}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 dark:text-slate-400 font-medium">{item.time}</span>
                <Link
                  href={`/track?ref=${encodeURIComponent(item.ref)}`}
                  className="font-bold text-[#0B4FC2] dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                  <span>Audit Timeline</span>
                  <ArrowRightIcon className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================================
          SECTION 5: BOTTOM CALL-TO-ACTION (Ready to Report)
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
        <div className="bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 dark:from-blue-950/40 dark:via-slate-900 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-900/50 rounded-3xl p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-8 transition-colors">
          <div className="space-y-2 max-w-2xl text-center md:text-left">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Notice a Hazard on Your Daily Commute?
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Don&apos;t wait for someone else to report it. Your geotagged report alerts municipal field teams immediately, keeping our streets and neighborhoods safe.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full md:w-auto">
            <Link href="/report" className="w-full sm:w-auto">
              <Button
                variant="primary"
                size="lg"
                leftIcon={<CameraIcon className="w-5 h-5" />}
                className="w-full sm:w-auto bg-[#0B4FC2] hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-extrabold px-8 py-4 rounded-xl shadow-md"
              >
                Submit Photo Report
              </Button>
            </Link>
            <Link href="/track" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto font-bold px-6 py-4 rounded-xl bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Track Existing
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
