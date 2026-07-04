// Geographic helpers for the at-home ("à domicile") service.

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Great-circle (straight-line) distance in kilometres between two lat/lng points.
// Used to place a client's location inside the barber's radius-based fee zones.
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export type FeeZone = { maxRadiusKm: number; fee: number };

// Match a distance to the SMALLEST zone whose maxRadiusKm >= distance. Returns
// null when the distance is beyond the largest zone (out of range).
export function matchZone<T extends FeeZone>(zones: T[], distanceKm: number): T | null {
  const sorted = [...zones].sort((a, b) => a.maxRadiusKm - b.maxRadiusKm);
  for (const z of sorted) {
    if (distanceKm <= z.maxRadiusKm) return z;
  }
  return null;
}
