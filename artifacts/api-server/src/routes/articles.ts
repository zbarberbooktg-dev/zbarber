import { Router, type IRouter } from "express";
import { db, articlesTable } from "@workspace/db";
import { and, asc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import sanitizeHtml from "sanitize-html";
import { requireAdminAuth } from "../lib/adminAuth";

const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "em", "u", "s", "code", "pre",
    "h1", "h2", "h3", "h4", "blockquote",
    "ul", "ol", "li", "a", "hr", "span",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    span: ["class"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
  },
};
const sanitize = (html: string | undefined): string =>
  html ? sanitizeHtml(html, SANITIZE_OPTS) : "";

const router: IRouter = Router();

const DATE_FIELD = z
  .string()
  .datetime({ offset: true })
  .or(z.string().datetime())
  .transform((s) => new Date(s));

const inputSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  coverImageUrl: z.string().min(1),
  contentHtml: z.string().optional(),
  status: z.enum(["draft", "published"]).optional(),
  sortOrder: z.number().int().optional(),
  startsAt: DATE_FIELD.optional(),
  endsAt: DATE_FIELD.nullable().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  subtitle: z.string().nullable().optional(),
  coverImageUrl: z.string().min(1).optional(),
  contentHtml: z.string().optional(),
  status: z.enum(["draft", "published"]).optional(),
  sortOrder: z.number().int().optional(),
  startsAt: DATE_FIELD.optional(),
  endsAt: DATE_FIELD.nullable().optional(),
});

// ── Public ─────────────────────────────────────────────────────────────
router.get("/articles", async (_req, res) => {
  const now = new Date();
  const rows = await db
    .select()
    .from(articlesTable)
    .where(
      and(
        eq(articlesTable.status, "published"),
        lte(articlesTable.startsAt, now),
        or(isNull(articlesTable.endsAt), gt(articlesTable.endsAt, now)),
      ),
    )
    .orderBy(asc(articlesTable.sortOrder), sql`${articlesTable.createdAt} DESC`);
  res.json(rows);
});

router.get("/articles/:id", async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const now = new Date();
  const [row] = await db
    .select()
    .from(articlesTable)
    .where(
      and(
        eq(articlesTable.id, id),
        eq(articlesTable.status, "published"),
        lte(articlesTable.startsAt, now),
        or(isNull(articlesTable.endsAt), gt(articlesTable.endsAt, now)),
      ),
    )
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

// ── Admin ──────────────────────────────────────────────────────────────
router.get("/admin/articles", requireAdminAuth, async (_req, res) => {
  const rows = await db
    .select()
    .from(articlesTable)
    .orderBy(asc(articlesTable.sortOrder), sql`${articlesTable.createdAt} DESC`);
  res.json(rows);
});

router.get("/admin/articles/:id", requireAdminAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db.select().from(articlesTable).where(eq(articlesTable.id, id)).limit(1);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.post("/admin/articles", requireAdminAuth, async (req, res) => {
  const parsed = inputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  // Sanitize untrusted HTML before persisting.
  const data = { ...parsed.data, contentHtml: sanitize(parsed.data.contentHtml) };
  // If sortOrder not provided, append after the current max to avoid collisions.
  if (data.sortOrder === undefined) {
    const [maxRow] = await db
      .select({ max: sql<number>`COALESCE(MAX(${articlesTable.sortOrder}), -1)` })
      .from(articlesTable);
    data.sortOrder = (maxRow?.max ?? -1) + 1;
  }
  const [row] = await db.insert(articlesTable).values(data).returning();
  res.status(201).json(row);
});

router.patch("/admin/articles/:id", requireAdminAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  const patch = {
    ...parsed.data,
    ...(parsed.data.contentHtml !== undefined && { contentHtml: sanitize(parsed.data.contentHtml) }),
  };
  const [row] = await db
    .update(articlesTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(articlesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.delete("/admin/articles/:id", requireAdminAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(articlesTable).where(eq(articlesTable.id, id));
  res.status(204).send();
});

export default router;
