import { Router } from "express";
import { db, homeGalleryPhotosTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../lib/clerkAuth";

const router = Router();

router.get("/home-gallery", async (_req, res) => {
  const photos = await db
    .select()
    .from(homeGalleryPhotosTable)
    .orderBy(asc(homeGalleryPhotosTable.sortOrder), asc(homeGalleryPhotosTable.id));
  res.json(photos);
});

router.post("/home-gallery", requireAuth, requireAdmin, async (req, res) => {
  const body = z
    .object({
      imageUrl: z.string().min(1),
      caption: z.string().optional(),
      sortOrder: z.number().int().optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [photo] = await db.insert(homeGalleryPhotosTable).values(body.data).returning();
  res.status(201).json(photo);
});

router.patch("/home-gallery/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const body = z
    .object({
      imageUrl: z.string().min(1).optional(),
      caption: z.string().nullable().optional(),
      sortOrder: z.number().int().optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  if (Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  const [updated] = await db
    .update(homeGalleryPhotosTable)
    .set(body.data)
    .where(eq(homeGalleryPhotosTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(updated);
});

router.delete("/home-gallery/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(homeGalleryPhotosTable).where(eq(homeGalleryPhotosTable.id, id));
  res.status(204).send();
});

export default router;
