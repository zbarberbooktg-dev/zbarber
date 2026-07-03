import { describe, it, expect, vi } from "vitest";
import request from "supertest";

// Simulate a request carrying a malformed/unverifiable Bearer token:
//  - clerkMiddleware surfaces the failure via next(err) (as @clerk/express does)
//  - getAuth throws when asked to read the auth state
// The app must NOT turn either into a raw HTML 500. Public routes keep serving,
// protected routes cleanly 401. Guards this exact regression: the mobile map
// (GET /api/barbers via useAuthedFetch, token attached) once showed a raw
// "Internal Server Error" HTML dialog.
vi.mock("@clerk/express", () => ({
  getAuth: () => {
    throw new Error("invalid token");
  },
  clerkClient: { users: { getUser: vi.fn() } },
  clerkMiddleware:
    () =>
    (_req: unknown, _res: unknown, next: (err?: unknown) => void) =>
      next(new Error("bad token")),
}));

// Fire-and-forget side effects — silence them.
vi.mock("../src/lib/email", () => ({
  notifyAdmin: vi.fn(),
  sendEmail: vi.fn(async () => {}),
  renderEmail: vi.fn(() => ({ html: "", text: "" })),
}));
vi.mock("../src/lib/push", () => ({ sendPush: vi.fn(async () => {}) }));

const app = (await import("../src/app")).default;

describe("API resilience to invalid Clerk tokens", () => {
  it("serves the public /api/barbers list even when the token is invalid", async () => {
    const res = await request(app)
      .get("/api/barbers?status=approved&limit=100")
      .set("Authorization", "Bearer bogus.token.here");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("returns clean JSON 401 (not HTML 500) on a protected route with an invalid token", async () => {
    const res = await request(app)
      .get("/api/barbers/me")
      .set("Authorization", "Bearer bogus.token.here");
    expect(res.status).toBe(401);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });
});
