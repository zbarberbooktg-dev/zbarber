import { Router } from "express";
import { db, countriesTable, citiesTable, COUNTRIES_SEED } from "@workspace/db";
import { and, eq, sql, asc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../lib/clerkAuth";

const router = Router();

let seedPromise: Promise<void> | null = null;
export async function ensureCountriesSeeded() {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(countriesTable);
    if (n && n > 0) return;
    await db.insert(countriesTable).values(COUNTRIES_SEED).onConflictDoNothing();
  })();
  try {
    await seedPromise;
  } catch (e) {
    // Don't cache failures: allow retry on next request.
    seedPromise = null;
    throw e;
  }
  return seedPromise;
}

// ── List all countries ───
router.get("/countries", async (_req, res) => {
  await ensureCountriesSeeded();
  const rows = await db.select().from(countriesTable).orderBy(asc(countriesTable.name));
  res.json(rows);
});

// ── List cities for a country (optional ?q= prefix filter) ───
router.get("/countries/:countryId/cities", async (req, res) => {
  const countryId = parseInt(String(req.params.countryId));
  if (!Number.isFinite(countryId)) { res.status(400).json({ error: "Invalid countryId" }); return; }
  const q = String(req.query.q ?? "").trim().toLowerCase();
  let rows = await db.select().from(citiesTable).where(eq(citiesTable.countryId, countryId)).orderBy(asc(citiesTable.name));
  if (q) rows = rows.filter((c) => c.name.toLowerCase().includes(q));
  res.json(rows);
});

// ── Create or fetch a city in a country (deduped, case-insensitive) ───
// Returns the existing city if a same-name match is found.
router.post("/cities", requireAuth, async (req, res) => {
  const body = z.object({
    countryId: z.number().int().positive(),
    name: z.string().trim().min(1).max(120),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const [country] = await db.select().from(countriesTable).where(eq(countriesTable.id, body.data.countryId)).limit(1);
  if (!country) { res.status(404).json({ error: "Country not found" }); return; }

  const trimmed = body.data.name.trim();
  const existing = await db.select().from(citiesTable).where(and(
    eq(citiesTable.countryId, body.data.countryId),
    sql`lower(${citiesTable.name}) = ${trimmed.toLowerCase()}`,
  )).limit(1);
  if (existing[0]) { res.json({ ...existing[0], existed: true }); return; }

  try {
    const [created] = await db.insert(citiesTable).values({
      countryId: body.data.countryId,
      name: trimmed,
    }).returning();
    res.status(201).json({ ...created, existed: false });
  } catch (e: any) {
    // race-condition fallback
    const [row] = await db.select().from(citiesTable).where(and(
      eq(citiesTable.countryId, body.data.countryId),
      sql`lower(${citiesTable.name}) = ${trimmed.toLowerCase()}`,
    )).limit(1);
    if (row) { res.json({ ...row, existed: true }); return; }
    res.status(500).json({ error: e?.message ?? "Failed to create city" });
  }
});

/**
 * Resolve a (countryName?, cityName?) pair to canonical strings, persisting
 * the city into the catalog (deduped per country) when both are provided.
 * Returns the canonical names to store on user/barber rows, or nulls.
 */
export class UnknownCountryError extends Error {
  constructor(public countryName: string) {
    super(`Unknown country: ${countryName}`);
    this.name = "UnknownCountryError";
  }
}

export async function resolveAndPersistLocation(opts: {
  countryName?: string | null;
  cityName?: string | null;
}): Promise<{ country: string | null; city: string | null }> {
  const countryName = opts.countryName?.trim() || null;
  const cityName = opts.cityName?.trim() || null;
  if (!countryName && !cityName) return { country: null, city: null };

  await ensureCountriesSeeded();

  let canonicalCountry: string | null = countryName;
  let countryId: number | null = null;

  if (countryName) {
    const [c] = await db.select().from(countriesTable).where(
      sql`lower(${countriesTable.name}) = ${countryName.toLowerCase()} or lower(${countriesTable.code}) = ${countryName.toLowerCase()}`,
    ).limit(1);
    if (!c) throw new UnknownCountryError(countryName);
    canonicalCountry = c.name;
    countryId = c.id;
  }

  let canonicalCity: string | null = cityName;
  if (cityName && countryId != null) {
    const [existing] = await db.select().from(citiesTable).where(and(
      eq(citiesTable.countryId, countryId),
      sql`lower(${citiesTable.name}) = ${cityName.toLowerCase()}`,
    )).limit(1);
    if (existing) {
      canonicalCity = existing.name;
    } else {
      try {
        const [created] = await db.insert(citiesTable).values({
          countryId, name: cityName,
        }).returning();
        canonicalCity = created.name;
      } catch {
        const [row] = await db.select().from(citiesTable).where(and(
          eq(citiesTable.countryId, countryId),
          sql`lower(${citiesTable.name}) = ${cityName.toLowerCase()}`,
        )).limit(1);
        if (row) canonicalCity = row.name;
      }
    }
  }

  return { country: canonicalCountry, city: canonicalCity };
}

export default router;
