import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { access, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, inArray } from "drizzle-orm";
import { db, barbersTable, galleryPhotosTable, salonAdsTable, salonAdVideoCleanupTable, usersTable, adminAccountsTable, pool } from "@workspace/db";
import { ADMIN_COOKIE_NAME, signAdminToken } from "../src/lib/adminAuth";
import { ObjectStorageService } from "../src/lib/objectStorage";
import { MAX_SALON_AD_BYTES } from "../src/lib/salonAdMedia";
import { removeQueuedSalonAdVideo } from "../src/lib/salonAdVideoCleanup";
import adsRouter from "../src/routes/salon-ads";
import barbersRouter from "../src/routes/barbers";

const id = randomUUID();
const app = express().use(cookieParser(), express.json()).use("/api", adsRouter, barbersRouter);
const base = "/api/admin/salon-ads";
const publicBase = "/api/salon-ads";
let salonId: number;
let otherSalonId: number;
let hiddenSalonId: number;
let deletedSalonId: number;
const testCity = `Test ${id}`;
let ownerId: number;
let adminIds: number[] = [];
let dir: string;
let cookie: string;
let locked: string;

function box(type: string, payload: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(8 + payload.length);
  head.write(type, 4, "ascii");
  return Buffer.concat([head, payload]);
}
const makeMedia = (track: string) => Buffer.concat([
  box("ftyp", Buffer.from("isom\0\0\0\0isom")),
  box("moov", box("trak", box("mdia", box("hdlr", Buffer.concat([Buffer.alloc(8), Buffer.from(track)]))))),
  box("mdat", Buffer.from([1, 2, 3, 4, 5])),
]);
const video = readFileSync(new URL("./fixtures/salon-ad.mp4", import.meta.url));
const upload = (payload = video, salon = salonId) =>
  request(app).post(base).set("Cookie", cookie).query({ salonId: salon }).type("video/mp4").send(payload);

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "zbarber-ads-"));
  vi.stubEnv("OBJECT_STORAGE_PROVIDER", "local");
  vi.stubEnv("LOCAL_STORAGE_DIR", dir);
  const [owner] = await db.insert(usersTable).values({ name: "Ads salon owner", email: `${id}@example.com`, role: "barber" }).returning();
  ownerId = owner!.id;
  const [salon, other, hidden, deleted] = await db.insert(barbersTable).values([
    { userId: ownerId, salonName: `Video salon ${id}`, city: "Lomé", status: "approved" },
    { userId: ownerId, salonName: `Other video salon ${id}`, city: "Kara", status: "approved" },
    { userId: ownerId, salonName: `Hidden video salon ${id}`, city: testCity, status: "pending" },
    { userId: ownerId, salonName: "Salon supprimé", city: testCity, status: "suspended", suspensionReason: "Compte supprimé" },
  ]).returning();
  salonId = salon!.id;
  otherSalonId = other!.id;
  hiddenSalonId = hidden!.id;
  deletedSalonId = deleted!.id;
  const admins = await db.insert(adminAccountsTable).values([
    { email: `${id}-admin@example.com`, name: "Video admin", passwordHash: "unused", mustChangePassword: false },
    { email: `${id}-locked@example.com`, name: "Locked admin", passwordHash: "unused", mustChangePassword: true },
  ]).returning();
  adminIds = admins.map((admin) => admin.id);
  [cookie, locked] = adminIds.map((key) => `${ADMIN_COOKIE_NAME}=${signAdminToken(key)}`) as [string, string];
});

afterAll(async () => {
  if (salonId) await db.delete(barbersTable).where(inArray(barbersTable.id, [salonId, otherSalonId, hiddenSalonId, deletedSalonId]));
  if (ownerId) await db.delete(usersTable).where(eq(usersTable.id, ownerId));
  if (adminIds.length) await db.delete(adminAccountsTable).where(inArray(adminAccountsTable.id, adminIds));
  if (dir) await rm(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
  await pool.end();
});

describe("salon video advertisements", () => {
  it("finds approved salons beyond the first ad-picker page by name and location without accents", async () => {
    const marker = `ad-picker-${id}`;
    const district = `Bè ${marker}`;
    const rows = await db.insert(barbersTable).values(Array.from({ length: 26 }, (_, index) => ({
      userId: ownerId, salonName: index === 25 ? "L’Élégance Barber" : `Salon ${index}`,
      city: "Lomé", neighborhood: district, status: "approved" as const,
    }))).returning({ id: barbersTable.id });
    const target = rows[25]!.id;
    const picker = (search: string) => request(app).get("/api/barbers").set("Cookie", cookie)
      .query({ search, page: 1, limit: 25, excludeDeleted: true });
    try {
      const firstPage = await picker(marker);
      expect(firstPage.status).toBe(200);
      expect(firstPage.body.total).toBe(26);
      expect(firstPage.body.data).toHaveLength(25);
      expect(firstPage.body.data).not.toContainEqual(expect.objectContaining({ id: target }));
      const search = await picker(`LOME elegance be ${marker}`);
      expect(search.status).toBe(200);
      expect(search.body).toMatchObject({ total: 1, data: [{ id: target, status: "approved" }] });
    } finally {
      await db.delete(barbersTable).where(inArray(barbersTable.id, rows.map((row) => row.id)));
    }
  });

  it("excludes deleted salons before counting and paginating the ad picker results", async () => {
    const list = (excludeDeleted?: boolean) => request(app).get("/api/barbers").set("Cookie", cookie)
      .query({ city: testCity, limit: 1, sort: "newest", ...(excludeDeleted ? { excludeDeleted } : {}) });
    const unfiltered = await list();
    expect(unfiltered.body).toMatchObject({ total: 2, data: [{ id: deletedSalonId }] });
    const filtered = await list(true);
    expect(filtered.status).toBe(200);
    expect(filtered.body).toMatchObject({ total: 1, data: [{ id: hiddenSalonId, status: "pending" }] });
    expect((await upload(video, deletedSalonId)).status).toBe(404);
  });

  it("requires an unlocked admin and rejects invalid uploads", async () => {
    expect((await request(app).get(base)).status).toBe(401);
    expect((await request(app).get(base).set("Cookie", locked)).status).toBe(403);
    expect((await request(app).post(base).query({ salonId }).type("video/mp4").send(video)).status).toBe(401);
    expect((await request(app).post(base).set("Cookie", cookie).query({ salonId }).type("video/webm").send(Buffer.from("x"))).status).toBe(415);
    expect((await upload(Buffer.from("not a video"))).status).toBe(415);
    expect((await upload(makeMedia("soun"))).status).toBe(415);
    expect((await upload(Buffer.alloc(MAX_SALON_AD_BYTES + 1))).status).toBe(413);
    expect((await upload(video, 2147483647)).status).toBe(404);
  });

  it("publishes only active ads of approved salons, with private storage and byte ranges", async () => {
    const created = await upload();
    expect(created.status).toBe(201);
    const adId = created.body.id;
    expect(created.body).toMatchObject({ salonId, active: false, salonPublic: true });
    expect(created.body).not.toHaveProperty("videoKey");
    const previewUrl = created.body.videoPath;
    expect(previewUrl).toMatch(new RegExp(`^${base}/${adId}/video\\?v=[a-f0-9]{24}$`));
    const videoUrl = previewUrl.replace(base, publicBase);
    expect((await request(app).get(videoUrl)).status).toBe(404);
    expect((await request(app).get(previewUrl)).status).toBe(401);
    expect((await request(app).get(previewUrl).set("Cookie", cookie)).body).toEqual(video);
    expect((await request(app).get(base).set("Cookie", cookie)).body).toContainEqual(created.body);
    expect((await request(app).patch(`${base}/${adId}`).send({ active: true })).status).toBe(401);
    const toggle = (active: boolean) => request(app).patch(`${base}/${adId}`).set("Cookie", cookie).send({ active });
    expect((await toggle(true)).body.active).toBe(true);
    const publicList = await request(app).get(publicBase);
    expect(publicList.body).toContainEqual({ id: adId, salonId, salonName: `Video salon ${id}`, videoPath: videoUrl });
    expect(publicList.headers["cache-control"]).toBe("private, no-store");
    await db.insert(galleryPhotosTable).values({ barberId: salonId, photoUrl: "/images/gallery.jpg" });
    expect((await request(app).get(publicBase)).body).toContainEqual(expect.objectContaining({ id: adId, posterPath: "/images/gallery.jpg" }));
    await db.update(barbersTable).set({ logoUrl: "/images/logo.jpg" }).where(eq(barbersTable.id, salonId));
    expect((await request(app).get(publicBase)).body).toContainEqual(expect.objectContaining({ id: adId, posterPath: "/images/logo.jpg" }));
    const full = await request(app).get(videoUrl);
    expect(full.status).toBe(200);
    expect(full.body).toEqual(video);
    const part = await request(app).get(videoUrl).set("Range", "bytes=0-7");
    expect(part.status).toBe(206);
    expect(part.body).toEqual(video.subarray(0, 8));
    expect(part.headers["content-range"]).toBe(`bytes 0-7/${video.length}`);
    const tail = await request(app).get(videoUrl).set("Range", "bytes=-3");
    expect(tail.body).toEqual(video.subarray(-3));
    expect((await request(app).head(videoUrl)).headers["content-length"]).toBe(String(video.length));
    expect((await request(app).get(videoUrl).set("Range", `bytes=${video.length}-`)).status).toBe(416);
    const [row] = await db.select().from(salonAdsTable).where(eq(salonAdsTable.id, adId));
    const storage = new ObjectStorageService();
    await expect(storage.getObjectEntityFile(`/objects/salon-ad-videos/${row!.videoKey}.mp4`)).rejects.toThrow("Object not found");
    await db.update(barbersTable).set({ status: "suspended" }).where(eq(barbersTable.id, salonId));
    expect((await request(app).get(videoUrl)).status).toBe(404);
    expect((await toggle(true)).status).toBe(409);
    expect((await toggle(false)).body.active).toBe(false);
    await db.update(barbersTable).set({ status: "approved" }).where(eq(barbersTable.id, salonId));
    expect((await request(app).get(videoUrl)).status).toBe(404);
    expect((await request(app).get(publicBase)).body).not.toContainEqual(expect.objectContaining({ id: adId }));
    expect((await request(app).get(previewUrl).set("Cookie", cookie)).status).toBe(200);
  });

  it("relinks without uploading, then replaces and removes only the correct files", async () => {
    const created = await upload();
    const adId = created.body.id;
    const path = `${base}/${adId}`;
    const patch = (data: { salonId?: number; active?: boolean }) => request(app).patch(path).set("Cookie", cookie).send(data);
    const put = (payload: Buffer, target?: number) => request(app).put(path).set("Cookie", cookie).query(target ? { salonId: target } : {})
      .type("video/mp4").send(payload);
    const row = async () => (await db.select().from(salonAdsTable).where(eq(salonAdsTable.id, adId)))[0]!;
    const currentKey = (await row()).videoKey;
    const folder = join(dir, "salon-ad-videos");
    const onDisk = (key: string) => join(folder, `${key}.mp4`);
    const before = (await readdir(folder)).sort();
    expect((await patch({ salonId: deletedSalonId })).status).toBe(404);
    expect((await put(video, deletedSalonId)).status).toBe(404);
    expect((await row()).salonId).toBe(salonId);
    expect((await patch({ active: true })).status).toBe(200);
    expect((await patch({ salonId: hiddenSalonId })).status).toBe(409);
    expect((await patch({})).status).toBe(400);
    const relinked = await patch({ salonId: otherSalonId });
    expect(relinked.body).toMatchObject({ salonId: otherSalonId, active: true, videoPath: created.body.videoPath });
    expect((await row()).videoKey).toBe(currentKey);
    expect((await request(app).get(publicBase)).body).toContainEqual(expect.objectContaining({ id: adId, salonId: otherSalonId }));
    expect((await request(app).put(path).type("video/mp4").send(video)).status).toBe(401);
    expect((await put(Buffer.from("broken"))).status).toBe(415);
    expect((await put(video, hiddenSalonId)).status).toBe(409);
    expect((await put(video, 2147483647)).status).toBe(404);
    expect((await readdir(folder)).sort()).toEqual(before);
    expect((await request(app).get(created.body.videoPath).set("Cookie", cookie)).status).toBe(200);

    // Appending a legitimate padding box keeps the H.264 fixture playable and changes its bytes.
    const replacement = Buffer.concat([video, box("free", Buffer.from("replacement"))]);
    const updated = await put(replacement, salonId);
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ salonId, active: true });
    expect(updated.body.videoPath).not.toBe(created.body.videoPath);
    await expect(access(onDisk(currentKey))).rejects.toMatchObject({ code: "ENOENT" });
    expect((await request(app).get(created.body.videoPath).set("Cookie", cookie)).status).toBe(404);
    const updatedKey = (await row()).videoKey;
    expect((await request(app).get(updated.body.videoPath.replace(base, publicBase))).body).toEqual(replacement);
    expect((await request(app).delete(path)).status).toBe(401);
    expect((await request(app).delete(path).set("Cookie", cookie)).body).toEqual({ cleanupPending: false });
    await expect(access(onDisk(updatedKey))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await row()).toBeUndefined();
    expect((await request(app).get(updated.body.videoPath.replace(base, publicBase))).status).toBe(404);
    expect((await request(app).get(publicBase)).body).not.toContainEqual(expect.objectContaining({ id: adId }));
    expect((await readdir(folder)).sort()).toEqual(before.filter((f) => f !== `${currentKey}.mp4`));
  });

  it("detaches the ad immediately and durably retries when storage deletion fails", async () => {
    const created = await upload();
    const adId = created.body.id;
    const [row] = await db.select().from(salonAdsTable).where(eq(salonAdsTable.id, adId));
    const key = row!.videoKey;
    const filePath = join(dir, "salon-ad-videos", `${key}.mp4`);
    const failure = vi.spyOn(ObjectStorageService.prototype, "removeSalonAdVideo").mockRejectedValueOnce(new Error("Test outage"));
    try {
      const result = await request(app).delete(`${base}/${adId}`).set("Cookie", cookie);
      expect(result.status).toBe(200);
      expect(result.body).toEqual({ cleanupPending: true });
      expect((await request(app).get(created.body.videoPath).set("Cookie", cookie)).status).toBe(404);
      await expect(access(filePath)).resolves.toBeUndefined();
      const queued = await db.select().from(salonAdVideoCleanupTable).where(eq(salonAdVideoCleanupTable.videoKey, key));
      expect(queued).toHaveLength(1);
    } finally {
      failure.mockRestore();
      await db.update(salonAdVideoCleanupTable).set({ retryAfter: new Date(0) }).where(eq(salonAdVideoCleanupTable.videoKey, key));
      await removeQueuedSalonAdVideo(key);
    }
    await expect(access(filePath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await db.select().from(salonAdVideoCleanupTable).where(eq(salonAdVideoCleanupTable.videoKey, key))).toHaveLength(0);
  });
});
