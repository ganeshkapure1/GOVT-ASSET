/**
 * Geospatial Utilities for Proximity Validation & Distance Calculations
 */

/**
 * Standard geofence threshold for field worker repair verification (200 meters).
 */
export const GPS_PROXIMITY_THRESHOLD_METERS = 200;

export interface GpsProximityResult {
  distanceMeters: number | null;
  status: 'VERIFIED' | 'WARNING_EXCEEDS_THRESHOLD' | 'LOCATION_UNAVAILABLE' | 'COARSE_ACCURACY';
  isWithinThreshold: boolean;
  message: string;
}

/**
 * Calculates great-circle distance between two GPS coordinates using the Haversine formula.
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Compares worker GPS location against defect coordinates and returns advisory feedback.
 *
 * POLICY NOTE:
 * A proximity warning alone (> 200m) does not constitute proof of fraud and does not
 * block legitimate work submissions (e.g., pipeline or roadway works spanning extended corridors).
 */
export function evaluateGpsProximity(
  workerCoords: { latitude?: number | null; longitude?: number | null; accuracy?: number | null },
  targetCoords: { latitude: number; longitude: number }
): GpsProximityResult {
  const { latitude: wLat, longitude: wLng, accuracy } = workerCoords;
  const { latitude: tLat, longitude: tLng } = targetCoords;

  if (
    typeof wLat !== 'number' ||
    typeof wLng !== 'number' ||
    isNaN(wLat) ||
    isNaN(wLng) ||
    typeof tLat !== 'number' ||
    typeof tLng !== 'number' ||
    isNaN(tLat) ||
    isNaN(tLng)
  ) {
    return {
      distanceMeters: null,
      status: 'LOCATION_UNAVAILABLE',
      isWithinThreshold: false,
      message: 'Worker GPS coordinates unavailable or permission denied. Proceeding without geofence lock.',
    };
  }

  const distance = calculateHaversineDistanceMeters(wLat, wLng, tLat, tLng);
  const isCoarse = typeof accuracy === 'number' && accuracy > 150;

  if (distance <= GPS_PROXIMITY_THRESHOLD_METERS) {
    return {
      distanceMeters: distance,
      status: isCoarse ? 'COARSE_ACCURACY' : 'VERIFIED',
      isWithinThreshold: true,
      message: isCoarse
        ? `Coarse accuracy (±${Math.round(accuracy!)}m). Geofence approximated: ${distance}m from defect origin.`
        : `GPS Geofence Verified: ${distance}m from defect origin (PASS).`,
    };
  }

  return {
    distanceMeters: distance,
    status: 'WARNING_EXCEEDS_THRESHOLD',
    isWithinThreshold: false,
    message: `GPS Proximity Advisory: Photo captured ${distance}m from original defect (> ${GPS_PROXIMITY_THRESHOLD_METERS}m). Ensure you are at the correct site.`,
  };
}
