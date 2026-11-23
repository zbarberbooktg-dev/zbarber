import { describe, expect, test } from "vitest";
import { salonReservationHref } from "../lib/reservationRoute";

describe("salonReservationHref", () => {
  test("builds an internal reservation route for a valid salon id", () => {
    expect(salonReservationHref("123")).toEqual({
      pathname: "/salon/[id]/reservation",
      params: { id: "123" },
    });
  });

  test.each([undefined, ["1"], "", "0", "-1", "1/../../profile", "2147483648"])(
    "rejects an invalid salon id: %s",
    (id) => expect(salonReservationHref(id)).toBeNull(),
  );
});
