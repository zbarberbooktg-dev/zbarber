// Same validity rules as mobile discovery: zero is a real coordinate.
export function hasSalonPosition(latitude: unknown, longitude: unknown): boolean {
  const validNumber = (value: unknown) =>
    (typeof value === "number" || (typeof value === "string" && value.trim() !== ""))
    && Number.isFinite(Number(value));
  return validNumber(latitude) && validNumber(longitude)
    && Math.abs(Number(latitude)) <= 90 && Math.abs(Number(longitude)) <= 180;
}
