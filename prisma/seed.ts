import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

const SCRYPT_PREFIX = 'scrypt$v1$N=16384,r=8,p=1$';
function hashPasswordSync(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${SCRYPT_PREFIX}${salt}$${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * GovAsset Phase 2 Pilot Seed Data
 * Generates canonical pilot entities for Pune Municipal Corporation (PMC):
 * - 1 Municipal Corporation
 * - 4 Administrative Zones
 * - 16 Electoral Wards (with PostGIS geometries)
 * - 5 Civic Departments
 * - 6 Complaint Categories & SLA Policy Matrix
 * - 8 Role-based Seed Users
 * - 3 Pilot Complaints with Evidence & Deterministic Timelines
 */
export async function seedDatabase() {
  console.log('🌱 Starting GovAsset multi-corporation pilot seed data population...');

  // 1. Primary Municipal Corporation: Chhatrapati Sambhajinagar Municipal Corporation (CSMC)
  const csmcId = '11111111-1111-1111-1111-111111110002';
  await prisma.$executeRawUnsafe(`
    INSERT INTO jurisdictions (id, name, code, level, state, district, city, contact_email, contact_phone, is_active, boundary, metadata)
    VALUES (
      '${csmcId}',
      'Chhatrapati Sambhajinagar Municipal Corporation',
      'CSMC-01',
      'DISTRICT_CORP'::jurisdiction_level,
      'Maharashtra',
      'Chhatrapati Sambhajinagar',
      'Chhatrapati Sambhajinagar',
      'commissioner@chhsambhajinagarmc.org',
      '0240-2333536',
      TRUE,
      ST_Multi(ST_GeomFromText('POLYGON((75.25 19.82, 75.42 19.82, 75.42 19.96, 75.25 19.96, 75.25 19.82))', 4326)),
      '{"headquarters": "Town Hall, Ghati Road, Naralibag, Chhatrapati Sambhajinagar 431001", "isDefault": true, "officialPortal": "https://chhsambhajinagarmc.org"}'::jsonb
    )
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      state = EXCLUDED.state,
      district = EXCLUDED.district,
      city = EXCLUDED.city,
      is_active = EXCLUDED.is_active,
      metadata = EXCLUDED.metadata;
  `);

  // CSMC Administrative Zones
  const csmcZones = [
    { id: '22222222-2222-2222-2222-222222220101', name: 'Zone 1 (Town Hall / Core City)', code: 'CSMC-Z01' },
    { id: '22222222-2222-2222-2222-222222220102', name: 'Zone 2 (CIDCO N-6)', code: 'CSMC-Z02' },
    { id: '22222222-2222-2222-2222-222222220103', name: 'Zone 3 (Central Naka)', code: 'CSMC-Z03' },
    { id: '22222222-2222-2222-2222-222222220104', name: 'Zone 4 (Kranti Chowk)', code: 'CSMC-Z04' },
    { id: '22222222-2222-2222-2222-222222220105', name: 'Zone 5 (Jawahar Colony / Mondha Naka)', code: 'CSMC-Z05' },
    { id: '22222222-2222-2222-2222-222222220106', name: 'Zone 6 (Satara / Deolai)', code: 'CSMC-Z06' },
    { id: '22222222-2222-2222-2222-222222220107', name: 'Zone 7 (Begumpura / University)', code: 'CSMC-Z07' },
    { id: '22222222-2222-2222-2222-222222220108', name: 'Zone 8 (Mukundwadi / Chikalthana)', code: 'CSMC-Z08' },
    { id: '22222222-2222-2222-2222-222222220109', name: 'Zone 9 (Harsul / Cidco)', code: 'CSMC-Z09' },
  ];

  for (const z of csmcZones) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO jurisdictions (id, name, code, level, parent_id, boundary, metadata)
      VALUES (
        '${z.id}',
        '${z.name}',
        '${z.code}',
        'ZONE'::jurisdiction_level,
        '${csmcId}',
        ST_Multi(ST_GeomFromText('POLYGON((75.28 19.86, 75.36 19.86, 75.36 19.92, 75.28 19.92, 75.28 19.86))', 4326)),
        '{"isPlaceholder": true, "disclaimer": "Synthetic zone boundary box for Chhatrapati Sambhajinagar. Official CSMC GIS boundary pending import."}'::jsonb
      )
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
    `);
  }

  // CSMC Authentic Electoral Wards
  const csmcWards = [
    { id: '33333333-3333-3333-3333-333333330101', name: 'Ward 01 - Shahaganj', code: 'CSMC-Z01-W01', parent: 'CSMC-Z01', lat: 19.8872, lng: 75.3289 },
    { id: '33333333-3333-3333-3333-333333330102', name: 'Ward 02 - Aurangpura', code: 'CSMC-Z01-W02', parent: 'CSMC-Z01', lat: 19.8820, lng: 75.3250 },
    { id: '33333333-3333-3333-3333-333333330103', name: 'Ward 03 - City Chowk', code: 'CSMC-Z01-W03', parent: 'CSMC-Z01', lat: 19.8890, lng: 75.3210 },
    { id: '33333333-3333-3333-3333-333333330104', name: 'Ward 04 - Kabadipura', code: 'CSMC-Z01-W04', parent: 'CSMC-Z01', lat: 19.8940, lng: 75.3220 },
    { id: '33333333-3333-3333-3333-333333330105', name: 'Ward 05 - CIDCO Sector N-6', code: 'CSMC-Z02-W05', parent: 'CSMC-Z02', lat: 19.8780, lng: 75.3620 },
    { id: '33333333-3333-3333-3333-333333330106', name: 'Ward 06 - CIDCO Sector N-7', code: 'CSMC-Z02-W06', parent: 'CSMC-Z02', lat: 19.8840, lng: 75.3680 },
    { id: '33333333-3333-3333-3333-333333330107', name: 'Ward 07 - Kranti Chowk', code: 'CSMC-Z04-W07', parent: 'CSMC-Z04', lat: 19.8730, lng: 75.3210 },
    { id: '33333333-3333-3333-3333-333333330108', name: 'Ward 08 - Osmanpura', code: 'CSMC-Z04-W08', parent: 'CSMC-Z04', lat: 19.8660, lng: 75.3260 },
    { id: '33333333-3333-3333-3333-333333330109', name: 'Ward 09 - Jawahar Colony', code: 'CSMC-Z05-W09', parent: 'CSMC-Z05', lat: 19.8680, lng: 75.3420 },
    { id: '33333333-3333-3333-3333-333333330110', name: 'Ward 10 - Mondha Naka', code: 'CSMC-Z05-W10', parent: 'CSMC-Z05', lat: 19.8740, lng: 75.3380 },
  ];

  for (const w of csmcWards) {
    const parentZone = csmcZones.find((z) => z.code === w.parent);
    const delta = 0.015;
    const minLng = (w.lng - delta).toFixed(4);
    const maxLng = (w.lng + delta).toFixed(4);
    const minLat = (w.lat - delta).toFixed(4);
    const maxLat = (w.lat + delta).toFixed(4);

    await prisma.$executeRawUnsafe(`
      INSERT INTO jurisdictions (id, name, code, level, parent_id, boundary, metadata)
      VALUES (
        '${w.id}',
        '${w.name}',
        '${w.code}',
        'WARD'::jurisdiction_level,
        '${parentZone?.id}',
        ST_Multi(ST_GeomFromText('POLYGON((${minLng} ${minLat}, ${maxLng} ${minLat}, ${maxLng} ${maxLat}, ${minLng} ${maxLat}, ${minLng} ${minLat}))', 4326)),
        '{"isPlaceholder": true, "disclaimer": "Synthetic ward boundary box for Chhatrapati Sambhajinagar. Official CSMC GIS boundary pending import.", "centerLat": ${w.lat}, "centerLng": ${w.lng}}'::jsonb
      )
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
    `);
  }

  // 2. Secondary Multi-Tenant Corporation: Pune Municipal Corporation (PMC)
  const corporation = await prisma.$executeRawUnsafe(`
    INSERT INTO jurisdictions (id, name, code, level, boundary)
    VALUES (
      '11111111-1111-1111-1111-111111111111',
      'Pune Municipal Corporation',
      'PMC-01',
      'DISTRICT_CORP'::jurisdiction_level,
      ST_Multi(ST_GeomFromText('POLYGON((73.80 18.45, 73.95 18.45, 73.95 18.60, 73.80 18.60, 73.80 18.45))', 4326))
    )
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
  `);

  // 2. Four Administrative Zones
  const zones = [
    { id: '22222222-2222-2222-2222-222222220001', name: 'Zone 1 (Shivajinagar / Central)', code: 'PMC-Z01' },
    { id: '22222222-2222-2222-2222-222222220002', name: 'Zone 2 (Kothrud / Bavdhan)', code: 'PMC-Z02' },
    { id: '22222222-2222-2222-2222-222222220003', name: 'Zone 3 (Hadapsar / East)', code: 'PMC-Z03' },
    { id: '22222222-2222-2222-2222-222222220004', name: 'Zone 4 (Aundh / Baner / West)', code: 'PMC-Z04' },
  ];

  for (const z of zones) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO jurisdictions (id, name, code, level, parent_id, boundary)
      VALUES (
        '${z.id}',
        '${z.name}',
        '${z.code}',
        'ZONE'::jurisdiction_level,
        '11111111-1111-1111-1111-111111111111',
        ST_Multi(ST_GeomFromText('POLYGON((73.81 18.46, 73.88 18.46, 73.88 18.55, 73.81 18.55, 73.81 18.46))', 4326))
      )
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
    `);
  }

  // 3. 16 Electoral Wards
  const wards = [
    // Zone 1
    { id: '33333333-3333-3333-3333-333333330001', name: 'Ward 01 - Kasba Peth', code: 'PUN-Z01-W01', parent: 'PMC-Z01' },
    { id: '33333333-3333-3333-3333-333333330002', name: 'Ward 02 - Bhavani Peth', code: 'PUN-Z01-W02', parent: 'PMC-Z01' },
    { id: '33333333-3333-3333-3333-333333330012', name: 'Ward 12 - Shivajinagar', code: 'PUN-Z01-W12', parent: 'PMC-Z01' },
    { id: '33333333-3333-3333-3333-333333330013', name: 'Ward 13 - Deccan Gymkhana', code: 'PUN-Z01-W13', parent: 'PMC-Z01' },
    // Zone 2
    { id: '33333333-3333-3333-3333-333333330028', name: 'Ward 28 - Kothrud', code: 'PUN-Z02-W28', parent: 'PMC-Z02' },
    { id: '33333333-3333-3333-3333-333333330007', name: 'Ward 07 - Warje-Karvenagar', code: 'PUN-Z02-W07', parent: 'PMC-Z02' },
    { id: '33333333-3333-3333-3333-333333330014', name: 'Ward 14 - Sinhagad Road', code: 'PUN-Z02-W14', parent: 'PMC-Z02' },
    { id: '33333333-3333-3333-3333-333333330015', name: 'Ward 15 - Bavdhan', code: 'PUN-Z02-W15', parent: 'PMC-Z02' },
    // Zone 3
    { id: '33333333-3333-3333-3333-333333330008', name: 'Ward 08 - Hadapsar', code: 'PUN-Z03-W08', parent: 'PMC-Z03' },
    { id: '33333333-3333-3333-3333-333333330009', name: 'Ward 09 - Kondhwa', code: 'PUN-Z03-W09', parent: 'PMC-Z03' },
    { id: '33333333-3333-3333-3333-333333330010', name: 'Ward 10 - Wanowrie', code: 'PUN-Z03-W10', parent: 'PMC-Z03' },
    { id: '33333333-3333-3333-3333-333333330011', name: 'Ward 11 - Yerwada', code: 'PUN-Z03-W11', parent: 'PMC-Z03' },
    // Zone 4
    { id: '33333333-3333-3333-3333-333333330004', name: 'Ward 04 - Aundh', code: 'PUN-Z04-W04', parent: 'PMC-Z04' },
    { id: '33333333-3333-3333-3333-333333330005', name: 'Ward 05 - Baner-Balewadi', code: 'PUN-Z04-W05', parent: 'PMC-Z04' },
    { id: '33333333-3333-3333-3333-333333330006', name: 'Ward 06 - Pashan-Sutarwadi', code: 'PUN-Z04-W06', parent: 'PMC-Z04' },
    { id: '33333333-3333-3333-3333-333333330016', name: 'Ward 16 - Someshwarwadi', code: 'PUN-Z04-W16', parent: 'PMC-Z04' },
  ];

  for (const w of wards) {
    const parentZone = zones.find((z) => z.code === w.parent);
    await prisma.$executeRawUnsafe(`
      INSERT INTO jurisdictions (id, name, code, level, parent_id, boundary)
      VALUES (
        '${w.id}',
        '${w.name}',
        '${w.code}',
        'WARD'::jurisdiction_level,
        '${parentZone?.id}',
        ST_Multi(ST_GeomFromText('POLYGON((73.82 18.50, 73.85 18.50, 73.85 18.53, 73.82 18.53, 73.82 18.50))', 4326))
      )
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
    `);
  }

  // 4. Five Civic Departments
  const departments = [
    {
      id: '44444444-4444-4444-4444-444444440001',
      code: 'ROAD_MAINTENANCE',
      name: 'Public Works Department - Road Infrastructure',
      email: 'pwd.roads@pmc.gov.in',
      phone: '020-25501000',
    },
    {
      id: '44444444-4444-4444-4444-444444440002',
      code: 'ELECTRICAL_LIGHTING',
      name: 'Electrical Engineering & Street Lighting',
      email: 'electrical@pmc.gov.in',
      phone: '1912',
    },
    {
      id: '44444444-4444-4444-4444-444444440003',
      code: 'WATER_SEWERAGE',
      name: 'Water Supply & Sewerage Board',
      email: 'water@pmc.gov.in',
      phone: '1916',
    },
    {
      id: '44444444-4444-4444-4444-444444440004',
      code: 'SOLID_WASTE',
      name: 'Solid Waste Management & Public Sanitation',
      email: 'sanitation@pmc.gov.in',
      phone: '1800-233-4000',
    },
    {
      id: '44444444-4444-4444-4444-444444440005',
      code: 'PARKS_HORTICULTURE',
      name: 'Parks, Gardens & Public Amenities',
      email: 'gardens@pmc.gov.in',
      phone: '020-25501005',
    },
  ];

  for (const d of departments) {
    await prisma.department.upsert({
      where: { code: d.code },
      update: { name: d.name, contactEmail: d.email, contactPhone: d.phone },
      create: {
        id: d.id,
        code: d.code,
        name: d.name,
        contactEmail: d.email,
        contactPhone: d.phone,
      },
    });
  }

  // 5. Six Complaint Categories
  const categories = [
    {
      id: '55555555-5555-5555-5555-555555550001',
      code: 'CAT_POTHOLE',
      nameEn: 'Damaged Roads & Potholes',
      nameHi: 'खड्डे आणि खराब रस्ते',
      deptCode: 'ROAD_MAINTENANCE',
      priority: 'P2_HIGH' as const,
    },
    {
      id: '55555555-5555-5555-5555-555555550002',
      code: 'CAT_STREETLIGHT',
      nameEn: 'Streetlights & Electrical',
      nameHi: 'रस्त्यावरील दिवे आणि वीज',
      deptCode: 'ELECTRICAL_LIGHTING',
      priority: 'P1_CRITICAL' as const,
    },
    {
      id: '55555555-5555-5555-5555-555555550003',
      code: 'CAT_WATER_LEAK',
      nameEn: 'Water Leakage & Sewage',
      nameHi: 'पाणी गळती आणि सांडपाणी',
      deptCode: 'WATER_SEWERAGE',
      priority: 'P1_CRITICAL' as const,
    },
    {
      id: '55555555-5555-5555-5555-555555550004',
      code: 'CAT_GARBAGE',
      nameEn: 'Solid Waste & Sanitation',
      nameHi: 'कचरा आणि सार्वजनिक स्वच्छता',
      deptCode: 'SOLID_WASTE',
      priority: 'P2_HIGH' as const,
    },
    {
      id: '55555555-5555-5555-5555-555555550005',
      code: 'CAT_PAVER_BLOCKS',
      nameEn: 'Footpaths & Public Parks',
      nameHi: 'पदपथ आणि सार्वजनिक उद्याने',
      deptCode: 'PARKS_HORTICULTURE',
      priority: 'P3_MEDIUM' as const,
    },
    {
      id: '55555555-5555-5555-5555-555555550006',
      code: 'CAT_DRAIN_GRATES',
      nameEn: 'Missing Drain Grates & Safety Hazards',
      nameHi: 'गटाराची झाकणे आणि सुरक्षा धोके',
      deptCode: 'WATER_SEWERAGE',
      priority: 'P1_CRITICAL' as const,
    },
  ];

  for (const c of categories) {
    const dept = departments.find((d) => d.code === c.deptCode);
    const cat = await prisma.complaintCategory.upsert({
      where: { code: c.code },
      update: { nameEn: c.nameEn, nameHi: c.nameHi, defaultPriority: c.priority },
      create: {
        id: c.id,
        code: c.code,
        nameEn: c.nameEn,
        nameHi: c.nameHi,
        departmentId: dept!.id,
        defaultPriority: c.priority,
      },
    });

    // Populate SLA policies for all 4 priorities per category
    const slaMatrix = [
      { priority: 'P1_CRITICAL' as const, response: 2, resolution: 24, escalation: 18 },
      { priority: 'P2_HIGH' as const, response: 4, resolution: 48, escalation: 36 },
      { priority: 'P3_MEDIUM' as const, response: 12, resolution: 168, escalation: 120 },
      { priority: 'P4_LOW' as const, response: 24, resolution: 336, escalation: 240 },
    ];

    for (const sla of slaMatrix) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO sla_policies (id, category_id, priority, response_sla_hours, resolution_sla_hours, escalation_hours)
        VALUES (
          gen_random_uuid(),
          '${cat.id}',
          '${sla.priority}'::complaint_priority,
          ${sla.response},
          ${sla.resolution},
          ${sla.escalation}
        )
        ON CONFLICT (category_id, priority)
        DO UPDATE SET
          response_sla_hours = EXCLUDED.response_sla_hours,
          resolution_sla_hours = EXCLUDED.resolution_sla_hours,
          escalation_hours = EXCLUDED.escalation_hours;
      `);
    }
  }

  // 6. Role-Based Seed Users
  const seedUsers = [
    {
      id: '66666666-6666-6666-6666-666666660001',
      phone: '+919822010001',
      email: 'admin@govasset.in',
      name: 'Rajesh Sharma (Platform Administrator)',
      role: 'PLATFORM_ADMIN' as const,
      dept: null,
      ward: null,
    },
    {
      id: '66666666-6666-6666-6666-666666660002',
      phone: '+919822010002',
      email: 'officer.kothrud@govasset.in',
      name: 'Sunita Patil (Ward 28 Triage Officer)',
      role: 'OFFICER' as const,
      dept: 'ROAD_MAINTENANCE',
      ward: 'PUN-Z02-W28',
    },
    {
      id: '66666666-6666-6666-6666-666666660003',
      phone: '+919822010003',
      email: 'officer.shivaji@govasset.in',
      name: 'Amit Deshmukh (Ward 12 Triage Officer)',
      role: 'OFFICER' as const,
      dept: 'ELECTRICAL_LIGHTING',
      ward: 'PUN-Z01-W12',
    },
    {
      id: '66666666-6666-6666-6666-666666660004',
      phone: '+919822010004',
      email: 'supervisor.roads@govasset.in',
      name: 'Kavita Joshi (Roads Maintenance Supervisor)',
      role: 'SUPERVISOR' as const,
      dept: 'ROAD_MAINTENANCE',
      ward: 'PUN-Z02-W28',
    },
    {
      id: '66666666-6666-6666-6666-666666660005',
      phone: '+919822010005',
      email: 'supervisor.elec@govasset.in',
      name: 'Prakash Kulkarni (Electrical Supervisor)',
      role: 'SUPERVISOR' as const,
      dept: 'ELECTRICAL_LIGHTING',
      ward: 'PUN-Z01-W12',
    },
    {
      id: '66666666-6666-6666-6666-666666660006',
      phone: '+919822010006',
      email: 'field.vikram@govasset.in',
      name: 'Vikram Singh (Road Crew Lead #4)',
      role: 'FIELD_WORKER' as const,
      dept: 'ROAD_MAINTENANCE',
      ward: 'PUN-Z02-W28',
      staffCode: 'PMC-FW-001',
      designation: 'Senior Road Crew Lead',
      skills: 'Road Repair, Asphalt Paving, Bitumen Rolling',
    },
    {
      id: '66666666-6666-6666-6666-666666660007',
      phone: '+919822010007',
      email: 'field.suresh@govasset.in',
      name: 'Suresh Jadhav (Electrical Lineman #2)',
      role: 'FIELD_WORKER' as const,
      dept: 'ELECTRICAL_LIGHTING',
      ward: 'PUN-Z01-W12',
      staffCode: 'PMC-FW-002',
      designation: 'Electrical Lineman Lead',
      skills: 'Streetlight Repair, Electrical Maintenance, High Voltage Wiring',
    },
    {
      id: '66666666-6666-6666-6666-666666660008',
      phone: '+919822010008',
      email: 'citizen.aarav@govasset.in',
      name: 'Aarav Mehta (Registered Citizen)',
      role: 'CITIZEN' as const,
      dept: null,
      ward: 'PUN-Z02-W28',
      staffCode: null,
      designation: null,
      skills: null,
    },
    {
      id: '66666666-6666-6666-6666-666666660108',
      phone: '+919822010108',
      email: 'citizen.csmc@govasset.in',
      name: 'Aniket Deshpande (CSMC Citizen)',
      role: 'CITIZEN' as const,
      dept: null,
      ward: 'CSMC-Z01-W01',
      staffCode: null,
      designation: null,
      skills: null,
    },
    // CSMC Official Staff & Multiple Field Workers
    {
      id: '66666666-6666-6666-6666-666666660101',
      phone: '+919822010101',
      email: 'officer.csmc@govasset.in',
      name: 'Sachin Waghmare',
      role: 'OFFICER' as const,
      dept: 'ROAD_MAINTENANCE',
      ward: 'CSMC-Z01-W01',
      staffCode: 'CSMC-OFF-001',
      designation: 'Ward Triage Officer',
      skills: 'Civic Triage, Work Order Dispatch',
    },
    {
      id: '66666666-6666-6666-6666-666666660102',
      phone: '+919822010102',
      email: 'supervisor.csmc@govasset.in',
      name: 'Pooja Gaikwad',
      role: 'SUPERVISOR' as const,
      dept: 'ROAD_MAINTENANCE',
      ward: 'CSMC-Z01-W01',
      staffCode: 'CSMC-SUP-001',
      designation: 'Civil Maintenance Supervisor',
      skills: 'Quality Inspection, Verification Approval',
    },
    {
      id: '66666666-6666-6666-6666-666666660103',
      phone: '+919822010103',
      email: 'field.csmc@govasset.in',
      name: 'Ganesh Shinde',
      role: 'FIELD_WORKER' as const,
      dept: 'ROAD_MAINTENANCE',
      ward: 'CSMC-Z01-W01',
      staffCode: 'CSMC-FW-001',
      designation: 'Senior Asphalt Compactor Lead',
      skills: 'Road Repair, Asphalt Paving, Roller Operation, Cold Mix Patching',
    },
    {
      id: '66666666-6666-6666-6666-666666660104',
      phone: '+919822010104',
      email: 'field2.csmc@govasset.in',
      name: 'Santosh Jadhav',
      role: 'FIELD_WORKER' as const,
      dept: 'ROAD_MAINTENANCE',
      ward: 'CSMC-Z01-W01',
      staffCode: 'CSMC-FW-002',
      designation: 'Pavement Repair Specialist',
      skills: 'Road Repair, Concrete Patching, Jackhammer, Kerbstone Alignment',
    },
    {
      id: '66666666-6666-6666-6666-666666660105',
      phone: '+919822010105',
      email: 'field3.csmc@govasset.in',
      name: 'Ramesh Kale',
      role: 'FIELD_WORKER' as const,
      dept: 'ELECTRICAL_LIGHTING',
      ward: 'CSMC-Z01-W01',
      staffCode: 'CSMC-FW-003',
      designation: 'Electrical Lineman Lead',
      skills: 'Streetlight Repair, Electrical Maintenance, Cable Splicing, LED Replacement',
    },
    {
      id: '66666666-6666-6666-6666-666666660106',
      phone: '+919822010106',
      email: 'field4.csmc@govasset.in',
      name: 'Pravin More',
      role: 'FIELD_WORKER' as const,
      dept: 'WATER_SEWERAGE',
      ward: 'CSMC-Z01-W01',
      staffCode: 'CSMC-FW-004',
      designation: 'Water Works Technician',
      skills: 'Water Supply, Pipeline Repair, Leak Detection, Valve Replacement, Plumbing',
    },
  ];

  for (const u of seedUsers) {
    const deptRecord = u.dept ? departments.find((d) => d.code === u.dept) : null;
    const wardRecord = u.ward
      ? csmcWards.find((w) => w.code === u.ward) || wards.find((w) => w.code === u.ward)
      : null;

    await prisma.user.upsert({
      where: { phoneNumber: u.phone },
      update: {
        fullName: u.name,
        email: u.email,
        role: u.role,
        staffCode: (u as any).staffCode ?? null,
        designation: (u as any).designation ?? null,
        skills: (u as any).skills ?? null,
      },
      create: {
        id: u.id,
        phoneNumber: u.phone,
        email: u.email,
        fullName: u.name,
        role: u.role,
        departmentId: deptRecord?.id || null,
        jurisdictionId: wardRecord?.id || null,
        staffCode: (u as any).staffCode ?? null,
        designation: (u as any).designation ?? null,
        skills: (u as any).skills ?? null,
        // Authentic scrypt password hash for staff demo access in both dev and production
        passwordHash: await hashPasswordSync('password123'),
      },
    });
  }

  // 7. Canonical Pilot Complaints with PostGIS Coordinates
  // Pothole Complaint (In Progress)
  await prisma.$executeRawUnsafe(`
    INSERT INTO complaints (
      id, reference_number, citizen_id, citizen_phone, title, description,
      category_id, department_id, jurisdiction_id, location_coords, landmark_address,
      status, priority, response_due_at, resolution_due_at, sla_breached
    ) VALUES (
      '77777777-7777-7777-7777-777777770001',
      'GOV-2026-00482',
      '66666666-6666-6666-6666-666666660008',
      '+919822010008',
      'Deep Pothole on Main Arterial Road (Opp. Krishna Hospital)',
      'Crater-sized pothole spanning 1.5 meters across east-bound corridor. Submerged aggregate base causing traffic bottleneck and motorcycle accidents.',
      '55555555-5555-5555-5555-555555550001',
      '44444444-4444-4444-4444-444444440001',
      '33333333-3333-3333-3333-333333330028',
      ST_SetSRID(ST_MakePoint(73.8112, 18.5089), 4326),
      'Mayur Colony, Opp. Krishna Hospital, Ward 28 - Kothrud',
      'IN_PROGRESS'::complaint_status,
      'P1_CRITICAL'::complaint_priority,
      NOW() + INTERVAL '2 hours',
      NOW() + INTERVAL '24 hours',
      FALSE
    )
    ON CONFLICT (reference_number) DO NOTHING;
  `);

  // Work Order Assignment for GOV-2026-00482
  await prisma.complaintAssignment.upsert({
    where: { id: '88888888-8888-8888-8888-888888880001' },
    update: {},
    create: {
      id: '88888888-8888-8888-8888-888888880001',
      complaintId: '77777777-7777-7777-7777-777777770001',
      assignedWorkerId: '66666666-6666-6666-6666-666666660006', // Vikram Singh
      assignedById: '66666666-6666-6666-6666-666666660004', // Kavita Joshi
      targetCompletionAt: new Date(Date.now() + 14400000), // +4 hours
      workerNotes: 'Dispatched with mini asphalt roller and 300kg cold bituminous mix.',
      isActive: true,
    },
  });

  // Streetlight Complaint (Verified Resolved)
  await prisma.$executeRawUnsafe(`
    INSERT INTO complaints (
      id, reference_number, citizen_id, citizen_phone, title, description,
      category_id, department_id, jurisdiction_id, location_coords, landmark_address,
      status, priority, response_due_at, resolution_due_at, sla_breached
    ) VALUES (
      '77777777-7777-7777-7777-777777770002',
      'GOV-2026-00483',
      '66666666-6666-6666-6666-666666660008',
      '+919822010008',
      'Dark Streetlight Junction Outside City Dispensary',
      'Twin high-mast luminaires extinguished for 48 hours creating hazardous blind spot at clinic entryway.',
      '55555555-5555-5555-5555-555555550002',
      '44444444-4444-4444-4444-444444440002',
      '33333333-3333-3333-3333-333333330012',
      ST_SetSRID(ST_MakePoint(73.8500, 18.5300), 4326),
      'Outside Dispensary Gate 1, Ward 12 - Shivajinagar',
      'VERIFIED_RESOLVED'::complaint_status,
      'P2_HIGH'::complaint_priority,
      NOW() - INTERVAL '20 hours',
      NOW() - INTERVAL '10 hours',
      FALSE
    )
    ON CONFLICT (reference_number) DO NOTHING;
  `);

  // CSMC Road Cave-in Complaint (Submitted / Triage Ready)
  await prisma.$executeRawUnsafe(`
    INSERT INTO complaints (
      id, reference_number, citizen_id, citizen_phone, title, description,
      category_id, department_id, jurisdiction_id, location_coords, landmark_address,
      status, priority, response_due_at, resolution_due_at, sla_breached
    ) VALUES (
      '77777777-7777-7777-7777-777777770101',
      'GOV-2026-00101',
      '66666666-6666-6666-6666-666666660108',
      '+919822010108',
      'Severe Road Cave-in Near Shahaganj Clock Tower',
      'Large structural asphalt collapse measuring 2 meters near Shahaganj Chowk. High water table erosion causing dangerous cavity for buses and pedestrians.',
      '55555555-5555-5555-5555-555555550001',
      '44444444-4444-4444-4444-444444440001',
      '33333333-3333-3333-3333-333333330101',
      ST_SetSRID(ST_MakePoint(75.3433, 19.8762), 4326),
      'Near Shahaganj Clock Tower, Ward 01 - Shahaganj',
      'SUBMITTED'::complaint_status,
      'P1_CRITICAL'::complaint_priority,
      NOW() + INTERVAL '2 hours',
      NOW() + INTERVAL '24 hours',
      FALSE
    )
    ON CONFLICT (reference_number) DO NOTHING;
  `);

  console.log('✅ GovAsset pilot seed data successfully populated!');
}

// Direct execution when invoked via `npx prisma db seed` or `ts-node prisma/seed.ts`
if (require.main === module) {
  seedDatabase()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error('❌ Error executing database seed:', e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
