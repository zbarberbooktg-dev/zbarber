import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { randomUUID } from "crypto";

// ── Mocks ────────────────────────────────────────────────────────────────
// The sweep's only outward side effects are email + push. We replace both so
// we can (a) avoid real network calls and (b) record exactly who was notified.
// Each seeded barber owns a user with a unique email, so we can attribute every
// captured email back to a specific barber.
type SentEmail = { to: string; subject: string };
type SentPush = { userId: number; title: string };
const sentEmails: SentEmail[] = [];
const sentPushes: SentPush[] = [];

vi.mock("../src/lib/email", () => ({
  notifyAdmin: vi.fn(),
  sendEmail: vi.fn(async (msg: { to: string; subject: string }) => {
    sentEmails.push({ to: msg.to, subject: msg.subject });
  }),
  renderEmail: vi.fn(() => ({ html: "", text: "" })),
}));
vi.mock("../src/lib/push", () => ({
  sendPush: vi.fn(async (userId: number, title: string) => {
    sentPushes.push({ userId, title });
  }),
}));

// ── Imports that depend on the mocks above ───────────────────────────────
const { db, barbersTable, usersTable, pool } = await import("@workspace/db");
const { eq, inArray } = await import("drizzle-orm");
const { runDocumentReminderSweep } = await import("../src/lib/reminderScheduler");

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

// Historical deadline states must no longer cause reminders or status changes.
type Fixture = { userId: number; barberId: number; email: string };
let fiveDay: Fixture;
let twelveHour: Fixture;
let submitted: Fixture;
let overdue: Fixture;

async function seedBarber(opts: {
  salonName: string;
  deadline: Date;
  documentUrl: string | null;
}): Promise<Fixture> {
  const email = `doc-reminder-${randomUUID()}@example.com`;
  const [user] = await db
    .insert(usersTable)
    .values({
      clerkUserId: `test_clerk_${randomUUID()}`,
      name: opts.salonName,
      email,
      role: "barber",
      status: "active",
    })
    .returning();
  const [barber] = await db
    .insert(barbersTable)
    .values({
      userId: user!.id,
      salonName: opts.salonName,
      city: "Kinshasa",
      status: "awaiting_document",
      documentUrl: opts.documentUrl,
      documentDeadline: opts.deadline,
      documentReminderStage: 0,
    })
    .returning();
  return { userId: user!.id, barberId: barber!.id, email };
}

beforeAll(async () => {
  const now = Date.now();
  fiveDay = await seedBarber({
    salonName: "Salon 5 jours",
    deadline: new Date(now + 5 * DAY_MS),
    documentUrl: null,
  });
  twelveHour = await seedBarber({
    salonName: "Salon 12 heures",
    deadline: new Date(now + 12 * HOUR_MS),
    documentUrl: null,
  });
  submitted = await seedBarber({
    salonName: "Salon doc envoyé",
    // Inside the stage-1 window, but the document is already uploaded, so the
    // `documentUrl IS NULL` predicate must exclude it.
    deadline: new Date(now + 5 * DAY_MS),
    documentUrl: `/objects/uploads/${randomUUID()}.pdf`,
  });
  overdue = await seedBarber({
    salonName: "Salon en retard",
    deadline: new Date(now - 2 * DAY_MS),
    documentUrl: null,
  });
});

afterAll(async () => {
  const barberIds = [fiveDay, twelveHour, submitted, overdue].map((f) => f.barberId);
  const userIds = [fiveDay, twelveHour, submitted, overdue].map((f) => f.userId);
  await db.delete(barbersTable).where(inArray(barbersTable.id, barberIds));
  await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  await pool.end();
});

beforeEach(() => {
  sentEmails.length = 0;
  sentPushes.length = 0;
});

// All seeded barbers (used to ignore any unrelated rows already in the dev DB
// when asserting per-recipient notification counts).
function emailsToOurFixtures(): SentEmail[] {
  const ours = new Set([fiveDay.email, twelveHour.email, submitted.email, overdue.email]);
  return sentEmails.filter((e) => ours.has(e.to));
}

async function stageOf(barberId: number): Promise<number> {
  const [b] = await db
    .select({ stage: barbersTable.documentReminderStage })
    .from(barbersTable)
    .where(eq(barbersTable.id, barberId))
    .limit(1);
  return b!.stage;
}

describe("runDocumentReminderSweep", () => {
  it("sends no document email or push regardless of historical deadline or upload", async () => {
    expect(await runDocumentReminderSweep()).toBe(0);
    expect(sentEmails).toHaveLength(0);
    expect(sentPushes).toHaveLength(0);
    for (const f of [fiveDay, twelveHour, submitted, overdue]) {
      expect(await stageOf(f.barberId)).toBe(0);
    }
  });

  it("repeated sweeps preserve all legacy statuses, documents and deadlines", async () => {
    const ids = [fiveDay, twelveHour, submitted, overdue].map((f) => f.barberId);
    const before = await db.select().from(barbersTable).where(inArray(barbersTable.id, ids)).orderBy(barbersTable.id);
    await runDocumentReminderSweep();
    await runDocumentReminderSweep();
    const after = await db.select().from(barbersTable).where(inArray(barbersTable.id, ids)).orderBy(barbersTable.id);
    expect(after).toEqual(before);
    expect(after.every((b) => b.status === "awaiting_document")).toBe(true);
    expect(sentEmails).toHaveLength(0);
    expect(sentPushes).toHaveLength(0);
  });

  it("an approved salon with no document and an expired historical deadline is never downgraded", async () => {
    await db.update(barbersTable).set({ status: "approved" }).where(eq(barbersTable.id, overdue.barberId));
    await runDocumentReminderSweep();
    const [b] = await db
      .select({ status: barbersTable.status, stage: barbersTable.documentReminderStage })
      .from(barbersTable)
      .where(eq(barbersTable.id, overdue.barberId))
      .limit(1);
    expect(b!.status).toBe("approved");
    expect(b!.stage).toBe(0);
    expect(emailsToOurFixtures().filter((e) => e.to === overdue.email)).toHaveLength(0);
    const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, overdue.userId));
    expect(owner!.role).toBe("barber");
  });
});
