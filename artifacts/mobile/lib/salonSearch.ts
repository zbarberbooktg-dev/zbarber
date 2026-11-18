export type Coordinates = { lat: number; lng: number };

export function coordinates(latitude: unknown, longitude: unknown): Coordinates | null {
  if (latitude == null || longitude == null
    || !["number", "string"].includes(typeof latitude) || !["number", "string"].includes(typeof longitude)
    || (typeof latitude === "string" && !latitude.trim())
    || (typeof longitude === "string" && !longitude.trim())) return null;
  const lat = Number(latitude), lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export function haversineKm(a: Coordinates, b: Coordinates): number {
  const radians = Math.PI / 180;
  const s = Math.sin((b.lat - a.lat) * radians / 2) ** 2
    + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin((b.lng - a.lng) * radians / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, s))));
}

export function nearbySalons<T extends { id: number; latitude?: unknown; longitude?: unknown }>(
  salons: T[], origin: Coordinates | null, radius: number | null,
): Array<T & { _km: number | null }> {
  if (!origin && radius !== null) return [];
  return salons.flatMap((salon) => {
    const point = coordinates(salon.latitude, salon.longitude);
    if (!point) return [];
    const km = origin ? haversineKm(origin, point) : null;
    return radius === null || (km !== null && km <= radius) ? [{ ...salon, _km: km }] : [];
  }).sort((a, b) => (a._km ?? Infinity) - (b._km ?? Infinity) || a.id - b.id);
}

export function newestRegisteredSalons<T extends { id: number; createdAt: string | Date }>(salons: T[], limit = 20): T[] {
  const stamp = (s: T) => new Date(s.createdAt).getTime() || 0;
  return [...salons].sort((a, b) => stamp(b) - stamp(a) || b.id - a.id).slice(0, limit);
}
