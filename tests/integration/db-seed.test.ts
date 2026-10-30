import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

describe('Phase 2: Database Schema, PostGIS & Seed Architecture Verification', () => {
  // =========================================================================
  // 1. Prisma Client Singleton & Connection Pooling Configuration
  // =========================================================================
  describe('Prisma Client Singleton', () => {
    it('exports a valid PrismaClient singleton instance', () => {
      expect(db).toBeDefined();
      expect(typeof db.$connect).toBe('function');
      expect(typeof db.$disconnect).toBe('function');
      expect(typeof db.$executeRawUnsafe).toBe('function');
    });

    it('contains all 9 documented domain models in Prisma DMMF', () => {
      const dmmf = Prisma.dmmf;
      const modelNames = dmmf.datamodel.models.map((m) => m.name);

      expect(modelNames).toContain('Jurisdiction');
      expect(modelNames).toContain('Department');
      expect(modelNames).toContain('User');
      expect(modelNames).toContain('ComplaintCategory');
      expect(modelNames).toContain('SlaPolicy');
      expect(modelNames).toContain('Complaint');
      expect(modelNames).toContain('ComplaintEvidence');
      expect(modelNames).toContain('ComplaintAssignment');
      expect(modelNames).toContain('ComplaintTimeline');
      expect(modelNames).toContain('Notification');
    });

    it('defines all required finite state machine and RBAC enums in Prisma DMMF', () => {
      const dmmf = Prisma.dmmf;
      const enumNames = dmmf.datamodel.enums.map((e) => e.name);

      expect(enumNames).toContain('JurisdictionLevel');
      expect(enumNames).toContain('UserRole');
      expect(enumNames).toContain('ComplaintPriority');
      expect(enumNames).toContain('ComplaintStatus');
      expect(enumNames).toContain('EvidenceStage');
      expect(enumNames).toContain('NotificationChannel');
      expect(enumNames).toContain('NotificationStatus');

      // Verify specific values
      const statusEnum = dmmf.datamodel.enums.find((e) => e.name === 'ComplaintStatus');
      const statusValues = statusEnum?.values.map((v) => v.name);
      expect(statusValues).toContain('SUBMITTED');
      expect(statusValues).toContain('TRIAGED_VALIDATED');
      expect(statusValues).toContain('ASSIGNED');
      expect(statusValues).toContain('IN_PROGRESS');
      expect(statusValues).toContain('WORK_COMPLETED');
      expect(statusValues).toContain('VERIFIED_RESOLVED');
      expect(statusValues).toContain('CLOSED');
      expect(statusValues).toContain('REJECTED_INVALID');
      expect(statusValues).toContain('DISPUTED_REOPENED');
    });
  });

  // =========================================================================
  // 2. Migration DDL & PostGIS Verification
  // =========================================================================
  describe('Version-Controlled SQL Migrations', () => {
    const supabaseMigrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20261025000000_init_schema.sql');
    const prismaMigrationPath = path.join(
      process.cwd(),
      'prisma',
      'migrations',
      '20261025000000_init_supabase_schema',
      'migration.sql'
    );

    it('has identical, version-controlled SQL migrations for Supabase and Prisma', () => {
      expect(fs.existsSync(supabaseMigrationPath)).toBe(true);
      expect(fs.existsSync(prismaMigrationPath)).toBe(true);

      const supabaseSql = fs.readFileSync(supabaseMigrationPath, 'utf-8');
      const prismaSql = fs.readFileSync(prismaMigrationPath, 'utf-8');

      expect(supabaseSql).toBe(prismaSql);
    });

    it('enables PostGIS and UUID extensions in migration DDL', () => {
      const sql = fs.readFileSync(supabaseMigrationPath, 'utf-8');

      expect(sql).toMatch(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp"/i);
      expect(sql).toMatch(/CREATE EXTENSION IF NOT EXISTS "postgis"/i);
    });

    it('configures PostGIS spatial geometry columns and GIST indexes', () => {
      const sql = fs.readFileSync(supabaseMigrationPath, 'utf-8');

      // Jurisdictions multi-polygon boundary and GIST index
      expect(sql).toMatch(/boundary geometry\(MultiPolygon, 4326\)/i);
      expect(sql).toMatch(/CREATE INDEX idx_jurisdictions_geom ON jurisdictions USING GIST\(boundary\)/i);

      // Complaints point location and GIST index
      expect(sql).toMatch(/location_coords geometry\(Point, 4326\) NOT NULL/i);
      expect(sql).toMatch(/CREATE INDEX idx_complaints_geo ON complaints USING GIST\(location_coords\)/i);

      // Evidence capture coords
      expect(sql).toMatch(/capture_coords geometry\(Point, 4326\)/i);
    });

    it('enforces foreign key constraints and cascade rules', () => {
      const sql = fs.readFileSync(supabaseMigrationPath, 'utf-8');

      expect(sql).toMatch(/REFERENCES jurisdictions\(id\) ON DELETE RESTRICT/i);
      expect(sql).toMatch(/REFERENCES departments\(id\) ON DELETE RESTRICT/i);
      expect(sql).toMatch(/REFERENCES complaints\(id\) ON DELETE CASCADE/i);
    });
  });

  // =========================================================================
  // 3. Pilot Seed Data Integrity & Relational Hierarchy
  // =========================================================================
  describe('Canonical Seed Data Integrity', () => {
    const seedSqlPath = path.join(process.cwd(), 'supabase', 'seed.sql');
    const seedTsPath = path.join(process.cwd(), 'prisma', 'seed.ts');

    it('provides both prisma/seed.ts and supabase/seed.sql', () => {
      expect(fs.existsSync(seedSqlPath)).toBe(true);
      expect(fs.existsSync(seedTsPath)).toBe(true);
    });

    it('contains Pune Municipal Corporation and 4 administrative zones', () => {
      const sql = fs.readFileSync(seedSqlPath, 'utf-8');

      expect(sql).toContain('Pune Municipal Corporation');
      expect(sql).toContain('PMC-01');
      expect(sql).toContain('PMC-Z01'); // Zone 1
      expect(sql).toContain('PMC-Z02'); // Zone 2
      expect(sql).toContain('PMC-Z03'); // Zone 3
      expect(sql).toContain('PMC-Z04'); // Zone 4
    });

    it('contains all 16 electoral wards with valid zone foreign keys', () => {
      const sql = fs.readFileSync(seedSqlPath, 'utf-8');

      const expectedWardCodes = [
        'PUN-Z01-W01',
        'PUN-Z01-W02',
        'PUN-Z01-W12',
        'PUN-Z01-W13',
        'PUN-Z02-W28',
        'PUN-Z02-W07',
        'PUN-Z02-W14',
        'PUN-Z02-W15',
        'PUN-Z03-W08',
        'PUN-Z03-W09',
        'PUN-Z03-W10',
        'PUN-Z03-W11',
        'PUN-Z04-W04',
        'PUN-Z04-W05',
        'PUN-Z04-W06',
        'PUN-Z04-W16',
      ];

      for (const code of expectedWardCodes) {
        expect(sql).toContain(code);
      }
    });

    it('contains all 5 civic departments', () => {
      const sql = fs.readFileSync(seedSqlPath, 'utf-8');

      expect(sql).toContain('ROAD_MAINTENANCE');
      expect(sql).toContain('ELECTRICAL_LIGHTING');
      expect(sql).toContain('WATER_SEWERAGE');
      expect(sql).toContain('SOLID_WASTE');
      expect(sql).toContain('PARKS_HORTICULTURE');
    });

    it('contains all 6 civic complaint categories with SLA policies', () => {
      const sql = fs.readFileSync(seedSqlPath, 'utf-8');

      expect(sql).toContain('CAT_POTHOLE');
      expect(sql).toContain('CAT_STREETLIGHT');
      expect(sql).toContain('CAT_WATER_LEAK');
      expect(sql).toContain('CAT_GARBAGE');
      expect(sql).toContain('CAT_PAVER_BLOCKS');
      expect(sql).toContain('CAT_DRAIN_GRATES');
    });

    it('seeds users across all required administrative roles', () => {
      const sql = fs.readFileSync(seedSqlPath, 'utf-8');

      expect(sql).toContain('PLATFORM_ADMIN');
      expect(sql).toContain('OFFICER');
      expect(sql).toContain('SUPERVISOR');
      expect(sql).toContain('FIELD_WORKER');
      expect(sql).toContain('CITIZEN');

      // Specific pilot staff members
      expect(sql).toContain('Rajesh Sharma (Platform Administrator)');
      expect(sql).toContain('Sunita Patil (Ward 28 Triage Officer)');
      expect(sql).toContain('Vikram Singh (Road Crew Lead #4)');
      expect(sql).toContain('Aarav Mehta (Registered Citizen)');
    });

    it('seeds pilot complaints matching frontend tracker references', () => {
      const sql = fs.readFileSync(seedSqlPath, 'utf-8');

      expect(sql).toContain('GOV-2026-00482');
      expect(sql).toContain('GOV-2026-00483');
      expect(sql).toContain('ST_SetSRID(ST_MakePoint(73.8112, 18.5089), 4326)');
    });
  });

  // =========================================================================
  // 4. Supabase Configuration & Secrets Guard
  // =========================================================================
  describe('Supabase Configuration & Secrets Hygiene', () => {
    it('has supabase/config.toml configured for local/managed environment', () => {
      const configPath = path.join(process.cwd(), 'supabase', 'config.toml');
      expect(fs.existsSync(configPath)).toBe(true);

      const toml = fs.readFileSync(configPath, 'utf-8');
      expect(toml).toContain('[api]');
      expect(toml).toContain('[db]');
      expect(toml).toContain('[db.pooler]');
    });

    it('documents Supabase connection pooling and direct migration URLs in .env.example', () => {
      const envExamplePath = path.join(process.cwd(), '.env.example');
      const envExample = fs.readFileSync(envExamplePath, 'utf-8');

      expect(envExample).toContain('DATABASE_URL');
      expect(envExample).toContain('DIRECT_URL');
      expect(envExample).toContain('NEXT_PUBLIC_SUPABASE_URL');
      expect(envExample).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
      expect(envExample).toContain('SUPABASE_SERVICE_ROLE_KEY');

      // Ensure no real passwords or live project keys are committed
      expect(envExample).toContain('[YOUR-PROJECT-REF]');
      expect(envExample).toContain('[YOUR-PASSWORD]');
      expect(envExample).not.toMatch(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]{30,}\.[a-zA-Z0-9_-]{30,}/);
    });

    it('ensures .gitignore prevents .env and .env.local from being tracked', () => {
      const gitignorePath = path.join(process.cwd(), '.gitignore');
      const gitignore = fs.readFileSync(gitignorePath, 'utf-8');

      expect(gitignore).toMatch(/\.env/);
      expect(gitignore).toMatch(/\.env\*\.local/);
    });
  });
});
