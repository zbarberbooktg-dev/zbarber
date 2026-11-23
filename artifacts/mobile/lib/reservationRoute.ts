/** Only accept a salon ID, never a user-provided redirect URL. */
export function salonReservationHref(id: unknown) {
  if (typeof id !== "string" || !/^[1-9]\d{0,9}$/.test(id) || Number(id) > 2147483647) return null;
  return { pathname: "/salon/[id]/reservation" as const, params: { id } };
}
