import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Router, raw, type Request, type Response, type NextFunction } from "express";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { barbersTable, db, galleryPhotosTable, salonAdsTable } from "@workspace/db";
import {
  CreateSalonAdQueryParams, SetSalonAdVisibilityBody, SetSalonAdVisibilityParams,
  StreamSalonAdVideoParams,
} from "@workspace/api-zod";
import { requireAdminAuth, type AdminAuthedRequest } from "../lib/adminAuth";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { isMp4Video, MAX_SALON_AD_BYTES, salonAdRange } from "../lib/salonAdMedia";

const router = Router();
const storage = new ObjectStorageService();
const ads = salonAdsTable;
const cols = {
  id: ads.id, salonId: ads.salonId, salonName: barbersTable.salonName, salonStatus: barbersTable.status,
  active: ads.active, videoKey: ads.videoKey, byteCount: ads.byteCount,
};
const publicAd = and(eq(ads.active, true), eq(barbersTable.status, "approved"));
const all = () => db.select(cols).from(ads).innerJoin(barbersTable, eq(ads.salonId, barbersTable.id));

function noStore(_req: Request, res: Response, next: NextFunction) {
  res.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  next();
}

function unlocked(req: AdminAuthedRequest, res: Response, next: NextFunction) {
  if (req.admin?.mustChangePassword) { res.status(403).json({ error: "Change your administrator password first" }); return; }
  next();
}
const admin = [noStore, requireAdminAuth, unlocked];

function summary(row: { id: number; salonId: number; salonName: string }) {
  return { id: row.id, salonId: row.salonId, salonName: row.salonName, videoPath: `/api/salon-ads/${row.id}/video` };
}
function adminSummary(row: Parameters<typeof summary>[0] & { active: boolean; salonStatus: string }) {
  return { ...summary(row), videoPath: `/api/admin/salon-ads/${row.id}/video`, active: row.active, salonPublic: row.salonStatus === "approved" };
}

router.get("/salon-ads", noStore, async (_req, res) => {
  const firstPhoto = db.select({ photo: galleryPhotosTable.photoUrl }).from(galleryPhotosTable)
    .where(eq(galleryPhotosTable.barberId, ads.salonId))
    .orderBy(asc(galleryPhotosTable.createdAt), asc(galleryPhotosTable.id)).limit(1);
  const rows = await db.select({ ...cols, posterPath: sql<string | null>`coalesce(nullif(${barbersTable.logoUrl}, ''), (${firstPhoto}))` })
    .from(ads).innerJoin(barbersTable, eq(ads.salonId, barbersTable.id)).where(publicAd).orderBy(desc(ads.id));
  res.json(rows.map((row) => ({ ...summary(row), posterPath: row.posterPath || undefined })));
});

router.get("/admin/salon-ads", admin, async (_req: Request, res: Response) => {
  const rows = await all().orderBy(desc(ads.id));
  res.json(rows.map(adminSummary));
});

const parseVideo = raw({ type: "video/mp4", limit: MAX_SALON_AD_BYTES, inflate: false });
function readVideo(req: Request, res: Response, next: NextFunction) {
  if (!req.is("video/mp4")) { res.status(415).json({ error: "Choose an MP4 video" }); return; }
  parseVideo(req, res, (error?: { status?: number }) => {
    if (!error) { next(); return; }
    const code = error.status === 413 ? 413 : error.status === 415 ? 415 : 400;
    res.status(code).json({ error: code === 413 ? "Video exceeds 20 MiB" : "Unable to read MP4 upload" });
  });
}

router.post("/admin/salon-ads", admin, readVideo, async (req: Request, res: Response) => {
  const query = CreateSalonAdQueryParams.safeParse(req.query);
  if (!query.success || !Number.isSafeInteger(query.data.salonId) || query.data.salonId > 2147483647) {
    res.status(400).json({ error: "Choose an existing salon" }); return;
  }
  if (!Buffer.isBuffer(req.body) || !isMp4Video(req.body)) {
    res.status(415).json({ error: "File is not a valid MP4 video" }); return;
  }
  const { salonId } = query.data;
  const [salon] = await db.select({ name: barbersTable.salonName, status: barbersTable.status })
    .from(barbersTable).where(eq(barbersTable.id, salonId));
  if (!salon) { res.status(404).json({ error: "Salon not found" }); return; }
  const videoKey = randomUUID();
  let saved;
  try {
    await storage.putSalonAdVideo(videoKey, req.body);
    [saved] = await db.insert(ads).values({ salonId, videoKey, byteCount: req.body.length }).returning();
  } catch (error) {
    await storage.removeSalonAdVideo(videoKey).catch((err) => req.log?.error({ err }, "Ad video cleanup failed"));
    throw error;
  }
  res.status(201).json(adminSummary({ ...saved!, salonName: salon.name, salonStatus: salon.status }));
});

router.patch("/admin/salon-ads/:id", admin, async (req: Request, res: Response) => {
  const params = SetSalonAdVisibilityParams.safeParse(req.params);
  const body = SetSalonAdVisibilityBody.safeParse(req.body);
  if (!params.success || !body.success || !Number.isSafeInteger(params.data.id) || params.data.id > 2147483647) {
    res.status(400).json({ error: "Invalid ad or visibility" }); return;
  }
  const { id } = params.data;
  const [row] = await all().where(eq(ads.id, id));
  if (!row) { res.status(404).json({ error: "Ad not found" }); return; }
  if (body.data.active && row.salonStatus !== "approved") {
    res.status(409).json({ error: "Only approved salons can appear in public ads" }); return;
  }
  const [updated] = await db.update(ads).set({ active: body.data.active }).where(eq(ads.id, id)).returning({ active: ads.active });
  if (!updated) { res.status(404).json({ error: "Ad not found" }); return; }
  res.json(adminSummary({ ...row, active: updated.active }));
});

function stream(forAdmin: boolean) {
  return async (req: Request, res: Response) => {
    const parsed = StreamSalonAdVideoParams.safeParse(req.params);
    if (!parsed.success || !Number.isSafeInteger(parsed.data.id) || parsed.data.id > 2147483647) {
      res.sendStatus(404); return;
    }
    const [ad] = await all().where(and(eq(ads.id, parsed.data.id), forAdmin ? undefined : publicAd));
    if (!ad) { res.sendStatus(404); return; }
    const bytes = salonAdRange(req.get("range"), ad.byteCount);
    res.set("Accept-Ranges", "bytes");
    if (!bytes) { res.set("Content-Range", `bytes */${ad.byteCount}`).status(416).end(); return; }
    try {
      const reader = await storage.openSalonAdVideo(ad.videoKey, bytes.start, bytes.end);
      res.set({
        "Content-Type": "video/mp4",
        "Content-Length": String(bytes.end - bytes.start + 1),
        "Cross-Origin-Resource-Policy": forAdmin ? "same-origin" : "cross-origin",
      });
      if (bytes.partial) res.set("Content-Range", `bytes ${bytes.start}-${bytes.end}/${ad.byteCount}`);
      res.status(bytes.partial ? 206 : 200);
      if (req.method === "HEAD") { reader.destroy(); res.end(); return; }
      await pipeline(reader, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError && !res.headersSent) { res.sendStatus(404); return; }
      if (res.destroyed || req.aborted) return;
      throw error;
    }
  };
}

router.get("/salon-ads/:id/video", noStore, stream(false));
router.get("/admin/salon-ads/:id/video", admin, stream(true));

export default router;
