import React from 'react';

export function CivicHeroGraphic({ className = 'w-full h-auto' }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox="0 0 680 440"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto drop-shadow-md select-none"
        aria-hidden="true"
      >
        <defs>
          {/* Light Civic Background Gradient */}
          <linearGradient id="bgGradLight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F4F8FD" />
            <stop offset="50%" stopColor="#EBF3FC" />
            <stop offset="100%" stopColor="#E2EDFA" />
          </linearGradient>

          {/* Road Gradient */}
          <linearGradient id="roadGrad" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#CBD5E1" />
            <stop offset="50%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#CBD5E1" />
          </linearGradient>

          <linearGradient id="glowPin" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#EF4444" />
            <stop offset="100%" stopColor="#DC2626" />
          </linearGradient>

          <linearGradient id="glowVerified" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>

          <linearGradient id="lightCone" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#FACC15" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#FACC15" stopOpacity="0.0" />
          </linearGradient>

          <linearGradient id="waterGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0EA5E9" />
          </linearGradient>

          {/* Card Soft Shadow Filter */}
          <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0F172A" floodOpacity="0.08" />
          </filter>
        </defs>

        {/* Ambient Container Card Background with Soft Rounded Edges */}
        <rect
          width="680"
          height="440"
          rx="24"
          fill="url(#bgGradLight)"
          stroke="#CBD5E1"
          strokeWidth="1"
        />

        {/* Subtle Civic Blueprint Grid */}
        <g opacity="0.35" stroke="#94A3B8" strokeWidth="0.8" strokeDasharray="4 4">
          <line x1="40" y1="40" x2="640" y2="40" />
          <line x1="40" y1="120" x2="640" y2="120" />
          <line x1="40" y1="200" x2="640" y2="200" />
          <line x1="40" y1="280" x2="640" y2="280" />
          <line x1="40" y1="360" x2="640" y2="360" />

          <line x1="120" y1="40" x2="120" y2="400" />
          <line x1="200" y1="40" x2="200" y2="400" />
          <line x1="280" y1="40" x2="280" y2="400" />
          <line x1="360" y1="40" x2="360" y2="400" />
          <line x1="440" y1="40" x2="440" y2="400" />
          <line x1="520" y1="40" x2="520" y2="400" />
          <line x1="600" y1="40" x2="600" y2="400" />
        </g>

        {/* Ground Plane: Stylized Urban Grid */}
        <path
          d="M 60 280 L 340 160 L 620 280 L 340 400 Z"
          fill="#F8FAFC"
          stroke="#0B4FC2"
          strokeWidth="1.2"
          opacity="0.9"
        />

        {/* Diagonal Arterial Road (PWD Works) */}
        <path
          d="M 230 210 L 450 310 L 410 330 L 190 230 Z"
          fill="url(#roadGrad)"
          stroke="#94A3B8"
          strokeWidth="1"
        />
        {/* Road Dashed Centerline */}
        <path
          d="M 210 220 L 430 320"
          stroke="#0B4FC2"
          strokeWidth="2"
          strokeDasharray="8 6"
        />

        {/* Streetlight 1 with Ambient Light Cone */}
        <polygon points="260,180 240,240 280,240" fill="url(#lightCone)" />
        <g stroke="#64748B" strokeWidth="2" strokeLinecap="round">
          <line x1="260" y1="180" x2="260" y2="215" />
          <circle cx="260" cy="180" r="3.5" fill="#FEF08A" stroke="#CA8A04" strokeWidth="1" />
        </g>

        {/* Streetlight 2 */}
        <polygon points="380,240 360,300 400,300" fill="url(#lightCone)" />
        <g stroke="#64748B" strokeWidth="2" strokeLinecap="round">
          <line x1="380" y1="240" x2="380" y2="275" />
          <circle cx="380" cy="240" r="3.5" fill="#FEF08A" stroke="#CA8A04" strokeWidth="1" />
        </g>

        {/* Municipal Public Asset Building (Civic Headquarters) */}
        <g transform="translate(320, 110)">
          {/* Front Face */}
          <polygon points="0,60 50,85 50,150 0,125" fill="#FFFFFF" stroke="#0B4FC2" strokeWidth="1.2" />
          {/* Side Face */}
          <polygon points="50,85 100,60 100,125 50,150" fill="#EDF4FC" stroke="#0B4FC2" strokeWidth="1.2" />
          {/* Roof */}
          <polygon points="0,60 50,35 100,60 50,85" fill="#DBEAFE" stroke="#0B4FC2" strokeWidth="1.2" />
          {/* Lit Windows */}
          <rect x="15" y="80" width="10" height="14" rx="1.5" fill="#0B4FC2" opacity="0.8" />
          <rect x="30" y="88" width="10" height="14" rx="1.5" fill="#0B4FC2" opacity="0.8" />
          <rect x="60" y="88" width="10" height="14" rx="1.5" fill="#0284C7" opacity="0.7" />
          <rect x="75" y="80" width="10" height="14" rx="1.5" fill="#0284C7" opacity="0.7" />
          {/* Rooftop Mast & Transmit Rings */}
          <line x1="50" y1="35" x2="50" y2="10" stroke="#0B4FC2" strokeWidth="2" />
          <circle cx="50" cy="10" r="3" fill="#0B4FC2" />
          <circle cx="50" cy="10" r="8" stroke="#0B4FC2" strokeWidth="1" opacity="0.6" strokeDasharray="2 2" />
          <circle cx="50" cy="10" r="14" stroke="#0B4FC2" strokeWidth="0.8" opacity="0.3" strokeDasharray="3 3" />
        </g>

        {/* Underground Smart Water/Sewage Pipe Network */}
        <path
          d="M 120 310 L 250 370 L 360 320"
          stroke="url(#waterGlow)"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.9"
        />
        <circle cx="250" cy="370" r="5" fill="#0284C7" stroke="#FFFFFF" strokeWidth="1.5" />

        {/* Civic Green Space / Trees */}
        <g transform="translate(460, 210)">
          <ellipse cx="20" cy="35" rx="18" ry="10" fill="#A7F3D0" opacity="0.8" />
          <path d="M 20 10 C 10 10, 5 22, 12 30 C 18 36, 22 36, 28 30 C 35 22, 30 10, 20 10 Z" fill="#10B981" />
          <path d="M 40 18 C 34 18, 30 26, 35 32 C 40 36, 44 36, 48 32 C 54 26, 50 18, 40 18 Z" fill="#059669" />
        </g>

        {/* Pulsing Active Geotag Radar (Simulating Live Citizen Report) */}
        <g transform="translate(260, 260)">
          <circle cx="0" cy="0" r="28" stroke="#EF4444" strokeWidth="1.5" opacity="0.25" />
          <circle cx="0" cy="0" r="18" stroke="#EF4444" strokeWidth="1.5" opacity="0.5" />
          <circle cx="0" cy="0" r="8" fill="#EF4444" opacity="0.8" />
          <circle cx="0" cy="0" r="3.5" fill="#FFFFFF" />
          {/* Pothole Tag Label */}
          <g transform="translate(-65, -50)" filter="url(#cardShadow)">
            <rect width="130" height="34" rx="8" fill="#FFFFFF" stroke="#EF4444" strokeWidth="1.2" />
            <circle cx="16" cy="17" r="4.5" fill="#EF4444" />
            <text x="28" y="16" fill="#0F172A" fontSize="11" fontWeight="700" fontFamily="sans-serif">
              Pothole P1
            </text>
            <text x="28" y="27" fill="#475569" fontSize="9" fontFamily="monospace">
              18.5204° N, 73.8567° E
            </text>
          </g>
        </g>

        {/* Floating Verified Resolution Card (Top Right) */}
        <g transform="translate(430, 48)" filter="url(#cardShadow)">
          <rect width="210" height="74" rx="12" fill="#FFFFFF" stroke="#10B981" strokeWidth="1.5" />
          {/* Check Circle */}
          <circle cx="30" cy="37" r="15" fill="url(#glowVerified)" />
          <path d="M 23 37 L 28 42 L 38 32" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Text */}
          <text x="56" y="32" fill="#0F172A" fontSize="13" fontWeight="700" fontFamily="sans-serif">
            Work Order Completed
          </text>
          <text x="56" y="48" fill="#475569" fontSize="10" fontFamily="sans-serif">
            Streetlight Replaced • Ward 04
          </text>
          <rect x="56" y="55" width="76" height="14" rx="4" fill="#DCFCE7" />
          <text x="61" y="65" fill="#15803D" fontSize="8.5" fontWeight="700" fontFamily="sans-serif">
            Turnaround: 18 hrs
          </text>
        </g>

        {/* Floating SLA Compliance Badge (Bottom Left) */}
        <g transform="translate(36, 310)" filter="url(#cardShadow)">
          <rect width="180" height="64" rx="12" fill="#FFFFFF" stroke="#0B4FC2" strokeWidth="1.2" />
          <circle cx="28" cy="32" r="14" fill="#EEF4FF" stroke="#0B4FC2" strokeWidth="1" />
          {/* Sparkline icon */}
          <path d="M 20 34 L 25 28 L 30 33 L 36 26" stroke="#0B4FC2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <text x="50" y="27" fill="#0F172A" fontSize="12" fontWeight="700" fontFamily="sans-serif">
            94.8% SLA Target
          </text>
          <text x="50" y="42" fill="#475569" fontSize="9.5" fontFamily="sans-serif">
            Real-time Civic Audit Trail
          </text>
          <text x="50" y="54" fill="#0B4FC2" fontSize="9" fontWeight="600" fontFamily="sans-serif">
            DPDP 2023 Masked
          </text>
        </g>
      </svg>
    </div>
  );
}
