import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, inArray } from "drizzle-orm";
import { db, barbersTable, galleryPhotosTable, salonAdsTable, usersTable, adminAccountsTable, pool } from "@workspace/db";
import { ADMIN_COOKIE_NAME, signAdminToken } from "../src/lib/adminAuth";
import { ObjectStorageService } from "../src/lib/objectStorage";
import { MAX_SALON_AD_BYTES } from "../src/lib/salonAdMedia";
import adsRouter from "../src/routes/salon-ads";

const id = randomUUID();
const app = express().use(cookieParser(), express.json()).use("/api", adsRouter);
const base = "/api/admin/salon-ads";
const publicBase = "/api/salon-ads";
let salonId: number;
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
  const [salon] = await db.insert(barbersTable).values({ userId: ownerId, salonName: `Video salon ${id}`, city: "Lomé", status: "approved" }).returning();
  salonId = salon!.id;
  const admins = await db.insert(adminAccountsTable).values([
    { email: `${id}-admin@example.com`, name: "Video admin", passwordHash: "unused", mustChangePassword: false },
    { email: `${id}-locked@example.com`, name: "Locked admin", passwordHash: "unused", mustChangePassword: true },
  ]).returning();
  adminIds = admins.map((admin) => admin.id);
  [cookie, locked] = adminIds.map((key) => `${ADMIN_COOKIE_NAME}=${signAdminToken(key)}`) as [string, string];
});

afterAll(async () => {
  if (salonId) await db.delete(barbersTable).where(eq(barbersTable.id, salonId));
  if (ownerId) await db.delete(usersTable).where(eq(usersTable.id, ownerId));
  if (adminIds.length) await db.delete(adminAccountsTable).where(inArray(adminAccountsTable.id, adminIds));
  if (dir) await rm(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
  await pool.end();
});

describe("salon video advertisements", () => {
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
    expect(created.body).toMatchObject({ salonId, active: false, salonPublic: true, videoPath: `${base}/${adId}/video` });
    expect(created.body).not.toHaveProperty("videoKey");
    const videoUrl = `${publicBase}/${adId}/video`;
    const previewUrl = created.body.videoPath;
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
});
