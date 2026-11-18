import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";

vi.mock("@clerk/express", () => ({
  getAuth: (req: { headers: Record<string, string> }) => ({ userId: req.headers["x-test-clerk-user"] ?? null }),
  clerkClient: { users: { getUser: vi.fn() } },
}));
vi.mock("../src/lib/email", () => ({
  notifyAdmin: vi.fn(), sendEmail: vi.fn(async () => {}), renderEmail: vi.fn(() => ({ html: "", text: "" })),
}));
vi.mock("../src/lib/push", () => ({ sendPush: vi.fn(async () => {}) }));

const { db, barbersTable, usersTable, galleryPhotosTable, pool } = await import("@workspace/db");
const { eq, inArray } = await import("drizzle-orm");
const router = (await import("../src/routes/barbers")).default;
const app = express();
app.use(express.json(), cookieParser());
app.use("/api", router);

const prefix = `discovery-${randomUUID()}`;
const clerk = `clerk-${randomUUID()}`;
const outsider = `clerk-${randomUUID()}`;
let ownerId: number;
let outsiderId: number;
let ids: number[] = [];
let firstId: number;
let photoIds: number[];
const stamp = new Date("2026-01-01T00:00:00Z");

beforeAll(async () => {
  const users = await db.insert(usersTable).values([
    { name: "Discovery owner", email: `${clerk}@example.com`, clerkUserId: clerk, role: "barber" },
    { name: "Other owner", email: `${outsider}@example.com`, clerkUserId: outsider, role: "barber" },
  ]).returning();
  ownerId = users[0]!.id; outsiderId = users[1]!.id;
  const rows = await db.insert(barbersTable).values(Array.from({ length: 105 }, (_, i) => ({
    userId: ownerId, salonName: `${prefix} Salon ${String(i).padStart(2, "0")}`, city: "Lomé",
    neighborhood: `${prefix} quartier`, status: "approved" as const, latitude: 0, longitude: i,
    createdAt: stamp,
  }))).returning();
  ids = rows.map((r) => r.id);
  firstId = ids[0]!;
  const hidden = await db.insert(barbersTable).values([
    { userId: ownerId, salonName: `${prefix} Hidden`, city: "Lomé", status: "pending", latitude: 0, longitude: 0 },
    { userId: ownerId, salonName: `${prefix} No GPS`, city: "Lomé", status: "approved" },
    { userId: ownerId, salonName: `${prefix} Bad GPS`, city: "Lomé", status: "approved", latitude: 95, longitude: 0 },
    { userId: outsiderId, salonName: `${prefix} Other`, city: "Lomé", status: "approved" },
  ]).returning();
  ids.push(...hidden.map((r) => r.id));
  const photos = await db.insert(galleryPhotosTable).values([
    { barberId: firstId, photoUrl: "https://example.com/first.jpg", createdAt: stamp },
    { barberId: firstId, photoUrl: "https://example.com/second.jpg", createdAt: stamp },
  ]).returning();
  photoIds = photos.map((p) => p.id);
}, 30000);

afterAll(async () => {
  if (ids.length) await db.delete(barbersTable).where(inArray(barbersTable.id, ids));
  if (ownerId) await db.delete(usersTable).where(eq(usersTable.id, ownerId));
  if (outsiderId) await db.delete(usersTable).where(eq(usersTable.id, outsiderId));
  await pool.end();
});

describe("public salon discovery", () => {
  it("searches by name before paginating and finds a salon beyond the first 20", async () => {
    const page = await request(app).get("/api/barbers").query({ search: prefix, limit: 20 });
    expect(page.status).toBe(200);
    expect(page.body.data).toHaveLength(20);
    const target = await request(app).get("/api/barbers").query({ search: `${prefix.toUpperCase()} SALON 24` });
    expect(target.status).toBe(200);
    expect(target.body.total).toBe(1);
    expect(target.body.data[0].id).toBe(ids[24]);
    const second = await request(app).get("/api/barbers").query({ search: prefix, page: 2, limit: 20 });
    expect(second.body.data.some((b: { id: number }) => b.id === ids[24])).toBe(true);
  });
  it("searches neighborhoods and returns a real empty state", async () => {
    const r = await request(app).get("/api/barbers").query({ search: `${prefix} quartier` });
    expect(r.body.total).toBe(105);
    const empty = await request(app).get("/api/barbers").query({ search: `${prefix} missing` });
    expect(empty.body).toMatchObject({ data: [], total: 0 });
  });
  it("sorts the newest approved salons deterministically and limits to 20", async () => {
    const r = await request(app).get("/api/barbers").query({ search: `${prefix} Salon`, sort: "newest", limit: 20 });
    expect(r.status).toBe(200);
    expect(r.body.data.map((b: { id: number }) => b.id)).toEqual(ids.slice(0, 105).reverse().slice(0, 20));
  });
  it("does not expose unapproved salons, even without a status or with a forged status", async () => {
    const r = await request(app).get("/api/barbers").query({ search: prefix });
    expect(r.body.data.every((b: { status: string }) => b.status === "approved")).toBe(true);
    const hidden = await request(app).get("/api/barbers").query({ status: "pending" });
    expect(hidden.status).toBe(403);
  });
  it("rejects invalid pagination rather than silently truncating", async () => {
    for (const query of [{ page: 0 }, { limit: 101 }, { page: "bad" }]) {
      expect((await request(app).get("/api/barbers").query(query)).status).toBe(400);
    }
  });
  it("provides every approved salon to the admin subscription selector in pages of 100", async () => {
    const selectedIds: number[] = [];
    let page = 1;
    let total = Infinity;
    while (selectedIds.length < total) {
      const r = await request(app).get("/api/barbers").query({ status: "approved", limit: 100, page });
      expect(r.status).toBe(200);
      expect(r.body.data.length).toBeGreaterThan(0);
      expect(r.body.data.length).toBeLessThanOrEqual(100);
      total = r.body.total;
      selectedIds.push(...r.body.data.map((b: { id: number }) => b.id));
      page++;
    }
    expect(page).toBeGreaterThan(2);
    expect(new Set(selectedIds).size).toBe(total);
    for (const id of ids.slice(0, 105)) expect(selectedIds).toContain(id);
  });
  it("maps all saved positions, including zero, beyond the old 100-item limit", async () => {
    const r = await request(app).get("/api/barbers/map-points");
    expect(r.status).toBe(200);
    const ours = r.body.filter((b: { salonName: string }) => b.salonName.startsWith(prefix));
    expect(ours).toHaveLength(105);
    expect(ours.some((b: { id: number; latitude: number; longitude: number }) => b.id === firstId && b.latitude === 0 && b.longitude === 0)).toBe(true);
  });
  it("uses the first gallery image, then the logo, then the next image when the first is deleted", async () => {
    const getCard = async () => (await request(app).get("/api/barbers").query({ search: `${prefix} Salon 00` })).body.data[0];
    expect((await getCard()).cardImageUrl).toBe("https://example.com/first.jpg");
    const update = await request(app).patch("/api/barbers/me").set("x-test-clerk-user", clerk).send({ logoUrl: "https://example.com/logo.jpg" });
    expect(update.status).toBe(200);
    expect((await getCard()).cardImageUrl).toBe("https://example.com/logo.jpg");
    const replace = await request(app).patch("/api/barbers/me").set("x-test-clerk-user", clerk).send({ logoUrl: "https://example.com/replacement.jpg" });
    expect(replace.status).toBe(200);
    expect((await getCard()).cardImageUrl).toBe("https://example.com/replacement.jpg");
    const remove = await request(app).patch("/api/barbers/me").set("x-test-clerk-user", clerk).send({ logoUrl: null });
    expect(remove.status).toBe(200);
    expect((await getCard()).cardImageUrl).toBe("https://example.com/first.jpg");
    const deleted = await request(app).delete(`/api/barbers/${firstId}/gallery/${photoIds[0]}`).set("x-test-clerk-user", clerk);
    expect(deleted.status).toBe(204);
    expect((await getCard()).cardImageUrl).toBe("https://example.com/second.jpg");
    await request(app).delete(`/api/barbers/${firstId}/gallery/${photoIds[1]}`).set("x-test-clerk-user", clerk);
    expect((await getCard()).cardImageUrl).toBeNull();
  });
  it("persists coordinates for the owner and rejects invalid or partial pairs", async () => {
    const update = await request(app).patch("/api/barbers/me").set("x-test-clerk-user", clerk).send({ latitude: 0, longitude: 1.22 });
    expect(update.status).toBe(200);
    const saved = await request(app).get("/api/barbers/me").set("x-test-clerk-user", clerk);
    expect(saved.body[0]).toMatchObject({ id: firstId, latitude: 0, longitude: 1.22 });
    for (const data of [{ latitude: 91, longitude: 0 }, { latitude: 0, longitude: 181 }, { latitude: 5 }, { longitude: null }]) {
      expect((await request(app).patch("/api/barbers/me").set("x-test-clerk-user", clerk).send(data)).status).toBe(400);
    }
  });
  it("does not let another barber edit the owner's primary salon", async () => {
    const r = await request(app).patch("/api/barbers/me").set("x-test-clerk-user", outsider).send({ logoUrl: "https://example.com/other.jpg", latitude: 9, longitude: 9 });
    expect(r.status).toBe(200);
    expect(r.body.id).not.toBe(firstId);
    const [owner] = await db.select().from(barbersTable).where(eq(barbersTable.id, firstId));
    expect(owner?.latitude).toBe(0);
    expect(owner?.logoUrl).toBeNull();
  });
  it("updates exactly the requested owned salon, including a valid zero pair", async () => {
    const targetId = ids[106]!;
    const [before] = await db.select().from(barbersTable).where(eq(barbersTable.id, firstId));
    const r = await request(app).patch("/api/barbers/me").query({ salonId: targetId })
      .set("x-test-clerk-user", clerk).send({ latitude: 0, longitude: 0 });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ id: targetId, latitude: 0, longitude: 0, status: "approved" });
    const salons = await request(app).get("/api/barbers/me").set("x-test-clerk-user", clerk);
    expect(salons.body.find((s: { id: number }) => s.id === targetId)).toMatchObject({ latitude: 0, longitude: 0 });
    const [after] = await db.select().from(barbersTable).where(eq(barbersTable.id, firstId));
    expect(after?.latitude).toBe(before?.latitude);
    expect(after?.longitude).toBe(before?.longitude);
    expect(after?.status).toBe(before?.status);
  });
  it("refuses a foreign salon id and malformed selectors without changing another salon", async () => {
    const anonymous = await request(app).patch("/api/barbers/me").query({ salonId: firstId })
      .send({ latitude: 4, longitude: 5 });
    expect(anonymous.status).toBe(401);
    const [before] = await db.select().from(barbersTable).where(eq(barbersTable.id, firstId));
    const foreign = await request(app).patch("/api/barbers/me").query({ salonId: firstId })
      .set("x-test-clerk-user", outsider).send({ latitude: 4, longitude: 5 });
    expect(foreign.status).toBe(404);
    for (const salonId of ["bad", "1oops", "0", "-1", "1.5", ""]) {
      const r = await request(app).patch("/api/barbers/me").query({ salonId })
        .set("x-test-clerk-user", clerk).send({ latitude: 4, longitude: 5 });
      expect(r.status).toBe(400);
    }
    const [after] = await db.select().from(barbersTable).where(eq(barbersTable.id, firstId));
    expect(after?.latitude).toBe(before?.latitude);
    expect(after?.longitude).toBe(before?.longitude);
  });
  it("does not make coordinates a condition of approval or emit messages on a position edit", async () => {
    const pendingId = ids[105]!;
    const r = await request(app).patch("/api/barbers/me").query({ salonId: pendingId })
      .set("x-test-clerk-user", clerk).send({ latitude: 1, longitude: 2 });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("pending");
    const { sendEmail, notifyAdmin } = await import("../src/lib/email");
    const { sendPush } = await import("../src/lib/push");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(notifyAdmin).not.toHaveBeenCalled();
    expect(sendPush).not.toHaveBeenCalled();
  });
  it("rejects invalid coordinates on salon creation", async () => {
    const r = await request(app).post("/api/barbers/me").set("x-test-clerk-user", clerk)
      .send({ salonName: "Invalid salon", city: "Lomé", latitude: 200, longitude: 0 });
    expect(r.status).toBe(400);
  });
  it("creates a salon with a logo and exact coordinates without publishing it", async () => {
    const r = await request(app).post("/api/barbers/me").set("x-test-clerk-user", clerk)
      .send({ salonName: `${prefix} Created`, country: "Togo", city: "Lomé", latitude: 0, longitude: 0, logoUrl: "https://example.com/created.jpg" });
    if (r.body.id) ids.push(r.body.id);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ latitude: 0, longitude: 0, logoUrl: "https://example.com/created.jpg", status: "pending" });
    const found = await request(app).get("/api/barbers").query({ search: `${prefix} Created` });
    expect(found.body.total).toBe(0);
  });
});
