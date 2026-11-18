import { expect, test } from "vitest";
import { coordinates, haversineKm, nearbySalons, newestRegisteredSalons } from "../lib/salonSearch";

const origin = { lat: 0, lng: 0 };
const salons = [1, 4, 8, 20, 40, 70].map((km, i) => ({ id: i + 1, latitude: 0, longitude: km / (Math.PI * 6371 / 180) }));
test("validates real coordinate pairs without discarding zero", () => {
  expect(coordinates(0, 0)).toEqual(origin);
  expect(coordinates("0", "1.2")).toEqual({ lat: 0, lng: 1.2 });
  for (const pair of [[null, 0], ["", 0], [false, true], [91, 0], [0, 181], ["NaN", 0]]) expect(coordinates(...pair)).toBeNull();
});
test.each([[2, 1], [5, 2], [10, 3], [25, 4], [50, 5]])("a %s km radius finds the actual nearby salons", (radius, count) => {
  expect(nearbySalons([...salons].reverse(), origin, radius).map((b) => b.id)).toEqual(salons.slice(0, count).map((b) => b.id));
});
test("all salons ignores the radius, but excludes missing or invalid coordinates", () => {
  const all = [...salons, { id: 9, latitude: null, longitude: null }, { id: 10, latitude: 95, longitude: 0 }];
  expect(nearbySalons(all, origin, null)).toHaveLength(6);
  expect(nearbySalons(all, null, null)).toHaveLength(6);
  expect(nearbySalons(all, null, 50)).toEqual([]);
});
test("distance remains finite for identical and antipodal points", () => {
  expect(haversineKm(origin, origin)).toBe(0);
  expect(haversineKm(origin, { lat: 0, lng: 1 })).toBeCloseTo(111.195, 2);
  expect(haversineKm(origin, { lat: 0, lng: 180 })).toBeCloseTo(Math.PI * 6371, 5);
});
test("the newest 20 use registration dates across the whole catalog, not ID or approval order", () => {
  const all = Array.from({ length: 125 }, (_, i) => ({ id: 125 - i, createdAt: new Date(2026, 0, i + 1).toISOString() }));
  const snapshot = [...all];
  expect(newestRegisteredSalons(all).map((b) => b.id)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  expect(all).toEqual(snapshot);
});
test("equal registration dates have a stable newest-ID-first order", () => {
  expect(newestRegisteredSalons([1, 3, 2].map((id) => ({ id, createdAt: "2026-01-01T00:00:00Z" }))).map((b) => b.id)).toEqual([3, 2, 1]);
});
