import { db, salonAdVideoCleanupTable as pending } from "@workspace/db";
import { and, asc, eq, lte } from "drizzle-orm";
import { logger } from "./logger";
import { ObjectStorageService } from "./objectStorage";

const storage = new ObjectStorageService();
const RETRY_MS = 60_000;

export async function removeQueuedSalonAdVideo(videoKey: string): Promise<boolean> {
  try {
    // A different worker can make the same idempotent delete, but only one
    // claims a due row. A dead worker leaves it due again after the lease.
    const now = new Date();
    const [claim] = await db.update(pending).set({ retryAfter: new Date(now.getTime() + RETRY_MS) })
      .where(and(eq(pending.videoKey, videoKey), lte(pending.retryAfter, now))).returning();
    if (!claim) return false;
    await storage.removeSalonAdVideo(videoKey);
    await db.delete(pending).where(eq(pending.videoKey, videoKey));
    return true;
  } catch (err) {
    logger.warn({ err, videoKey }, "Salon ad video cleanup will retry");
    return false;
  }
}

export async function cleanupDueSalonAdVideos() {
  const due = await db.select({ videoKey: pending.videoKey }).from(pending)
    .where(lte(pending.retryAfter, new Date())).orderBy(asc(pending.retryAfter)).limit(20);
  for (const { videoKey } of due) await removeQueuedSalonAdVideo(videoKey);
}

export function startSalonAdVideoCleanup() {
  let running = false;
  async function sweep() {
    if (running) return;
    running = true;
    try { await cleanupDueSalonAdVideos(); }
    catch (err) { logger.error({ err }, "Unable to check pending ad video cleanup"); }
    finally { running = false; }
  }
  const timer = setInterval(() => void sweep(), RETRY_MS);
  timer.unref();
}
