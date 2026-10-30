-- ==============================================================================
-- GovAsset — Phase 2 Canonical Pilot Seed Data (SQL Version)
-- For Supabase Dashboard SQL Editor or `supabase db reset`
-- ==============================================================================

-- 1. Root Municipal Corporation
INSERT INTO jurisdictions (id, name, code, level, boundary)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Pune Municipal Corporation',
    'PMC-01',
    'DISTRICT_CORP',
    ST_Multi(ST_GeomFromText('POLYGON((73.80 18.45, 73.95 18.45, 73.95 18.60, 73.80 18.60, 73.80 18.45))', 4326))
)
ON CONFLICT (code) DO NOTHING;

-- 2. 4 Administrative Zones
INSERT INTO jurisdictions (id, name, code, level, parent_id, boundary)
VALUES
    ('22222222-2222-2222-2222-222222220001', 'Zone 1 (Shivajinagar / Central)', 'PMC-Z01', 'ZONE', '11111111-1111-1111-1111-111111111111', ST_Multi(ST_GeomFromText('POLYGON((73.81 18.46, 73.88 18.46, 73.88 18.55, 73.81 18.55, 73.81 18.46))', 4326))),
    ('22222222-2222-2222-2222-222222220002', 'Zone 2 (Kothrud / Bavdhan)', 'PMC-Z02', 'ZONE', '11111111-1111-1111-1111-111111111111', ST_Multi(ST_GeomFromText('POLYGON((73.81 18.46, 73.88 18.46, 73.88 18.55, 73.81 18.55, 73.81 18.46))', 4326))),
    ('22222222-2222-2222-2222-222222220003', 'Zone 3 (Hadapsar / East)', 'PMC-Z03', 'ZONE', '11111111-1111-1111-1111-111111111111', ST_Multi(ST_GeomFromText('POLYGON((73.81 18.46, 73.88 18.46, 73.88 18.55, 73.81 18.55, 73.81 18.46))', 4326))),
    ('22222222-2222-2222-2222-222222220004', 'Zone 4 (Aundh / Baner / West)', 'PMC-Z04', 'ZONE', '11111111-1111-1111-1111-111111111111', ST_Multi(ST_GeomFromText('POLYGON((73.81 18.46, 73.88 18.46, 73.88 18.55, 73.81 18.55, 73.81 18.46))', 4326)))
ON CONFLICT (code) DO NOTHING;

-- 3. 16 Electoral Wards
INSERT INTO jurisdictions (id, name, code, level, parent_id, boundary)
VALUES
    ('33333333-3333-3333-3333-333333330001', 'Ward 01 - Kasba Peth', 'PUN-Z01-W01', 'WARD', '22222222-2222-2222-2222-222222220001', ST_Multi(ST_GeomFromText('POLYGON((73.82 18.50, 73.85 18.50, 73.85 18.53, 73.82 18.53, 73.82 18.50))', 4326))),
    ('33333333-3333-3333-3333-333333330002', 'Ward 02 - Bhavani Peth', 'PUN-Z01-W02', 'WARD', '22222222-2222-2222-2222-222222220001', ST_Multi(ST_GeomFromText('POLYGON((73.82 18.50, 73.85 18.50, 73.85 18.53, 73.82 18.53, 73.82 18.50))', 4326))),
    ('33333333-3333-3333-3333-333333330012', 'Ward 12 - Shivajinagar', 'PUN-Z01-W12', 'WARD', '22222222-2222-2222-2222-222222220001', ST_Multi(ST_GeomFromText('POLYGON((73.82 18.50, 73.85 18.50, 73.85 18.53, 73.82 18.53, 73.82 18.50))', 4326))),
    ('33333333-3333-3333-3333-333333330013', 'Ward 13 - Deccan Gymkhana', 'PUN-Z01-W13', 'WARD', '22222222-2222-2222-2222-222222220001', ST_Multi(ST_GeomFromText('POLYGON((73.82 18.50, 73.85 18.50, 73.85 18.53, 73.82 18.53, 73.82 18.50))', 4326))),
    ('33333333-3333-3333-3333-333333330028', 'Ward 28 - Kothrud', 'PUN-Z02-W28', 'WARD', '22222222-2222-2222-2222-222222220002', ST_Multi(ST_GeomFromText('POLYGON((73.82 18.50, 73.85 18.50, 73.85 18.53, 73.82 18.53, 73.82 18.50))', 4326))),
    ('33333333-3333-3333-3333-333333330007', 'Ward 07 - Warje-Karvenagar', 'PUN-Z02-W07', 'WARD', '22222222-2222-2222-2222-222222220002', ST_Multi(ST_GeomFromText('POLYGON((73.82 18.50, 73.85 18.50, 73.85 18.53, 73.82 18.53, 73.82 18.50))', 4326))),
    ('33333333-3333-3333-3333-333333330014', 'Ward 14 - Sinhagad Road', 'PUN-Z02-W14', 'WARD', '22222222-2222-2222-2222-222222220002', ST_Multi(ST_GeomFromText('POLYGON((73.82 18.50, 73.85 18.50, 73.85 18.53, 73.82 18.53, 73.82 18.50))', 4326))),
    ('33333333-3333-3333-3333-333333330015', 'Ward 15 - Bavdhan', 'PUN-Z02-W15', 'WARD', '22222222-2222-2222-2222-222222220002', ST_Multi(ST_GeomFromText('POLYGON((73.82 18.50, 73.85 18.50, 73.85 18.53, 73.82 18.53, 73.82 18.50))', 4326))),
    ('33333333-3333-3333-3333-333333330008', 'Ward 08 - Hadapsar', 'PUN-Z03-W08', 'WARD', '22222222-2222-2222-2222-222222220003', ST_Multi(ST_GeomFromText('POLYGON((73.82 18.50, 73.85 18.50, 73.85 18.53, 73.82 18.53, 73.82 18.50))', 4326))),
    ('33333333-3333-3333-3333-333333330009', 'Ward 09 - Kondhwa', 'PUN-Z03-W09', 'WARD', '22222222-2222-2222-2222-222222220003', ST_Multi(ST_GeomFromText('POLYGON((73.82 18.50, 73.85 18.50, 73.85 18.53, 73.82 18.53, 73.82 18.50))', 4326))),
    ('33333333-3333-3333-3333-333333330010', 'Ward 10 - Wanowrie', 'PUN-Z03-W10', 'WARD', '22222222-2222-2222-2222-222222220003', ST_Multi(ST_GeomFromText('POLYGON((73.82 18.50, 73.85 18.50, 73.85 18.53, 73.82 18.53, 73.82 18.50))', 4326))),
    ('33333333-3333-3333-3333-333333330011', 'Ward 11 - Yerwada', 'PUN-Z03-W11', 'WARD', '22222222-2222-2222-2222-222222220003', ST_Multi(ST_GeomFromText('POLYGON((73.82 18.50, 73.85 18.50, 73.85 18.53, 73.82 18.53, 73.82 18.50))', 4326))),
    ('33333333-3333-3333-3333-333333330004', 'Ward 04 - Aundh', 'PUN-Z04-W04', 'WARD', '22222222-2222-2222-2222-222222220004', ST_Multi(ST_GeomFromText('POLYGON((73.82 18.50, 73.85 18.50, 73.85 18.53, 73.82 18.53, 73.82 18.50))', 4326))),
    ('33333333-3333-3333-3333-333333330005', 'Ward 05 - Baner-Balewadi', 'PUN-Z04-W05', 'WARD', '22222222-2222-2222-2222-222222220004', ST_Multi(ST_GeomFromText('POLYGON((73.82 18.50, 73.85 18.50, 73.85 18.53, 73.82 18.53, 73.82 18.50))', 4326))),
    ('33333333-3333-3333-3333-333333330006', 'Ward 06 - Pashan-Sutarwadi', 'PUN-Z04-W06', 'WARD', '22222222-2222-2222-2222-222222220004', ST_Multi(ST_GeomFromText('POLYGON((73.82 18.50, 73.85 18.50, 73.85 18.53, 73.82 18.53, 73.82 18.50))', 4326))),
    ('33333333-3333-3333-3333-333333330016', 'Ward 16 - Someshwarwadi', 'PUN-Z04-W16', 'WARD', '22222222-2222-2222-2222-222222220004', ST_Multi(ST_GeomFromText('POLYGON((73.82 18.50, 73.85 18.50, 73.85 18.53, 73.82 18.53, 73.82 18.50))', 4326)))
ON CONFLICT (code) DO NOTHING;

-- 4. 5 Civic Departments
INSERT INTO departments (id, code, name, description, contact_email, contact_phone)
VALUES
    ('44444444-4444-4444-4444-444444440001', 'ROAD_MAINTENANCE', 'Public Works Department - Road Infrastructure', 'Potholes, asphalt resurfacing, and arterial corridors', 'pwd.roads@pmc.gov.in', '020-25501000'),
    ('44444444-4444-4444-4444-444444440002', 'ELECTRICAL_LIGHTING', 'Electrical Engineering & Street Lighting', 'Streetlights, high-mast illumination, and pole hazards', 'electrical@pmc.gov.in', '1912'),
    ('44444444-4444-4444-4444-444444440003', 'WATER_SEWERAGE', 'Water Supply & Sewerage Board', 'Pipelines, sewage mains, and open manhole maintenance', 'water@pmc.gov.in', '1916'),
    ('44444444-4444-4444-4444-444444440004', 'SOLID_WASTE', 'Solid Waste Management & Public Sanitation', 'Garbage collection, open debris, and public health', 'sanitation@pmc.gov.in', '1800-233-4000'),
    ('44444444-4444-4444-4444-444444440005', 'PARKS_HORTICULTURE', 'Parks, Gardens & Public Amenities', 'Footpaths, paver blocks, civic gardens, and tree pruning', 'gardens@pmc.gov.in', '020-25501005')
ON CONFLICT (code) DO NOTHING;

-- 5. 6 Complaint Categories
INSERT INTO complaint_categories (id, code, name_en, name_hi, department_id, default_priority)
VALUES
    ('55555555-5555-5555-5555-555555550001', 'CAT_POTHOLE', 'Damaged Roads & Potholes', 'खड्डे आणि खराब रस्ते', '44444444-4444-4444-4444-444444440001', 'P2_HIGH'),
    ('55555555-5555-5555-5555-555555550002', 'CAT_STREETLIGHT', 'Streetlights & Electrical', 'रस्त्यावरील दिवे आणि वीज', '44444444-4444-4444-4444-444444440002', 'P1_CRITICAL'),
    ('55555555-5555-5555-5555-555555550003', 'CAT_WATER_LEAK', 'Water Leakage & Sewage', 'पाणी गळती आणि सांडपाणी', '44444444-4444-4444-4444-444444440003', 'P1_CRITICAL'),
    ('55555555-5555-5555-5555-555555550004', 'CAT_GARBAGE', 'Solid Waste & Sanitation', 'कचरा आणि सार्वजनिक स्वच्छता', '44444444-4444-4444-4444-444444440004', 'P2_HIGH'),
    ('55555555-5555-5555-5555-555555550005', 'CAT_PAVER_BLOCKS', 'Footpaths & Public Parks', 'पदपथ आणि सार्वजनिक उद्याने', '44444444-4444-4444-4444-444444440005', 'P3_MEDIUM'),
    ('55555555-5555-5555-5555-555555550006', 'CAT_DRAIN_GRATES', 'Missing Drain Grates & Safety Hazards', 'गटाराची झाकणे आणि सुरक्षा धोके', '44444444-4444-4444-4444-444444440003', 'P1_CRITICAL')
ON CONFLICT (code) DO NOTHING;

-- 6. SLA Policies
INSERT INTO sla_policies (id, category_id, priority, response_sla_hours, resolution_sla_hours, escalation_hours)
VALUES
    -- Potholes
    (gen_random_uuid(), '55555555-5555-5555-5555-555555550001', 'P1_CRITICAL', 2, 24, 18),
    (gen_random_uuid(), '55555555-5555-5555-5555-555555550001', 'P2_HIGH', 4, 48, 36),
    (gen_random_uuid(), '55555555-5555-5555-5555-555555550001', 'P3_MEDIUM', 12, 168, 120),
    (gen_random_uuid(), '55555555-5555-5555-5555-555555550001', 'P4_LOW', 24, 336, 240),
    -- Streetlights
    (gen_random_uuid(), '55555555-5555-5555-5555-555555550002', 'P1_CRITICAL', 2, 24, 18),
    (gen_random_uuid(), '55555555-5555-5555-5555-555555550002', 'P2_HIGH', 4, 48, 36),
    (gen_random_uuid(), '55555555-5555-5555-5555-555555550002', 'P3_MEDIUM', 12, 168, 120),
    (gen_random_uuid(), '55555555-5555-5555-5555-555555550002', 'P4_LOW', 24, 336, 240)
ON CONFLICT (category_id, priority) DO NOTHING;

-- 7. Seed Staff & Citizen Users
INSERT INTO users (id, phone_number, email, full_name, role, department_id, jurisdiction_id, staff_code, designation, skills, password_hash)
VALUES
    ('66666666-6666-6666-6666-666666660001', '+919822010001', 'admin@govasset.in', 'Rajesh Sharma (Platform Administrator)', 'PLATFORM_ADMIN', NULL, NULL, NULL, 'Platform Administrator', 'System Governance', '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only'),
    ('66666666-6666-6666-6666-666666660002', '+919822010002', 'officer.kothrud@govasset.in', 'Sunita Patil (Ward 28 Triage Officer)', 'OFFICER', '44444444-4444-4444-4444-444444440001', '33333333-3333-3333-3333-333333330028', 'PMC-OFF-028', 'Ward Triage Officer', 'Civic Triage, Work Order Dispatch', '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only'),
    ('66666666-6666-6666-6666-666666660003', '+919822010003', 'officer.shivaji@govasset.in', 'Amit Deshmukh (Ward 12 Triage Officer)', 'OFFICER', '44444444-4444-4444-4444-444444440002', '33333333-3333-3333-3333-333333330012', 'PMC-OFF-012', 'Ward Triage Officer', 'Electrical Grid Triage', '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only'),
    ('66666666-6666-6666-6666-666666660004', '+919822010004', 'supervisor.roads@govasset.in', 'Kavita Joshi (Roads Maintenance Supervisor)', 'SUPERVISOR', '44444444-4444-4444-4444-444444440001', '33333333-3333-3333-3333-333333330028', 'PMC-SUP-001', 'Roads Maintenance Supervisor', 'Quality Inspection, Verification Approval', '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only'),
    ('66666666-6666-6666-6666-666666660005', '+919822010005', 'supervisor.elec@govasset.in', 'Prakash Kulkarni (Electrical Supervisor)', 'SUPERVISOR', '44444444-4444-4444-4444-444444440002', '33333333-3333-3333-3333-333333330012', 'PMC-SUP-002', 'Electrical Supervisor', 'Quality Inspection, Verification Approval', '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only'),
    ('66666666-6666-6666-6666-666666660006', '+919822010006', 'field.vikram@govasset.in', 'Vikram Singh (Road Crew Lead #4)', 'FIELD_WORKER', '44444444-4444-4444-4444-444444440001', '33333333-3333-3333-3333-333333330028', 'PMC-FW-001', 'Senior Road Crew Lead', 'Road Repair, Asphalt Paving, Bitumen Rolling', '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only'),
    ('66666666-6666-6666-6666-666666660007', '+919822010007', 'field.suresh@govasset.in', 'Suresh Jadhav (Electrical Lineman #2)', 'FIELD_WORKER', '44444444-4444-4444-4444-444444440002', '33333333-3333-3333-3333-333333330012', 'PMC-FW-002', 'Electrical Lineman Lead', 'Streetlight Repair, Electrical Maintenance, High Voltage Wiring', '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only'),
    ('66666666-6666-6666-6666-666666660008', '+919822010008', 'citizen.aarav@govasset.in', 'Aarav Mehta (Registered Citizen)', 'CITIZEN', NULL, '33333333-3333-3333-3333-333333330028', NULL, NULL, NULL, NULL),
    ('66666666-6666-6666-6666-666666660101', '+919822010101', 'officer.csmc@govasset.in', 'Sachin Waghmare', 'OFFICER', '44444444-4444-4444-4444-444444440001', '33333333-3333-3333-3333-333333330101', 'CSMC-OFF-001', 'Ward Triage Officer', 'Civic Triage, Work Order Dispatch', '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only'),
    ('66666666-6666-6666-6666-666666660102', '+919822010102', 'supervisor.csmc@govasset.in', 'Pooja Gaikwad', 'SUPERVISOR', '44444444-4444-4444-4444-444444440001', '33333333-3333-3333-3333-333333330101', 'CSMC-SUP-001', 'Civil Maintenance Supervisor', 'Quality Inspection, Verification Approval', '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only'),
    ('66666666-6666-6666-6666-666666660103', '+919822010103', 'field.csmc@govasset.in', 'Ganesh Shinde', 'FIELD_WORKER', '44444444-4444-4444-4444-444444440001', '33333333-3333-3333-3333-333333330101', 'CSMC-FW-001', 'Senior Asphalt Compactor Lead', 'Road Repair, Asphalt Paving, Roller Operation, Cold Mix Patching', '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only'),
    ('66666666-6666-6666-6666-666666660104', '+919822010104', 'field2.csmc@govasset.in', 'Santosh Jadhav', 'FIELD_WORKER', '44444444-4444-4444-4444-444444440001', '33333333-3333-3333-3333-333333330101', 'CSMC-FW-002', 'Pavement Repair Specialist', 'Road Repair, Concrete Patching, Jackhammer, Kerbstone Alignment', '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only'),
    ('66666666-6666-6666-6666-666666660105', '+919822010105', 'field3.csmc@govasset.in', 'Ramesh Kale', 'FIELD_WORKER', '44444444-4444-4444-4444-444444440002', '33333333-3333-3333-3333-333333330101', 'CSMC-FW-003', 'Electrical Lineman Lead', 'Streetlight Repair, Electrical Maintenance, Cable Splicing, LED Replacement', '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only'),
    ('66666666-6666-6666-6666-666666660106', '+919822010106', 'field4.csmc@govasset.in', 'Pravin More', 'FIELD_WORKER', '44444444-4444-4444-4444-444444440003', '33333333-3333-3333-3333-333333330101', 'CSMC-FW-004', 'Water Works Technician', 'Water Supply, Pipeline Repair, Leak Detection, Valve Replacement, Plumbing', '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only'),
    ('66666666-6666-6666-6666-666666660108', '+919822010108', 'citizen.csmc@govasset.in', 'Aniket Deshpande (CSMC Citizen)', 'CITIZEN', NULL, '33333333-3333-3333-3333-333333330101', NULL, NULL, NULL, NULL)
ON CONFLICT (phone_number) DO NOTHING;

-- 8. Seed Complaints with Spatial Coordinates
INSERT INTO complaints (
    id, reference_number, citizen_id, citizen_phone, title, description,
    category_id, department_id, jurisdiction_id, location_coords, landmark_address,
    status, priority, response_due_at, resolution_due_at, sla_breached
) VALUES
    (
        '77777777-7777-7777-7777-777777770001',
        'GOV-2026-00482',
        '66666666-6666-6666-6666-666666660008',
        '+919822010008',
        'Deep Pothole on Main Arterial Road (Opp. Krishna Hospital)',
        'Crater-sized pothole spanning 1.5 meters across east-bound corridor. Submerged aggregate base causing traffic bottleneck and accidents.',
        '55555555-5555-5555-5555-555555550001',
        '44444444-4444-4444-4444-444444440001',
        '33333333-3333-3333-3333-333333330028',
        ST_SetSRID(ST_MakePoint(73.8112, 18.5089), 4326),
        'Mayur Colony, Opp. Krishna Hospital, Ward 28 - Kothrud',
        'IN_PROGRESS',
        'P1_CRITICAL',
        NOW() + INTERVAL '2 hours',
        NOW() + INTERVAL '24 hours',
        FALSE
    ),
    (
        '77777777-7777-7777-7777-777777770002',
        'GOV-2026-00483',
        '66666666-6666-6666-6666-666666660008',
        '+919822010008',
        'Dark Streetlight Junction Outside City Dispensary',
        'Twin high-mast luminaires extinguished for 48 hours creating blind spot at clinic entryway.',
        '55555555-5555-5555-5555-555555550002',
        '44444444-4444-4444-4444-444444440002',
        '33333333-3333-3333-3333-333333330012',
        ST_SetSRID(ST_MakePoint(73.8500, 18.5300), 4326),
        'Outside Dispensary Gate 1, Ward 12 - Shivajinagar',
        'VERIFIED_RESOLVED',
        'P2_HIGH',
        NOW() - INTERVAL '20 hours',
        NOW() - INTERVAL '10 hours',
        FALSE
    ),
    (
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
        'SUBMITTED',
        'P1_CRITICAL',
        NOW() + INTERVAL '2 hours',
        NOW() + INTERVAL '24 hours',
        FALSE
    )
ON CONFLICT (reference_number) DO NOTHING;
