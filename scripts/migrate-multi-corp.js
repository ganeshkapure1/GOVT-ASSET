const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runMigration() {
  console.log('🔄 Applying safe schema migrations for Multi-Corporation & Staff Profile Support...');

  // 1. Add fields to jurisdictions individually
  const jurCols = [
    'ALTER TABLE jurisdictions ADD COLUMN IF NOT EXISTS state VARCHAR(100)',
    'ALTER TABLE jurisdictions ADD COLUMN IF NOT EXISTS district VARCHAR(100)',
    'ALTER TABLE jurisdictions ADD COLUMN IF NOT EXISTS city VARCHAR(100)',
    'ALTER TABLE jurisdictions ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255)',
    'ALTER TABLE jurisdictions ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20)',
    'ALTER TABLE jurisdictions ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500)',
    'ALTER TABLE jurisdictions ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE',
    'ALTER TABLE jurisdictions ADD COLUMN IF NOT EXISTS metadata JSONB',
  ];
  for (const q of jurCols) {
    await prisma.$executeRawUnsafe(q);
  }
  console.log('✓ Jurisdictions table updated with corporation & ward metadata fields.');

  // 2. Add fields to users individually
  const userCols = [
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_code VARCHAR(50)',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(100)',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS skills VARCHAR(255)',
  ];
  for (const q of userCols) {
    await prisma.$executeRawUnsafe(q);
  }
  console.log('✓ Users table updated with staff code, designation, and skills fields.');

  // 3. Seed / Ensure Chhatrapati Sambhajinagar Municipal Corporation (CSMC)
  const csmcId = '11111111-1111-1111-1111-111111110002';
  await prisma.$executeRawUnsafe(`
    INSERT INTO jurisdictions (
      id, name, code, level, state, district, city, contact_email, contact_phone, is_active, boundary, metadata
    ) VALUES (
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
      contact_email = EXCLUDED.contact_email,
      contact_phone = EXCLUDED.contact_phone,
      is_active = EXCLUDED.is_active,
      metadata = EXCLUDED.metadata;
  `);
  console.log('✓ Chhatrapati Sambhajinagar Municipal Corporation (CSMC) registered as primary corporation.');

  // 4. Update Pune Municipal Corporation metadata
  await prisma.$executeRawUnsafe(`
    UPDATE jurisdictions
    SET state = 'Maharashtra', district = 'Pune', city = 'Pune',
        contact_email = 'commissioner@pmc.gov.in', contact_phone = '020-25501000',
        metadata = '{"isDefault": false}'::jsonb
    WHERE code = 'PMC-01';
  `);
  console.log('✓ Existing Pune Municipal Corporation (PMC) updated with metadata and marked secondary.');

  // 5. Seed Official Administrative Zones of CSMC
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
  console.log(`✓ Seeded ${csmcZones.length} administrative zones for CSMC.`);

  // 6. Seed Authentic Wards for CSMC
  const csmcWards = [
    // Zone 1: Core City
    { id: '33333333-3333-3333-3333-333333330101', name: 'Ward 01 - Shahaganj', code: 'CSMC-Z01-W01', parent: 'CSMC-Z01', lat: 19.8872, lng: 75.3289 },
    { id: '33333333-3333-3333-3333-333333330102', name: 'Ward 02 - Aurangpura', code: 'CSMC-Z01-W02', parent: 'CSMC-Z01', lat: 19.8820, lng: 75.3250 },
    { id: '33333333-3333-3333-3333-333333330103', name: 'Ward 03 - City Chowk', code: 'CSMC-Z01-W03', parent: 'CSMC-Z01', lat: 19.8890, lng: 75.3210 },
    { id: '33333333-3333-3333-3333-333333330104', name: 'Ward 04 - Kabadipura', code: 'CSMC-Z01-W04', parent: 'CSMC-Z01', lat: 19.8940, lng: 75.3220 },
    // Zone 2: CIDCO N-6
    { id: '33333333-3333-3333-3333-333333330105', name: 'Ward 05 - CIDCO Sector N-6', code: 'CSMC-Z02-W05', parent: 'CSMC-Z02', lat: 19.8780, lng: 75.3620 },
    { id: '33333333-3333-3333-3333-333333330106', name: 'Ward 06 - CIDCO Sector N-7', code: 'CSMC-Z02-W06', parent: 'CSMC-Z02', lat: 19.8840, lng: 75.3680 },
    // Zone 4: Kranti Chowk
    { id: '33333333-3333-3333-3333-333333330107', name: 'Ward 07 - Kranti Chowk', code: 'CSMC-Z04-W07', parent: 'CSMC-Z04', lat: 19.8730, lng: 75.3210 },
    { id: '33333333-3333-3333-3333-333333330108', name: 'Ward 08 - Osmanpura', code: 'CSMC-Z04-W08', parent: 'CSMC-Z04', lat: 19.8660, lng: 75.3260 },
    // Zone 5: Jawahar Colony
    { id: '33333333-3333-3333-3333-333333330109', name: 'Ward 09 - Jawahar Colony', code: 'CSMC-Z05-W09', parent: 'CSMC-Z05', lat: 19.8680, lng: 75.3420 },
    { id: '33333333-3333-3333-3333-333333330110', name: 'Ward 10 - Mondha Naka', code: 'CSMC-Z05-W10', parent: 'CSMC-Z05', lat: 19.8740, lng: 75.3380 },
  ];

  for (const w of csmcWards) {
    const parentZone = csmcZones.find((z) => z.code === w.parent);
    // Boundary approximation: small bounding box centered around the ward coordinate
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
        '${parentZone.id}',
        ST_Multi(ST_GeomFromText('POLYGON((${minLng} ${minLat}, ${maxLng} ${minLat}, ${maxLng} ${maxLat}, ${minLng} ${maxLat}, ${minLng} ${minLat}))', 4326)),
        '{"isPlaceholder": true, "disclaimer": "Synthetic ward boundary box for Chhatrapati Sambhajinagar. Official CSMC GIS boundary pending import.", "centerLat": ${w.lat}, "centerLng": ${w.lng}}'::jsonb
      )
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        metadata = EXCLUDED.metadata;
    `);
  }
  console.log(`✓ Seeded ${csmcWards.length} authentic wards for CSMC with clear synthetic disclaimers.`);

  // 7. Seed CSMC Operational Staff (Officer, Supervisor, Field Worker)
  const csmcStaff = [
    {
      id: '66666666-6666-6666-6666-666666660101',
      phone: '+919822010101',
      email: 'officer.csmc@govasset.in',
      name: 'Sachin Waghmare (CSMC Ward 01 Triage Officer)',
      role: 'OFFICER',
      deptCode: 'ROAD_MAINTENANCE',
      wardCode: 'CSMC-Z01-W01',
      staffCode: 'CSMC-OFF-01',
      designation: 'Junior Engineer (Roads)',
      skills: 'Road Maintenance, Pothole Inspection, Triage',
    },
    {
      id: '66666666-6666-6666-6666-666666660102',
      phone: '+919822010102',
      email: 'supervisor.csmc@govasset.in',
      name: 'Pooja Gaikwad (CSMC Zone 1 Roads Supervisor)',
      role: 'SUPERVISOR',
      deptCode: 'ROAD_MAINTENANCE',
      wardCode: 'CSMC-Z01-W01',
      staffCode: 'CSMC-SUP-01',
      designation: 'Sectional Engineer (PWD)',
      skills: 'Asphalt Verification, Quality Audit, Crew Oversight',
    },
    {
      id: '66666666-6666-6666-6666-666666660103',
      phone: '+919822010103',
      email: 'field.csmc@govasset.in',
      name: 'Ganesh Shinde (CSMC Road Crew Lead #1)',
      role: 'FIELD_WORKER',
      deptCode: 'ROAD_MAINTENANCE',
      wardCode: 'CSMC-Z01-W01',
      staffCode: 'CSMC-WRK-01',
      designation: 'Road Crew Maintenance Lead',
      skills: 'Bituminous Mix, Cold Asphalt, Compactor Operation',
    },
  ];

  const roadDept = await prisma.department.findUnique({ where: { code: 'ROAD_MAINTENANCE' } });
  const ward1 = await prisma.jurisdiction.findUnique({ where: { code: 'CSMC-Z01-W01' } });

  for (const s of csmcStaff) {
    await prisma.user.upsert({
      where: { phoneNumber: s.phone },
      update: {
        fullName: s.name,
        email: s.email,
        role: s.role,
        departmentId: roadDept?.id || null,
        jurisdictionId: ward1?.id || null,
        staffCode: s.staffCode,
        designation: s.designation,
        skills: s.skills,
        isActive: true,
      },
      create: {
        id: s.id,
        phoneNumber: s.phone,
        email: s.email,
        fullName: s.name,
        role: s.role,
        departmentId: roadDept?.id || null,
        jurisdictionId: ward1?.id || null,
        staffCode: s.staffCode,
        designation: s.designation,
        skills: s.skills,
        isActive: true,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only',
      },
    });
  }
  console.log(`✓ Seeded ${csmcStaff.length} CSMC operational staff with full profiles.`);

  console.log('✅ Multi-Corporation Migration & CSMC Seeding Complete.');
}

runMigration()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
