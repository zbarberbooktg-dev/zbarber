import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "crypto";

// ── Mocks ────────────────────────────────────────────────────────────────
// Clerk: drive the authenticated user from a test header so we can act as
// different barbers (or no one) without a real Clerk session. Users are
// pre-seeded by clerkUserId, so clerkClient.users.getUser is never reached.
vi.mock("@clerk/express", () => ({
  getAuth: (req: { headers: Record<string, string | undefined> }) => ({
    userId: req.headers["x-test-clerk-user"] ?? null,
  }),
  clerkClient: { users: { getUser: vi.fn() } },
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Object storage: we only need ACL decisions (200 vs 401/403), not real bytes.
vi.mock("../src/lib/objectStorage", () => {
  class ObjectNotFoundError extends Error {}
  class ObjectStorageService {
    async getObjectEntityUploadURL() { return "https://example.com/upload"; }
    normalizeObjectEntityPath(_url: string) { return "/objects/uploads/mock"; }
    async searchPublicObject() { return null; }
    async getObjectEntityFile(_path: string) { return { name: "mock" }; }
    async downloadObject(_file: unknown) {
      return { status: 200, headers: new Headers(), body: null as ReadableStream | null };
    }
  }
  return { ObjectStorageService, ObjectNotFoundError };
});

// Email + push are fire-and-forget side effects — silence them.
vi.mock("../src/lib/email", () => ({
  notifyAdmin: vi.fn(),
  sendEmail: vi.fn(async () => {}),
  renderEmail: vi.fn(() => ({ html: "", text: "" })),
}));
vi.mock("../src/lib/push", () => ({ sendPush: vi.fn(async () => {}) }));

// ── Imports that depend on the mocks above ───────────────────────────────
const { db, barbersTable, usersTable, adminAccountsTable, pool } = await import("@workspace/db");
const { eq } = await import("drizzle-orm");
const barbersRouter = (await import("../src/routes/barbers")).default;
const storageRouter = (await import("../src/routes/storage")).default;
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
  app.use("/api", storageRouter);
  return app;
}

const app = buildApp();

// Seeded fixtures
let adminId: number;
let adminCookie: string;
let userAId: number; // owner of barberA (happy path)
let userBId: number; // owner of barberB (document-reject path)
const clerkA = `test_clerk_${randomUUID()}`;
const clerkB = `test_clerk_${randomUUID()}`;
let barberAId: number;
let barberBId: number;

const DOC_A = `/objects/uploads/${randomUUID()}.pdf`;
const DOC_B = `/objects/uploads/${randomUUID()}.pdf`;

const asAdmin = (r: request.Test) => r.set("Cookie", adminCookie);
const asClerk = (r: request.Test, clerkId: string) => r.set("x-test-clerk-user", clerkId);

beforeAll(async () => {
  const [admin] = await db.insert(adminAccountsTable).values({
    email: `test-admin-${randomUUID()}@example.com`,
    passwordHash: "x", name: "Test Admin", isRoot: false,
    mustChangePassword: false, status: "active",
  }).returning();
  adminId = admin!.id;
  adminCookie = `${ADMIN_COOKIE_NAME}=${signAdminToken(adminId)}`;

  const [ua] = await db.insert(usersTable).values({
    clerkUserId: clerkA, name: "Barber A", email: `barberA-${randomUUID()}@example.com`,
    role: "client", status: "active",
  }).returning();
  userAId = ua!.id;
  const [ub] = await db.insert(usersTable).values({
    clerkUserId: clerkB, name: "Barber B", email: `barberB-${randomUUID()}@example.com`,
    role: "client", status: "active",
  }).returning();
  userBId = ub!.id;

  const [ba] = await db.insert(barbersTable).values({
    userId: userAId, salonName: "Salon A", city: "Kinshasa", status: "pending",
  }).returning();
  barberAId = ba!.id;
  const [bb] = await db.insert(barbersTable).values({
    userId: userBId, salonName: "Salon B", city: "Lubumbashi", status: "pending",
  }).returning();
  barberBId = bb!.id;
});

afterAll(async () => {
  await db.delete(barbersTable).where(eq(barbersTable.id, barberAId));
  await db.delete(barbersTable).where(eq(barbersTable.id, barberBId));
  await db.delete(usersTable).where(eq(usersTable.id, userAId));
  await db.delete(usersTable).where(eq(usersTable.id, userBId));
  await db.delete(adminAccountsTable).where(eq(adminAccountsTable.id, adminId));
  await pool.end();
});

describe("Two-step barber verification flow", () => {
  it("rejects a non-admin first-validate attempt (401)", async () => {
    const res = await asClerk(request(app).patch(`/api/barbers/${barberAId}/first-validate`), clerkA);
    expect(res.status).toBe(401);
  });

  it("admin first-validate: pending → awaiting_document with 30d deadline + role flip", async () => {
    const res = await asAdmin(request(app).patch(`/api/barbers/${barberAId}/first-validate`));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("awaiting_document");
    expect(res.body.firstValidatedAt).toBeTruthy();
    expect(res.body.documentDeadline).toBeTruthy();

    const deltaMs = new Date(res.body.documentDeadline).getTime() - new Date(res.body.firstValidatedAt).getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    expect(deltaMs / dayMs).toBeGreaterThan(29.5);
    expect(deltaMs / dayMs).toBeLessThan(30.5);

    // Role flips to barber at FIRST validation (so the owner can reach upload).
    const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, userAId)).limit(1);
    expect(owner!.role).toBe("barber");
  });

  it("first-validate again on a non-pending barber returns 409", async () => {
    const res = await asAdmin(request(app).patch(`/api/barbers/${barberAId}/first-validate`));
    expect(res.status).toBe(409);
  });

  it("cannot final-approve before a document is submitted (409)", async () => {
    const res = await asAdmin(request(app).patch(`/api/barbers/${barberAId}/approve`));
    expect(res.status).toBe(409);
  });

  it("barber uploads the authorization document", async () => {
    const res = await asClerk(
      request(app).post(`/api/barbers/me/document`).send({ documentUrl: DOC_A }),
      clerkA,
    );
    expect(res.status).toBe(200);
    expect(res.body.documentUrl).toBe(DOC_A);
    expect(res.body.documentSubmittedAt).toBeTruthy();
    expect(res.body.status).toBe("awaiting_document");
  });

  it("the owning barber can view their own document (ACL)", async () => {
    const res = await asClerk(request(app).get(`/api${DOC_A}`.replace("/objects/", "/storage/objects/")), clerkA);
    expect(res.status).toBe(200);
  });

  it("admin can view the private document (ACL)", async () => {
    const res = await asAdmin(request(app).get(`/api${DOC_A}`.replace("/objects/", "/storage/objects/")));
    expect(res.status).toBe(200);
  });

  it("a different barber cannot fetch another barber's document (ACL 403)", async () => {
    const res = await asClerk(request(app).get(`/api${DOC_A}`.replace("/objects/", "/storage/objects/")), clerkB);
    expect(res.status).toBe(403);
  });

  it("an unauthenticated request cannot fetch the private document (ACL 401)", async () => {
    const res = await request(app).get(`/api${DOC_A}`.replace("/objects/", "/storage/objects/"));
    expect(res.status).toBe(401);
  });

  it("admin final-approve: awaiting_document → approved", async () => {
    const res = await asAdmin(request(app).patch(`/api/barbers/${barberAId}/approve`));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("approved");

    const [b] = await db.select().from(barbersTable).where(eq(barbersTable.id, barberAId)).limit(1);
    expect(b!.status).toBe("approved");
  });

  it("document-reject records a note and keeps awaiting_document", async () => {
    // Set up barberB through first-validate + upload.
    await asAdmin(request(app).patch(`/api/barbers/${barberBId}/first-validate`)).expect(200);
    await asClerk(request(app).post(`/api/barbers/me/document`).send({ documentUrl: DOC_B }), clerkB).expect(200);

    const reason = "Document illisible";
    const res = await asAdmin(
      request(app).patch(`/api/barbers/${barberBId}/document/reject`).send({ reason }),
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("awaiting_document");
    expect(res.body.documentReviewNote).toBe(reason);
    expect(res.body.documentUrl).toBeNull();

    // The rejected document path is no longer referenced → ACL refuses it (404,
    // not a leak): the row's documentUrl was cleared.
    const ghost = await asAdmin(request(app).get(`/api${DOC_B}`.replace("/objects/", "/storage/objects/")));
    expect(ghost.status).toBe(404);
  });
});
