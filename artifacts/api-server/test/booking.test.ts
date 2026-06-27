import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "crypto";

// ── Mocks ────────────────────────────────────────────────────────────────
// Clerk: drive the authenticated user from a test header so we can act as the
// client, the barber owner, or no one. Users are pre-seeded by clerkUserId so
// clerkClient.users.getUser is never reached.
vi.mock("@clerk/express", () => ({
  getAuth: (req: { headers: Record<string, string | undefined> }) => ({
    userId: req.headers["x-test-clerk-user"] ?? null,
  }),
  clerkClient: { users: { getUser: vi.fn() } },
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Email + push are fire-and-forget side effects — silence them.
vi.mock("../src/lib/email", () => ({
  notifyAdmin: vi.fn(),
  sendEmail: vi.fn(async () => {}),
  renderEmail: vi.fn(() => ({ html: "", text: "" })),
}));
vi.mock("../src/lib/push", () => ({ sendPush: vi.fn(async () => {}) }));

// ── Imports that depend on the mocks above ───────────────────────────────
const { db, barbersTable, usersTable, servicesTable, schedulesTable, daysOffTable, reservationsTable, adminAccountsTable, pool } =
  await import("@workspace/db");
const { eq, inArray } = await import("drizzle-orm");
const barbersRouter = (await import("../src/routes/barbers")).default;
const reservationsRouter = (await import("../src/routes/reservations")).default;
const { signAdminToken, ADMIN_COOKIE_NAME } = await import("../src/lib/adminAuth");

function buildApp(): Express {
  const app = express();
  app.use((req, _res, next) => {
    const noop = () => {};
    (req as unknown as { log: Record<string, unknown> }).log = {
      info: noop, warn: noop, error: noop, debug: noop, child() { return this; },
    };
    next();
  });
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", barbersRouter);
  app.use("/api", reservationsRouter);
  return app;
}

const app = buildApp();

const asClerk = (r: request.Test, clerkId: string) => r.set("x-test-clerk-user", clerkId);
const asAdmin = (r: request.Test) => r.set("Cookie", adminCookie);

// Seeded fixtures
let adminId: number;
let adminCookie: string;
let clientId: number;
let barberOwnerId: number;
let barberId: number;
let serviceId: number;
const clerkClient = `test_clerk_${randomUUID()}`;
const clerkBarber = `test_clerk_${randomUUID()}`;

// Weekly hours seeded for the barber: every day worked 09:00–12:00, no break.
const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const SERVICE_DURATION = 60;

// Helper: a YYYY-MM-DD that is `offsetDays` from today (UTC), safely in the
// future so generated slots are never marked "past".
function futureYmd(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
// Build the exact UTC instant the availability endpoint emits for a slot: the
// date at 00:00 UTC plus `minutes` (e.g. 09:00 → 540).
function slotInstant(ymd: string, minutes: number): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 0, minutes, 0, 0));
}

const DATE_PLAIN = futureYmd(30); // availability shape (3 slots)
const DATE_BOOKED = futureYmd(31); // one slot taken
const DATE_OFF = futureYmd(32); // whole day blocked
const DATE_DOUBLE = futureYmd(33); // double-booking POST flow
const DATE_STATUS = futureYmd(34); // status-transition rules

beforeAll(async () => {
  const [admin] = await db.insert(adminAccountsTable).values({
    email: `test-admin-${randomUUID()}@example.com`,
    passwordHash: "x", name: "Test Admin", isRoot: false,
    mustChangePassword: false, status: "active",
  }).returning();
  adminId = admin!.id;
  adminCookie = `${ADMIN_COOKIE_NAME}=${signAdminToken(adminId)}`;

  const [client] = await db.insert(usersTable).values({
    clerkUserId: clerkClient, name: "Booking Client", email: `client-${randomUUID()}@example.com`,
    role: "client", status: "active",
  }).returning();
  clientId = client!.id;

  const [owner] = await db.insert(usersTable).values({
    clerkUserId: clerkBarber, name: "Barber Owner", email: `owner-${randomUUID()}@example.com`,
    role: "barber", status: "active",
  }).returning();
  barberOwnerId = owner!.id;

  const [barber] = await db.insert(barbersTable).values({
    userId: barberOwnerId, salonName: "Salon Booking", city: "Kinshasa", status: "approved",
  }).returning();
  barberId = barber!.id;

  const [service] = await db.insert(servicesTable).values({
    barberId, name: "Coupe", price: 10, durationMinutes: SERVICE_DURATION, isActive: true,
  }).returning();
  serviceId = service!.id;

  // Weekly hours: every day worked 09:00–12:00 so any chosen future date works.
  await db.insert(schedulesTable).values(
    DOW.map((day) => ({ barberId, day, isWorking: true, startTime: "09:00", endTime: "12:00" })),
  );

  // DATE_BOOKED: a confirmed reservation occupies the 10:00 slot.
  await db.insert(reservationsTable).values({
    clientId, barberId, serviceId, scheduledAt: slotInstant(DATE_BOOKED, 600), status: "confirmed",
  });

  // DATE_OFF: a day-off blocks the whole day.
  await db.insert(daysOffTable).values({ barberId, date: DATE_OFF });
});

afterAll(async () => {
  await db.delete(reservationsTable).where(eq(reservationsTable.barberId, barberId));
  await db.delete(daysOffTable).where(eq(daysOffTable.barberId, barberId));
  await db.delete(schedulesTable).where(eq(schedulesTable.barberId, barberId));
  await db.delete(servicesTable).where(eq(servicesTable.barberId, barberId));
  await db.delete(barbersTable).where(eq(barbersTable.id, barberId));
  await db.delete(usersTable).where(inArray(usersTable.id, [clientId, barberOwnerId]));
  await db.delete(adminAccountsTable).where(eq(adminAccountsTable.id, adminId));
  await pool.end();
});

type DayAvail = { date: string; isWorking: boolean; isBlocked: boolean; slots: Array<{ time: string; iso: string; available: boolean; reason?: string }> };
async function availability(from: string, to: string): Promise<DayAvail[]> {
  const res = await request(app).get(`/api/barbers/${barberId}/availability`).query({ from, to, serviceId: String(serviceId) });
  expect(res.status).toBe(200);
  return res.body as DayAvail[];
}

describe("Availability slot generation", () => {
  it("reflects weekly hours and service duration (09:00–12:00, 60-min step → 3 slots)", async () => {
    const [day] = await availability(DATE_PLAIN, DATE_PLAIN);
    expect(day!.isWorking).toBe(true);
    expect(day!.isBlocked).toBe(false);
    expect(day!.slots.map((s) => s.time)).toEqual(["09:00", "10:00", "11:00"]);
    expect(day!.slots.every((s) => s.available)).toBe(true);
  });

  it("marks an already-booked slot unavailable (reason: booked)", async () => {
    const [day] = await availability(DATE_BOOKED, DATE_BOOKED);
    const ten = day!.slots.find((s) => s.time === "10:00");
    expect(ten?.available).toBe(false);
    expect(ten?.reason).toBe("booked");
    // The neighbouring slots remain open.
    expect(day!.slots.find((s) => s.time === "09:00")?.available).toBe(true);
    expect(day!.slots.find((s) => s.time === "11:00")?.available).toBe(true);
  });

  it("blocks an entire day marked as a day-off (no slots)", async () => {
    const [day] = await availability(DATE_OFF, DATE_OFF);
    expect(day!.isBlocked).toBe(true);
    expect(day!.slots).toEqual([]);
  });
});

describe("Booking — double-booking prevention", () => {
  const slot = () => slotInstant(DATE_DOUBLE, 540).toISOString(); // 09:00

  it("accepts the first booking on a free slot (201)", async () => {
    const res = await asClerk(
      request(app).post("/api/reservations").send({ barberId, serviceId, scheduledAt: slot() }),
      clerkClient,
    );
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
  });

  it("rejects a second booking on the same slot (409)", async () => {
    const res = await asClerk(
      request(app).post("/api/reservations").send({ barberId, serviceId, scheduledAt: slot() }),
      clerkClient,
    );
    expect(res.status).toBe(409);
  });

  it("frees the slot once the first booking is cancelled", async () => {
    // Cancel the existing booking, then the same slot can be booked again.
    const list = await asClerk(request(app).get("/api/reservations"), clerkClient);
    const existing = (list.body.data as Array<{ id: number; scheduledAt: string }>)
      .find((r) => new Date(r.scheduledAt).toISOString() === slot());
    expect(existing).toBeTruthy();
    await asClerk(request(app).patch(`/api/reservations/${existing!.id}`).send({ status: "cancelled" }), clerkClient).expect(200);

    const res = await asClerk(
      request(app).post("/api/reservations").send({ barberId, serviceId, scheduledAt: slot() }),
      clerkClient,
    );
    expect(res.status).toBe(201);
  });
});

describe("Reservation status transitions", () => {
  let resId: number;

  beforeAll(async () => {
    const [r] = await db.insert(reservationsTable).values({
      clientId, barberId, serviceId, scheduledAt: slotInstant(DATE_STATUS, 540), status: "pending",
    }).returning();
    resId = r!.id;
  });

  it("a client cannot set a status other than cancelled (400)", async () => {
    const res = await asClerk(request(app).patch(`/api/reservations/${resId}`).send({ status: "confirmed" }), clerkClient);
    expect(res.status).toBe(400);
  });

  it("a barber can confirm a reservation on their own salon (200)", async () => {
    const res = await asClerk(request(app).patch(`/api/reservations/${resId}`).send({ status: "confirmed" }), clerkBarber);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("confirmed");
  });

  it("an admin can set any status, e.g. completed (200)", async () => {
    const res = await asAdmin(request(app).patch(`/api/reservations/${resId}`).send({ status: "completed" }));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("completed");
  });

  it("a client can cancel their own future reservation (200)", async () => {
    const [r] = await db.insert(reservationsTable).values({
      clientId, barberId, serviceId, scheduledAt: slotInstant(DATE_STATUS, 660), status: "pending",
    }).returning();
    const res = await asClerk(request(app).patch(`/api/reservations/${r!.id}`).send({ status: "cancelled" }), clerkClient);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
  });
});
