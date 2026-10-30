import { NextRequest, NextResponse } from 'next/server';

/**
 * Reverse Geocoding API Route for GovAsset
 *
 * Converts GPS coordinates (latitude, longitude) into a readable civic street address
 * using OpenStreetMap Nominatim. Operates server-side to prevent exposing client keys
 * and enforce strict timeout and error boundaries without client CORS limitations.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get('lat');
  const lngStr = searchParams.get('lng');

  if (!latStr || !lngStr) {
    return NextResponse.json(
      { success: false, error: 'Both latitude (lat) and longitude (lng) parameters are required.' },
      { status: 400 }
    );
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json(
      { success: false, error: 'Invalid coordinate range. Latitude must be -90..90 and longitude -180..180.' },
      { status: 400 }
    );
  }

  try {
    const nominatimUrl = new URL('https://nominatim.openstreetmap.org/reverse');
    nominatimUrl.searchParams.set('format', 'jsonv2');
    nominatimUrl.searchParams.set('lat', lat.toString());
    nominatimUrl.searchParams.set('lon', lng.toString());
    nominatimUrl.searchParams.set('zoom', '18');
    nominatimUrl.searchParams.set('addressdetails', '1');

    // Abort controller with 5-second timeout to handle slow mobile network hops
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(nominatimUrl.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'GovAsset-CivicPlatform/1.0 (https://govasset.in; civic-tech@govasset.in)',
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Reverse geocoding provider returned HTTP status ${response.status}`,
          address: null,
        },
        { status: response.status >= 500 ? 502 : 400 }
      );
    }

    const data = await response.json();

    if (!data || data.error) {
      return NextResponse.json({
        success: false,
        error: data?.error || 'No readable address found for coordinates.',
        address: null,
      });
    }

    const addr = data.address || {};

    // Extract address components in logical civic priority:
    // 1. Street / Road / Landmark
    const street =
      addr.road ||
      addr.pedestrian ||
      addr.suburb ||
      addr.neighbourhood ||
      addr.residential ||
      addr.amenity ||
      addr.building ||
      '';

    // 2. Area / Neighborhood
    const area =
      addr.suburb ||
      addr.neighbourhood ||
      addr.city_district ||
      addr.quarter ||
      '';

    // 3. City / Town / Taluka
    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      '';

    // 4. District
    const district =
      addr.state_district ||
      addr.county ||
      addr.district ||
      city ||
      '';

    // 5. State / Region
    const state = addr.state || addr.region || '';

    // 6. Postal Code
    const postcode = addr.postcode || '';

    // Format readable address string
    const parts: string[] = [];
    if (street) parts.push(street);
    if (area && area !== street) parts.push(area);
    if (city && city !== area) parts.push(city);
    if (district && district !== city) parts.push(district);
    if (state) parts.push(state);
    if (postcode) parts.push(postcode);

    const formattedAddress = parts.length > 0 ? parts.join(', ') : data.display_name || '';

    return NextResponse.json({
      success: true,
      address: formattedAddress,
      displayName: data.display_name || formattedAddress,
      components: {
        street,
        area,
        city,
        district,
        state,
        postcode,
      },
    });
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError';
    return NextResponse.json(
      {
        success: false,
        error: isTimeout
          ? 'Reverse geocoding request timed out after 5 seconds.'
          : 'Failed to connect to reverse geocoding service.',
        address: null,
      },
      { status: 503 }
    );
  }
}
