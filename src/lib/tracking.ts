export interface TimelineStep {
  title: string;
  timestamp: string;
  actingParty: string;
  publicNote: string;
  isComplete: boolean;
  isCurrent: boolean;
}

export interface TrackedComplaint {
  id?: string;
  version?: number;
  ref: string;
  title: string;
  description?: string;
  category: string;
  department: string;
  ward: string;
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  status:
    | 'SUBMITTED'
    | 'TRIAGED'
    | 'ASSIGNED'
    | 'IN_PROGRESS'
    | 'WORK_COMPLETED'
    | 'VERIFIED_RESOLVED'
    | 'CLOSED'
    | 'REJECTED_INVALID'
    | 'DISPUTED_REOPENED'
    | 'DUPLICATE_LINKED';
  reporterMasked: string;
  landmark: string;
  date: string;
  resolvedAt?: string | null;
  evidence?: Array<{ id: string; stage: string; fileKey: string; createdAt?: string }>;
  timeline: TimelineStep[];
}

export const CANONICAL_COMPLAINTS: Record<string, TrackedComplaint> = {
  'GOV-2026-00482': {
    ref: 'GOV-2026-00482',
    title: 'Deep Pothole on Main Arterial Road (Opp. Krishna Hospital)',
    description: 'Crater-sized pothole spanning 1.5 meters across east-bound corridor. Submerged aggregate base causing traffic bottleneck and motorcycle accidents.',
    category: 'Damaged Roads & Potholes',
    department: 'Road Maintenance (PWD)',
    ward: 'Kothrud, Pune',
    priority: 'P1',
    status: 'IN_PROGRESS',
    reporterMasked: '+91 ******4819',
    landmark: 'Mayur Colony, Opp. Krishna Hospital',
    date: '24 Oct 2026, 09:15 AM',
    timeline: [
      {
        title: 'Complaint Submitted',
        timestamp: '24 Oct 2026, 09:15 AM',
        actingParty: 'Citizen Reporter',
        publicNote: 'Photo evidence and geolocation submitted via Citizen Portal.',
        isComplete: true,
        isCurrent: false,
      },
      {
        title: 'Triaged & Priority Assigned',
        timestamp: '24 Oct 2026, 11:30 AM',
        actingParty: 'Municipal Triage Officer',
        publicNote: 'Assigned Priority: P1-Critical (Safety Hazard). Routed to Road Maintenance.',
        isComplete: true,
        isCurrent: false,
      },
      {
        title: 'Work Order Dispatched to Field Crew',
        timestamp: '24 Oct 2026, 01:15 PM',
        actingParty: 'Zonal Maintenance Supervisor',
        publicNote: 'Work assigned to Crew Lead Vikram Singh. Target completion: Today, 4:00 PM.',
        isComplete: true,
        isCurrent: true,
      },
      {
        title: 'Field Repair & Evidence Submission',
        timestamp: 'Estimated: Today, 04:00 PM',
        actingParty: 'Field Maintenance Crew',
        publicNote: 'Patching work and "After" photographic proof pending upload.',
        isComplete: false,
        isCurrent: false,
      },
      {
        title: 'Supervisor Physical Verification & Closure',
        timestamp: 'Pending Field Completion',
        actingParty: 'Municipal Supervisor',
        publicNote: 'Final quality inspection prior to resolution.',
        isComplete: false,
        isCurrent: false,
      },
    ],
  },
  'GOV-2026-00483': {
    ref: 'GOV-2026-00483',
    title: 'Dark Streetlight Junction Outside City Dispensary',
    description: 'Twin high-mast luminaires extinguished for 48 hours creating hazardous blind spot at clinic entryway.',
    category: 'Streetlights & Electrical',
    department: 'Electrical Department',
    ward: 'Shivajinagar, Pune',
    priority: 'P2',
    status: 'VERIFIED_RESOLVED',
    reporterMasked: '+91 ******7230',
    landmark: 'Outside Dispensary Gate 1',
    date: '23 Oct 2026, 06:40 PM',
    timeline: [
      {
        title: 'Complaint Submitted',
        timestamp: '23 Oct 2026, 06:40 PM',
        actingParty: 'Citizen Reporter',
        publicNote: 'Citizen reported unlit street corner posing safety risk.',
        isComplete: true,
        isCurrent: false,
      },
      {
        title: 'Triaged & Priority Assigned',
        timestamp: '23 Oct 2026, 07:15 PM',
        actingParty: 'Electrical Control Room',
        publicNote: 'Categorized under High-Mast Lighting maintenance. Priority P2.',
        isComplete: true,
        isCurrent: false,
      },
      {
        title: 'Work Order Dispatched to Field Crew',
        timestamp: '23 Oct 2026, 08:00 PM',
        actingParty: 'Zonal Electrical Supervisor',
        publicNote: 'Dispatched to Night Patrol Lighting Unit 3.',
        isComplete: true,
        isCurrent: false,
      },
      {
        title: 'Field Repair & Evidence Submission',
        timestamp: '24 Oct 2026, 08:30 AM',
        actingParty: 'Lighting Maintenance Team',
        publicNote: 'Defective LED driver and cabling replaced. Illuminated proof photo verified.',
        isComplete: true,
        isCurrent: false,
      },
      {
        title: 'Supervisor Physical Verification & Closure',
        timestamp: '24 Oct 2026, 10:15 AM',
        actingParty: 'Municipal Supervisor',
        publicNote: 'Quality check verified. Work Order closed. 7-day citizen dispute window active.',
        isComplete: true,
        isCurrent: true,
      },
    ],
  },
  'GOV-2026-00485': {
    ref: 'GOV-2026-00485',
    title: 'Sewage Manhole Overflow Near Community Hall',
    description: 'Manhole overflowing onto main pedestrian walkway. Strong foul odor and public hygiene hazard.',
    category: 'Water Leakage & Sewage',
    department: 'Water & Sewerage Board',
    ward: 'Hadapsar, Pune',
    priority: 'P1',
    status: 'TRIAGED',
    reporterMasked: '+91 ******9104',
    landmark: 'Near Hadapsar Community Hall Main Gate',
    date: '24 Oct 2026, 12:00 PM',
    timeline: [
      {
        title: 'Complaint Submitted',
        timestamp: '24 Oct 2026, 12:00 PM',
        actingParty: 'Citizen Reporter',
        publicNote: 'Manhole overflowing onto main pedestrian walkway.',
        isComplete: true,
        isCurrent: false,
      },
      {
        title: 'Triaged & Priority Assigned',
        timestamp: '24 Oct 2026, 01:10 PM',
        actingParty: 'Sewerage Operations Triage',
        publicNote: 'Classified P1 - Urgent Health Hazard. Assigned to Drainage Jetting Crew.',
        isComplete: true,
        isCurrent: true,
      },
      {
        title: 'Work Order Dispatched to Field Crew',
        timestamp: 'Pending Crew Dispatch',
        actingParty: 'Drainage Operations Supervisor',
        publicNote: 'High-pressure vacuum jetting truck awaiting site dispatch.',
        isComplete: false,
        isCurrent: false,
      },
      {
        title: 'Field Repair & Evidence Submission',
        timestamp: 'Pending Execution',
        actingParty: 'Field Drainage Crew',
        publicNote: 'Blockage clearance and water flow verification pending.',
        isComplete: false,
        isCurrent: false,
      },
      {
        title: 'Supervisor Physical Verification & Closure',
        timestamp: 'Pending Completion',
        actingParty: 'Municipal Supervisor',
        publicNote: 'Site sanitation verification inspection.',
        isComplete: false,
        isCurrent: false,
      },
    ],
  },
  'GOV-2026-00319': {
    ref: 'GOV-2026-00319',
    title: 'Streetlight Pole 42 Dark for 3 Days',
    category: 'Streetlights & Electrical',
    department: 'Electrical Department',
    ward: 'Kothrud, Pune',
    priority: 'P3',
    status: 'VERIFIED_RESOLVED',
    reporterMasked: '+91 ******4819',
    landmark: 'Near Kothrud Bus Stand',
    date: '18 Oct 2026, 08:30 PM',
    timeline: [
      {
        title: 'Complaint Submitted',
        timestamp: '18 Oct 2026, 08:30 PM',
        actingParty: 'Citizen Reporter',
        publicNote: 'Pole 42 dark lamp report logged.',
        isComplete: true,
        isCurrent: false,
      },
      {
        title: 'Work Order Dispatched & Resolved',
        timestamp: '19 Oct 2026, 04:00 PM',
        actingParty: 'Electrical Maintenance Team',
        publicNote: '70W LED luminaire replaced and verified functional.',
        isComplete: true,
        isCurrent: true,
      },
    ],
  },
  'GOV-2026-00290': {
    ref: 'GOV-2026-00290',
    title: 'Broken Paver Blocks on Footpath',
    category: 'Damaged Footpaths & Parks',
    department: 'Horticulture & Civil Works',
    ward: 'Kothrud, Pune',
    priority: 'P4',
    status: 'CLOSED',
    reporterMasked: '+91 ******4819',
    landmark: 'Near Gandhi Bhavan Road',
    date: '12 Oct 2026, 10:15 AM',
    timeline: [
      {
        title: 'Complaint Submitted',
        timestamp: '12 Oct 2026, 10:15 AM',
        actingParty: 'Citizen Reporter',
        publicNote: 'Uneven paver blocks on sidewalk.',
        isComplete: true,
        isCurrent: false,
      },
      {
        title: 'Repairs Completed & Closed',
        timestamp: '14 Oct 2026, 03:30 PM',
        actingParty: 'Civil Maintenance Team',
        publicNote: 'New interlock tiles set and cemented.',
        isComplete: true,
        isCurrent: true,
      },
    ],
  },
};

/**
 * Searches for an exact complaint reference.
 * Returns the matching TrackedComplaint if an exact match exists, or null otherwise.
 *
 * Requirements:
 * - Empty, whitespace, or invalid references return null.
 * - Exact string matching (case-insensitive, trimmed).
 * - Never returns a default or fallback complaint on mismatch.
 */
export function lookupComplaint(ref: string | null | undefined): TrackedComplaint | null {
  if (!ref) {
    return null;
  }
  const normalized = ref.trim().toUpperCase();
  if (!normalized) {
    return null;
  }
  return CANONICAL_COMPLAINTS[normalized] || null;
}
