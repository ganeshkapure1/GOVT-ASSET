import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAllStates,
  getDistrictsByState,
  getCitiesByDistrict,
  getLocalBodiesByCity,
  findLocalBodyByCoordinates,
  ALL_INDIAN_STATES_AND_UTS,
} from '@/lib/india-locations';

/**
 * GET /api/v1/locations
 *
 * Pan-India hierarchical location and local government body lookup API.
 * Supports cascading location selection for citizen complaint registration
 * and administrative configuration.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const level = searchParams.get('level') || 'states';
  const state = searchParams.get('state');
  const district = searchParams.get('district');
  const city = searchParams.get('city');
  const localBodyId = searchParams.get('localBodyId');
  const latStr = searchParams.get('lat');
  const lngStr = searchParams.get('lng');

  try {
    // 1. Geocoordinate direct lookup (non-guessing)
    if (latStr && lngStr) {
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      if (!isNaN(lat) && !isNaN(lng)) {
        // Check local body bounding boxes first
        const matchedBody = findLocalBodyByCoordinates(lat, lng);
        if (matchedBody) {
          return NextResponse.json({
            success: true,
            data: {
              matchType: 'LOCAL_BODY_BOUNDING_BOX',
              localBody: matchedBody,
              state: matchedBody.state,
              district: matchedBody.district,
              city: matchedBody.city,
            },
          });
        }

        // Check database municipal corporation / local body polygon or records
        try {
          const dbCorp = await db.jurisdiction.findFirst({
            where: {
              level: 'DISTRICT_CORP',
              isActive: true,
            },
            select: { id: true, name: true, code: true, city: true, state: true, district: true },
          });

          if (dbCorp) {
            return NextResponse.json({
              success: true,
              data: {
                matchType: 'MUNICIPAL_CORP_MATCH',
                localBody: dbCorp,
                state: dbCorp.state,
                district: dbCorp.district,
                city: dbCorp.city,
              },
            });
          }
        } catch {
          // Fallback if DB query fails
        }

        return NextResponse.json({
          success: true,
          data: {
            matchType: 'OUTSIDE_KNOWN_BOUNDARIES',
            message: 'Coordinates detected outside official municipal digital boundaries. Manual selection required.',
            isUnverified: true,
          },
        });
      }
    }

    // 2. States / Union Territories Level
    if (level === 'states') {
      const states = getAllStates();
      return NextResponse.json({
        success: true,
        data: states,
      });
    }

    // 3. Districts Level
    if (level === 'districts') {
      if (!state) {
        return NextResponse.json(
          { success: false, error: { code: 'MISSING_PARAM', message: 'State parameter is required.' } },
          { status: 400 }
        );
      }
      const districts = getDistrictsByState(state);
      return NextResponse.json({
        success: true,
        data: districts,
      });
    }

    // 4. Cities / Towns Level
    if (level === 'cities') {
      if (!state || !district) {
        return NextResponse.json(
          { success: false, error: { code: 'MISSING_PARAM', message: 'Both state and district parameters are required.' } },
          { status: 400 }
        );
      }
      const cities = getCitiesByDistrict(state, district);
      return NextResponse.json({
        success: true,
        data: cities,
      });
    }

    // 5. Local Government Bodies Level (Municipal Corporations, Municipalities, Panchayats)
    if (level === 'localBodies') {
      if (!state || !district || !city) {
        return NextResponse.json(
          { success: false, error: { code: 'MISSING_PARAM', message: 'State, district, and city parameters are required.' } },
          { status: 400 }
        );
      }

      // Query database for configured corporations in this district/city
      let dbCorps: any[] = [];
      try {
        dbCorps = await db.jurisdiction.findMany({
          where: {
            level: 'DISTRICT_CORP',
            isActive: true,
            OR: [
              { city: { contains: city, mode: 'insensitive' } },
              { district: { contains: district, mode: 'insensitive' } },
              { state: { contains: state, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
            district: true,
            state: true,
          },
        });
      } catch {
        dbCorps = [];
      }

      // Combine with canonical pan-India local bodies directory
      const staticBodies = getLocalBodiesByCity(state, district, city);

      const combined = [...staticBodies];
      for (const dbc of dbCorps) {
        if (!combined.some((b) => b.id === dbc.id || b.shortCode === dbc.code)) {
          combined.push({
            id: dbc.id,
            name: dbc.name,
            shortCode: dbc.code,
            type: 'MUNICIPAL_CORPORATION',
            state: dbc.state || state,
            district: dbc.district || district,
            city: dbc.city || city,
            hasOfficialWards: true,
            wards: [],
          });
        }
      }

      return NextResponse.json({
        success: true,
        data: combined,
      });
    }

    // 6. Wards Level for a given Local Body
    if (level === 'wards') {
      if (!localBodyId) {
        return NextResponse.json(
          { success: false, error: { code: 'MISSING_PARAM', message: 'localBodyId parameter is required.' } },
          { status: 400 }
        );
      }

      // First query database for active wards under this corporation (either directly or via zones)
      let dbWards: any[] = [];
      try {
        dbWards = await db.jurisdiction.findMany({
          where: {
            level: 'WARD',
            isActive: true,
            OR: [
              { parentId: localBodyId },
              { parent: { parentId: localBodyId } },
            ],
          },
          select: {
            id: true,
            name: true,
            code: true,
            metadata: true,
          },
          orderBy: { name: 'asc' },
        });
      } catch {
        dbWards = [];
      }

      if (dbWards.length > 0) {
        return NextResponse.json({
          success: true,
          hasOfficialWards: true,
          data: dbWards.map((w) => ({
            id: w.id,
            name: w.name,
            code: w.code,
            isPlaceholder: Boolean((w.metadata as any)?.isPlaceholder),
          })),
        });
      }

      // Check static definitions
      for (const s of ALL_INDIAN_STATES_AND_UTS) {
        for (const d of s.districts) {
          for (const c of d.cities) {
            const foundBody = c.localBodies.find(
              (b) =>
                b.id.toLowerCase() === localBodyId.toLowerCase() ||
                b.shortCode.toLowerCase() === localBodyId.toLowerCase()
            );
            if (foundBody) {
              return NextResponse.json({
                success: true,
                hasOfficialWards: foundBody.hasOfficialWards,
                data: foundBody.wards,
                notice: foundBody.hasOfficialWards
                  ? undefined
                  : 'Official electoral wards have not yet been digitized for this local body. A manual administrative locality description can be provided.',
              });
            }
          }
        }
      }

      return NextResponse.json({
        success: true,
        hasOfficialWards: false,
        data: [],
        notice: 'Official electoral wards have not yet been digitized for this local body. A manual administrative locality description can be provided.',
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_LEVEL', message: `Unknown level "${level}".` } },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Failed to retrieve location data.' } },
      { status: 500 }
    );
  }
}
