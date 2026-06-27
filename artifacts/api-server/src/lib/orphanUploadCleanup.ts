import {
  db,
  financingRequestsTable,
  barbersTable,
  usersTable,
  galleryPhotosTable,
  homeGalleryPhotosTable,
  servicesTable,
  articlesTable,
  serviceRealisationsTable,
  panoramasTable,
} from "@workspace/db";
import { ObjectStorageService } from "./objectStorage";
import { logger } from "./logger";

// How long a freshly-uploaded object is left untouched before it becomes
// eligible for cleanup. Presigned PUT creates the object BEFORE any DB row
// references it (e.g. while a barber is still filling the financing form), so a
// generous grace period guarantees we never delete an in-flight upload that is
// about to be persisted. The presigned URL itself only lives 15 minutes, so 24h
// is comfortably safe.
const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

// How often the cleanup sweep runs. Orphans are not time-sensitive — a daily
// sweep is plenty to stop them accumulating.
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Build the set of every object path currently referenced by a DB row. Any
 * uploaded object NOT in this set is an orphan (uploaded but never persisted,
 * or detached when a row was updated/deleted).
 *
 * IMPORTANT: every column that can hold an `/objects/...` path must be listed
 * here, otherwise the sweep would delete a live asset. Keep this in sync with
 * the storage ACL classification in `routes/storage.ts`.
 */
async function collectReferencedPaths(): Promise<Set<string>> {
  const referenced = new Set<string>();

  const fin = await db
    .select({
      documents: financingRequestsTable.documents,
      idDocument: financingRequestsTable.idDocument,
      guarantorIdDocument: financingRequestsTable.guarantorIdDocument,
    })
    .from(financingRequestsTable);
  for (const r of fin) {
    for (const d of r.documents) referenced.add(d);
    if (r.idDocument) referenced.add(r.idDocument);
    if (r.guarantorIdDocument) referenced.add(r.guarantorIdDocument);
  }

  const barbers = await db
    .select({ logoUrl: barbersTable.logoUrl, documentUrl: barbersTable.documentUrl })
    .from(barbersTable);
  for (const b of barbers) {
    if (b.logoUrl) referenced.add(b.logoUrl);
    if (b.documentUrl) referenced.add(b.documentUrl);
  }

  const users = await db.select({ avatarUrl: usersTable.avatarUrl }).from(usersTable);
  for (const u of users) if (u.avatarUrl) referenced.add(u.avatarUrl);

  const gallery = await db.select({ photoUrl: galleryPhotosTable.photoUrl }).from(galleryPhotosTable);
  for (const g of gallery) if (g.photoUrl) referenced.add(g.photoUrl);

  const home = await db.select({ imageUrl: homeGalleryPhotosTable.imageUrl }).from(homeGalleryPhotosTable);
  for (const h of home) if (h.imageUrl) referenced.add(h.imageUrl);

  const services = await db.select({ photoUrl: servicesTable.photoUrl }).from(servicesTable);
  for (const s of services) if (s.photoUrl) referenced.add(s.photoUrl);

  const articles = await db.select({ coverImageUrl: articlesTable.coverImageUrl }).from(articlesTable);
  for (const a of articles) if (a.coverImageUrl) referenced.add(a.coverImageUrl);

  const realisations = await db
    .select({ beforeUrl: serviceRealisationsTable.beforeUrl, afterUrl: serviceRealisationsTable.afterUrl })
    .from(serviceRealisationsTable);
  for (const r of realisations) {
    if (r.beforeUrl) referenced.add(r.beforeUrl);
    if (r.afterUrl) referenced.add(r.afterUrl);
  }

  const panoramas = await db.select({ imageUrl: panoramasTable.imageUrl }).from(panoramasTable);
  for (const p of panoramas) if (p.imageUrl) referenced.add(p.imageUrl);

  return referenced;
}

/**
 * Sweep the private `uploads/` prefix and delete any object that is older than
 * the grace period and not referenced by any DB row. Returns the number of
 * objects deleted. Never throws — failures are logged and the sweep continues.
 */
export async function runOrphanUploadSweep(): Promise<number> {
  let objects: Array<{ objectPath: string; createdAt: Date }>;
  try {
    objects = await new ObjectStorageService().listUploadedObjects();
  } catch (err) {
    logger.error({ err }, "Orphan upload sweep: failed to list uploaded objects");
    return 0;
  }
  if (objects.length === 0) return 0;

  const referenced = await collectReferencedPaths();
  const svc = new ObjectStorageService();
  const now = Date.now();
  let deleted = 0;

  for (const obj of objects) {
    if (referenced.has(obj.objectPath)) continue;
    // Skip in-flight uploads: an object referenced only after the row is saved
    // would otherwise be deleted out from under a form that's still open.
    if (now - obj.createdAt.getTime() < GRACE_PERIOD_MS) continue;
    try {
      await svc.deleteObjectByPath(obj.objectPath);
      deleted += 1;
    } catch (err) {
      logger.error({ err, objectPath: obj.objectPath }, "Failed to delete orphan upload");
    }
  }

  if (deleted > 0) logger.info({ deleted }, "Orphan uploads cleaned up");
  return deleted;
}

let timer: NodeJS.Timeout | null = null;

export function startOrphanUploadCleanup(): void {
  if (timer) return;
  // First run shortly after boot, then once a day.
  setTimeout(() => {
    runOrphanUploadSweep().catch((err) => logger.error({ err }, "Orphan upload sweep failed"));
  }, 60 * 1000);
  timer = setInterval(() => {
    runOrphanUploadSweep().catch((err) => logger.error({ err }, "Orphan upload sweep failed"));
  }, SWEEP_INTERVAL_MS);
  logger.info({ intervalMs: SWEEP_INTERVAL_MS }, "Orphan upload cleanup scheduler started");
}
