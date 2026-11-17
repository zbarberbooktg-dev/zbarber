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
const { db, barbersTable, usersTable, adminAccountsTable, objectUploadsTable, pool } = await import("@workspace/db");
const { eq, inArray } = await import("drizzle-orm");
const barbersRouter = (await import("../src/routes/barbers")).default;
const storageRouter = (await import("../src/routes/storage")).default;
const authRouter = (await import("../src/routes/auth")).default;
const { renderEmail } = await import("../src/lib/email");
const { sendPush } = await import("../src/lib/push");
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
  app.use("/api", authRouter);
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
const DOC_A2 = `/objects/uploads/${randomUUID()}.pdf`;
const extraFixtures: { userId: number; barberId: number; clerkId: string }[] = [];

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

  // Bind each document path to its uploader. POST /barbers/me/document enforces
  // upload-ownership (anti path-claiming), so the legitimate flow requires the
  // path to be recorded in object_uploads for the submitting user.
  await db.insert(objectUploadsTable).values([
    { objectPath: DOC_A, userId: userAId },
    { objectPath: DOC_B, userId: userBId },
    { objectPath: DOC_A2, userId: userAId },
  ]);
  for (const status of ["awaiting_document", "awaiting_document", "rejected", "suspended"] as const) {
    const clerkId = `test_clerk_${randomUUID()}`;
    const [u] = await db.insert(usersTable).values({
      clerkUserId: clerkId, name: "Legacy salon owner", email: `optional-${randomUUID()}@example.com`,
      role: extraFixtures.length === 0 ? "client" : "barber", status: "active",
    }).returning();
    const [b] = await db.insert(barbersTable).values({
      userId: u!.id, salonName: `Legacy ${randomUUID()}`, city: "Kinshasa", status,
      documentDeadline: new Date(Date.now() - 60 * 86400000), documentReminderStage: 1,
    }).returning();
    extraFixtures.push({ userId: u!.id, barberId: b!.id, clerkId });
  }
});

afterAll(async () => {
  await db.delete(objectUploadsTable).where(eq(objectUploadsTable.objectPath, DOC_A));
  await db.delete(objectUploadsTable).where(eq(objectUploadsTable.objectPath, DOC_B));
  await db.delete(objectUploadsTable).where(eq(objectUploadsTable.objectPath, DOC_A2));
  await db.delete(barbersTable).where(inArray(barbersTable.id, extraFixtures.map((f) => f.barberId)));
  await db.delete(usersTable).where(inArray(usersTable.id, extraFixtures.map((f) => f.userId)));
  await db.delete(barbersTable).where(eq(barbersTable.id, barberAId));
  await db.delete(barbersTable).where(eq(barbersTable.id, barberBId));
  await db.delete(usersTable).where(eq(usersTable.id, userAId));
  await db.delete(usersTable).where(eq(usersTable.id, userBId));
  await db.delete(adminAccountsTable).where(eq(adminAccountsTable.id, adminId));
  await pool.end();
});

describe("Human salon approval with optional professional documents", () => {
  it("does not auto-approve existing salons or give pending owners barber access", async () => {
    const me = await asClerk(request(app).get("/api/auth/me"), clerkA).expect(200);
    expect(me.body.user.role).toBe("client");
    expect(me.body.barber.status).toBe("pending");
    await asClerk(request(app).get("/api/barbers/me/schedule"), clerkA).expect(403);
    const visible = await request(app).get("/api/barbers").query({ search: "Salon A", status: "approved" }).expect(200);
    expect(visible.body.data.some((b: { id: number }) => b.id === barberAId)).toBe(false);
  });

  it("requires an administrator for approval and document review", async () => {
    for (const action of ["approve", "first-validate", "document/reject"]) {
      await asClerk(request(app).patch(`/api/barbers/${barberAId}/${action}`), clerkA).expect(401);
    }
  });

  it("allows a pending client owner to supply an optional document without promotion", async () => {
    const r = await asClerk(request(app).post("/api/barbers/me/document").send({ documentUrl: DOC_B }), clerkB).expect(200);
    expect(r.body.status).toBe("pending");
    const me = await asClerk(request(app).get("/api/auth/me"), clerkB).expect(200);
    expect(me.body.user.role).toBe("client");
    await asClerk(request(app).get("/api/barbers/me/schedule"), clerkB).expect(403);
    const reviewed = await asAdmin(request(app).patch(`/api/barbers/${barberBId}/document/reject`).send({ reason: "À remplacer si souhaité" })).expect(200);
    expect(reviewed.body.status).toBe("pending");
    expect(reviewed.body.documentUrl).toBe(DOC_B);
  });

  it("approves pending directly without a document and grants visibility and access", async () => {
    const r = await asAdmin(request(app).patch(`/api/barbers/${barberAId}/approve`)).expect(200);
    expect(r.body.status).toBe("approved");
    expect(r.body.documentUrl).toBeNull();
    expect(r.body.documentDeadline).toBeNull();
    expect(r.body.firstValidatedAt).toBeTruthy();
    const me = await asClerk(request(app).post("/api/auth/sync").send({}), clerkA).expect(200);
    expect(me.body.user.role).toBe("barber");
    expect(me.body.barber.status).toBe("approved");
    await asClerk(request(app).get("/api/barbers/me/schedule"), clerkA).expect(200);
    const visible = await request(app).get("/api/barbers").query({ search: "Salon A", status: "approved" }).expect(200);
    expect(visible.body.data.some((b: { id: number }) => b.id === barberAId)).toBe(true);
  });

  it("legacy first-validate is a full human approval without creating a deadline", async () => {
    const r = await asAdmin(request(app).patch(`/api/barbers/${barberBId}/first-validate`)).expect(200);
    expect(r.body.status).toBe("approved");
    expect(r.body.documentDeadline).toBeNull();
    expect(r.body.documentUrl).toBe(DOC_B);
    expect(r.body.documentReviewNote).toBe("À remplacer si souhaité");
    for (const action of ["first-validate", "approve"]) {
      await asAdmin(request(app).patch(`/api/barbers/${barberBId}/${action}`)).expect(409);
    }
  });

  it("approves legacy awaiting_document salons even when their deadline expired, without a document", async () => {
    for (const f of extraFixtures.slice(0, 2)) {
      const r = await asAdmin(request(app).patch(`/api/barbers/${f.barberId}/approve`)).expect(200);
      expect(r.body.status).toBe("approved");
      expect(r.body.documentUrl).toBeNull();
      const me = await asClerk(request(app).get("/api/auth/me"), f.clerkId).expect(200);
      expect(me.body.user.role).toBe("barber");
      await asClerk(request(app).get("/api/barbers/me/schedule"), f.clerkId).expect(200);
    }
  });

  it("does not bypass legitimate rejected or suspended states", async () => {
    for (const f of extraFixtures.slice(2)) {
      for (const action of ["first-validate", "approve"]) {
        await asAdmin(request(app).patch(`/api/barbers/${f.barberId}/${action}`)).expect(409);
      }
      await asClerk(request(app).get("/api/barbers/me/schedule"), f.clerkId).expect(403);
      const [b] = await db.select().from(barbersTable).where(eq(barbersTable.id, f.barberId));
      expect(["rejected", "suspended"]).toContain(b!.status);
    }
  });

  it("uploads a private document after approval without changing status", async () => {
    const r = await asClerk(request(app).post("/api/barbers/me/document").send({ documentUrl: DOC_A }), clerkA).expect(200);
    expect(r.body.documentUrl).toBe(DOC_A);
    expect(r.body.documentSubmittedAt).toBeTruthy();
    expect(r.body.status).toBe("approved");
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

  it("rejects a path uploaded by another user or an unregistered path", async () => {
    for (const documentUrl of [DOC_B, `/objects/uploads/${randomUUID()}.pdf`, "https://example.com/id.pdf"]) {
      await asClerk(request(app).post("/api/barbers/me/document").send({ documentUrl }), clerkA).expect(400);
    }
    await asClerk(request(app).post("/api/barbers/me/document").query({ salonId: barberBId }).send({ documentUrl: DOC_A }), clerkA).expect(403);
  });

  it("rejecting an optional document preserves approval, role, visibility and the private file", async () => {
    const reason = "Document illisible";
    const res = await asAdmin(
      request(app).patch(`/api/barbers/${barberBId}/document/reject`).send({ reason }),
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("approved");
    expect(res.body.documentReviewNote).toBe(reason);
    expect(res.body.documentUrl).toBe(DOC_B);
    expect(res.body.documentSubmittedAt).toBeTruthy();
    await asClerk(request(app).get("/api/barbers/me/schedule"), clerkB).expect(200);
    const me = await asClerk(request(app).get("/api/auth/me"), clerkB).expect(200);
    expect(me.body.user.role).toBe("barber");
    const publicRows = await request(app).get("/api/barbers").query({ search: "Salon B", status: "approved" }).expect(200);
    expect(publicRows.body.data.some((b: { id: number }) => b.id === barberBId)).toBe(true);
    await asAdmin(request(app).get(`/api/storage${DOC_B}`)).expect(200);
    await asClerk(request(app).get(`/api/storage${DOC_B}`), clerkA).expect(403);
    await request(app).get(`/api/storage${DOC_B}`).expect(401);
  });

  it("allows replacement after approval and clears only the document review note", async () => {
    await asAdmin(request(app).patch(`/api/barbers/${barberAId}/document/reject`).send({ reason: "Photo floue" })).expect(200);
    const r = await asClerk(request(app).post("/api/barbers/me/document").send({ documentUrl: DOC_A2 }), clerkA).expect(200);
    expect(r.body.documentUrl).toBe(DOC_A2);
    expect(r.body.documentReviewNote).toBeNull();
    expect(r.body.status).toBe("approved");
    await asClerk(request(app).get("/api/barbers/me/schedule"), clerkA).expect(200);
  });

  it("notifications do not present a document as mandatory", () => {
    const rendered = JSON.stringify(vi.mocked(renderEmail).mock.calls);
    const pushed = JSON.stringify(vi.mocked(sendPush).mock.calls);
    expect(rendered).toContain("facultatif");
    expect(rendered + pushed).not.toMatch(/30 jours|date limite|finaliser la vérification|document a été accepté|Sans document conforme/);
  });
});
