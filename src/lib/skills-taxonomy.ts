/**
 * GovAsset — Controlled Work-Type & Skill Taxonomy
 *
 * Provides a normalized taxonomy mapping complaint categories and descriptions
 * to standardized municipal work types, required technical skills, and candidate worker ranking.
 */

export interface WorkTypeDefinition {
  id: string;
  label: string;
  departmentCode: string;
  primarySkills: string[];
  keywords: string[];
  description: string;
}

export const CONTROLLED_WORK_TYPES: Record<string, WorkTypeDefinition> = {
  ROAD_REPAIR_POTHOLES: {
    id: 'ROAD_REPAIR_POTHOLES',
    label: 'Road Repair / Potholes',
    departmentCode: 'ROAD_MAINTENANCE',
    primarySkills: [
      'Road Repair',
      'Pothole Filling',
      'Asphalt Paving',
      'Roller Operation',
      'Cold Mix Patching',
      'Concrete Patching',
      'Jackhammer',
      'Kerbstone Alignment',
    ],
    keywords: ['road', 'pothole', 'asphalt', 'crater', 'bitumen', 'tar', 'pavement', 'patching', 'crack'],
    description: 'Road surface resurfacing, pothole filling, bitumen laying and asphalt repairs',
  },
  ELECTRICAL_MAINTENANCE: {
    id: 'ELECTRICAL_MAINTENANCE',
    label: 'Electrical Maintenance',
    departmentCode: 'ELECTRICAL_LIGHTING',
    primarySkills: [
      'Electrical Maintenance',
      'High Voltage Wiring',
      'Transformer Check',
      'Substation Repair',
      'Cable Splicing',
      'Feeder Pillar',
    ],
    keywords: ['electrical', 'wire', 'power', 'transformer', 'shock', 'short circuit', 'current', 'voltage', 'spark'],
    description: 'Electrical grid, power distribution lines, feeder pillars, and wiring infrastructure',
  },
  STREETLIGHT_REPAIR: {
    id: 'STREETLIGHT_REPAIR',
    label: 'Streetlight Repair',
    departmentCode: 'ELECTRICAL_LIGHTING',
    primarySkills: [
      'Streetlight Repair',
      'Electrical Maintenance',
      'LED Replacement',
      'Pole Maintenance',
      'Timer / Sensor Setup',
      'High Mast Lighting',
    ],
    keywords: ['streetlight', 'light', 'lamp', 'pole', 'dark', 'bulb', 'led', 'mast', 'illumination'],
    description: 'Streetlights, mast lighting, sodium/LED bulb replacement and timer circuits',
  },
  WATER_SUPPLY_PIPELINE: {
    id: 'WATER_SUPPLY_PIPELINE',
    label: 'Water Supply / Pipeline',
    departmentCode: 'WATER_SEWERAGE',
    primarySkills: [
      'Water Supply',
      'Pipeline Repair',
      'Pipe Jointing',
      'Valve Replacement',
      'Leak Detection',
      'Pressure Testing',
      'Plumbing',
    ],
    keywords: ['water', 'pipeline', 'leak', 'pipe', 'valve', 'tap', 'pressure', 'potable', 'supply', 'burst'],
    description: 'Potable water pipelines, distribution mains, valves, and water leak repair',
  },
  DRAINAGE_MAINTENANCE: {
    id: 'DRAINAGE_MAINTENANCE',
    label: 'Drainage Maintenance',
    departmentCode: 'WATER_SEWERAGE',
    primarySkills: [
      'Drainage Maintenance',
      'Drain Cleaning',
      'Sewer Jetting',
      'Grate Installation',
      'Manhole Desilting',
      'Chamber Repair',
    ],
    keywords: ['drain', 'drainage', 'sewer', 'sewage', 'grate', 'manhole', 'overflow', 'gutter', 'desilting', 'clog'],
    description: 'Stormwater drains, underground sewers, missing grates, and overflow clearance',
  },
  SANITATION_WASTE: {
    id: 'SANITATION_WASTE',
    label: 'Sanitation / Waste Management',
    departmentCode: 'SOLID_WASTE',
    primarySkills: [
      'Sanitation',
      'Waste Management',
      'Garbage Clearance',
      'Debris Removal',
      'Compactor Driving',
      'Sanitization Spraying',
    ],
    keywords: ['garbage', 'waste', 'trash', 'sanitation', 'debris', 'dump', 'cleanliness', 'litter', 'dustbin'],
    description: 'Garbage dump clearance, solid waste collection, roadside debris and sanitation',
  },
  FACILITY_MAINTENANCE: {
    id: 'FACILITY_MAINTENANCE',
    label: 'Building and Public-Facility Maintenance',
    departmentCode: 'PARKS_HORTICULTURE',
    primarySkills: [
      'Facility Maintenance',
      'Paver Block Laying',
      'Footpath Repair',
      'Garden Maintenance',
      'Bench & Fence Repair',
      'Public Toilet Maintenance',
    ],
    keywords: ['park', 'footpath', 'paver', 'garden', 'facility', 'bench', 'public toilet', 'horticulture', 'sidewalk'],
    description: 'Public parks, footpaths, paver blocks, garden fixtures, and municipal buildings',
  },
};

/**
 * Mapping from existing Canonical ComplaintCategory codes to controlled Work Types.
 */
export const CATEGORY_TO_WORK_TYPE: Record<string, string> = {
  CAT_POTHOLE: 'ROAD_REPAIR_POTHOLES',
  CAT_STREETLIGHT: 'STREETLIGHT_REPAIR',
  CAT_WATER_LEAK: 'WATER_SUPPLY_PIPELINE',
  CAT_GARBAGE: 'SANITATION_WASTE',
  CAT_PAVER_BLOCKS: 'FACILITY_MAINTENANCE',
  CAT_DRAIN_GRATES: 'DRAINAGE_MAINTENANCE',
};

/**
 * Identifies the controlled WorkTypeDefinition for a complaint based on category code,
 * category name, and text contents.
 */
export function identifyComplaintWorkType(input: {
  categoryCode?: string | null;
  categoryName?: string | null;
  title?: string | null;
  description?: string | null;
}): WorkTypeDefinition | null {
  const { categoryCode, categoryName, title, description } = input;

  // 1. Direct code lookup
  if (categoryCode && CATEGORY_TO_WORK_TYPE[categoryCode]) {
    const workTypeId = CATEGORY_TO_WORK_TYPE[categoryCode];
    if (CONTROLLED_WORK_TYPES[workTypeId]) {
      return CONTROLLED_WORK_TYPES[workTypeId];
    }
  }

  // 2. Keyword matching across category name, title, and description
  const combinedText = `${categoryCode || ''} ${categoryName || ''} ${title || ''} ${description || ''}`.toLowerCase();

  for (const workType of Object.values(CONTROLLED_WORK_TYPES)) {
    const matched = workType.keywords.some((kw) => combinedText.includes(kw));
    if (matched) {
      return workType;
    }
  }

  return null;
}

/**
 * Normalizes a worker's free-text or comma-separated skills into an array of trimmed skill tokens.
 */
export function parseWorkerSkills(skillsText?: string | null): string[] {
  if (!skillsText) return [];
  return skillsText
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface WorkerMatchResult {
  isSkillMatched: boolean;
  isDepartmentFallback?: boolean;
  matchingSkills: string[];
  allSkills: string[];
  matchScore: number;
}

/**
 * Evaluates whether a worker's skill profile matches the required work type.
 * Follows Requirement 4.B:
 * - Worker possessing the specific skill required for the work type, OR
 * - Worker belonging to the relevant department if skill records are unpopulated.
 */
export function evaluateWorkerSkillMatch(
  workerSkillsText: string | null | undefined,
  workType: WorkTypeDefinition,
  options?: {
    workerDepartmentId?: string | null;
    complaintDepartmentId?: string | null;
    workerJurisdictionId?: string | null;
    complaintJurisdictionId?: string | null;
  }
): WorkerMatchResult {
  const allSkills = parseWorkerSkills(workerSkillsText);
  if (allSkills.length === 0) {
    // If worker skills are unpopulated, fall back to department match (Requirement 4.B)
    const isDeptMatch = Boolean(
      options?.workerDepartmentId &&
      options?.complaintDepartmentId &&
      options.workerDepartmentId === options.complaintDepartmentId
    );

    return {
      isSkillMatched: isDeptMatch,
      isDepartmentFallback: isDeptMatch,
      matchingSkills: isDeptMatch ? ['Department Qualified'] : [],
      allSkills: [],
      matchScore: isDeptMatch ? 15 : 0,
    };
  }

  const matchingSkills: string[] = [];
  const normalizedPrimary = workType.primarySkills.map((s) => s.toLowerCase());

  for (const skill of allSkills) {
    const sLower = skill.toLowerCase();
    // Direct or substring match with primary skills or keywords
    const matchesPrimary = normalizedPrimary.some(
      (p) => sLower.includes(p) || p.includes(sLower)
    );
    const matchesKeyword = workType.keywords.some(
      (kw) => sLower.includes(kw)
    );

    if (matchesPrimary || matchesKeyword) {
      matchingSkills.push(skill);
    }
  }

  let matchScore = matchingSkills.length * 10;

  // Department bonus
  if (
    options?.workerDepartmentId &&
    options?.complaintDepartmentId &&
    options.workerDepartmentId === options.complaintDepartmentId
  ) {
    matchScore += 15;
  }

  // Same-ward proximity bonus (without excluding multi-ward workers in the same corporation)
  if (
    options?.workerJurisdictionId &&
    options?.complaintJurisdictionId &&
    options.workerJurisdictionId === options.complaintJurisdictionId
  ) {
    matchScore += 5;
  }

  return {
    isSkillMatched: matchingSkills.length > 0,
    matchingSkills,
    allSkills,
    matchScore,
  };
}

/**
 * Returns a list of all recognized skill options across all controlled work types
 * for multi-select pickers in worker management.
 */
export function getAllControlledSkills(): { skill: string; workTypeId: string; workTypeLabel: string }[] {
  const results: { skill: string; workTypeId: string; workTypeLabel: string }[] = [];
  for (const wt of Object.values(CONTROLLED_WORK_TYPES)) {
    for (const sk of wt.primarySkills) {
      results.push({
        skill: sk,
        workTypeId: wt.id,
        workTypeLabel: wt.label,
      });
    }
  }
  return results;
}
