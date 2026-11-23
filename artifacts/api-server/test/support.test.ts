import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";

const mail = vi.hoisted(() => vi.fn(async (_message: unknown) => ({ delivered: true })));
vi.mock("../src/lib/email", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/lib/email")>(),
  sendEmail: mail,
}));
vi.mock("@clerk/express", () => ({
  getAuth: (req: { headers: Record<string, string> }) => ({ userId: req.headers["x-test-clerk-user"] ?? null }),
  clerkClient: { users: { getUser: vi.fn() } },
}));

const { db, pool, usersTable, adminAccountsTable, supportLinksTable, supportTicketsTable } = await import("@workspace/db");
const { signAdminToken, ADMIN_COOKIE_NAME } = await import("../src/lib/adminAuth");
const app = express().use(express.json(), cookieParser()).use("/api", (await import("../src/routes/support")).default);
const owner = `support-owner-${randomUUID()}`;
const other = `support-other-${randomUUID()}`;
const base = "/api/support";
let users: number[] = [];
let admins: number[] = [];
let adminCookie: string;
let lockedCookie: string;
const valid = { category: "booking", subject: "Réservation introuvable", message: "Je ne retrouve plus mon rendez-vous." };
const create = () => request(app).post(`${base}/tickets`).set("x-test-clerk-user", owner).send(valid);

beforeAll(async () => {
  users = (await db.insert(usersTable).values([
    { clerkUserId: owner, name: "Ticket owner", email: `${owner}@example.com` },
    { clerkUserId: other, name: "Different account", email: `${other}@example.com`, role: "barber" },
  ]).returning({ id: usersTable.id })).map(({ id }) => id);
  admins = (await db.insert(adminAccountsTable).values([
    { name: "Support admin", email: `${owner}-admin@example.com`, passwordHash: "unused", mustChangePassword: false },
    { name: "Locked admin", email: `${owner}-locked@example.com`, passwordHash: "unused", mustChangePassword: true },
  ]).returning({ id: adminAccountsTable.id })).map(({ id }) => id);
  adminCookie = `${ADMIN_COOKIE_NAME}=${signAdminToken(admins[0]!)}`;
  lockedCookie = `${ADMIN_COOKIE_NAME}=${signAdminToken(admins[1]!)}`;
});
beforeEach(() => mail.mockClear());
afterAll(async () => {
  if (users.length) await db.delete(usersTable).where(inArray(usersTable.id, users));
  if (admins.length) await db.delete(adminAccountsTable).where(inArray(adminAccountsTable.id, admins));
  await pool.end();
});

describe("support tickets", () => {
  it("rejects missing auth and invalid requests without sending an email", async () => {
    expect((await request(app).get(`${base}/tickets`)).status).toBe(401);
    expect((await request(app).post(`${base}/tickets`).send(valid)).status).toBe(401);
    expect((await request(app).post(`${base}/tickets`).set("x-test-clerk-user", owner).send({ ...valid, message: " ".repeat(12) })).status).toBe(400);
    expect((await request(app).get(`${base}/tickets`).set("Cookie", lockedCookie)).status).toBe(403);
    expect(mail).not.toHaveBeenCalled();
  });

  it("persists the first message and sends only a private ticket reference to the requested inbox", async () => {
    const created = await create();
    expect(created.status).toBe(201);
    expect(created.headers["cache-control"]).toBe("private, no-store");
    const id = created.body.ticket.id;
    expect(created.body).toMatchObject({ ticket: { subject: valid.subject, status: "open" }, messages: [{ author: "user", message: valid.message }] });
    expect(mail).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      to: "zbarberbook.tg@gmail.com", subject: expect.stringContaining(`#${id}`),
    }));
    expect(JSON.stringify(mail.mock.calls)).not.toContain(valid.message);
    const ownList = await request(app).get(`${base}/tickets`).set("x-test-clerk-user", owner);
    expect(ownList.body.items.map((t: { id: number }) => t.id)).toContain(id);
    const outsider = await request(app).get(`${base}/tickets`).set("x-test-clerk-user", other);
    expect(outsider.body.items).toEqual([]);
    expect((await request(app).get(`${base}/tickets/${id}`).set("x-test-clerk-user", other)).status).toBe(404);
    expect((await request(app).post(`${base}/tickets/${id}/messages`).set("x-test-clerk-user", other).send({ message: "Autre compte" })).status).toBe(404);
    const adminList = await request(app).get(`${base}/tickets`).set("Cookie", adminCookie);
    expect(adminList.body.items).toContainEqual(expect.objectContaining({ id, requesterName: "Ticket owner" }));
  });

  it("lets both sides reply, but only admins close; a closed ticket stays read-only", async () => {
    const created = await create();
    expect(created.status).toBe(201);
    const endpoint = `${base}/tickets/${created.body.ticket.id}`;
    const reply = await request(app).post(`${endpoint}/messages`).set("Cookie", adminCookie).send({ message: "Nous vérifions votre demande.", author: "user" });
    expect(reply.status).toBe(201);
    expect(reply.body.author).toBe("admin");
    expect((await request(app).post(`${endpoint}/messages`).set("x-test-clerk-user", owner)
      .send({ message: "Merci pour votre réponse.", author: "admin" })).body.author).toBe("user");
    expect((await request(app).post(`${endpoint}/close`).set("x-test-clerk-user", owner)).status).toBe(401);
    expect((await request(app).post(`${endpoint}/close`).set("Cookie", adminCookie)).body.status).toBe("closed");
    expect((await request(app).post(`${endpoint}/messages`).set("x-test-clerk-user", owner).send({ message: "Après la clôture." })).status).toBe(409);
    expect((await request(app).post(`${endpoint}/messages`).set("Cookie", adminCookie).send({ message: "Après la clôture." })).status).toBe(409);
    const read = await request(app).get(endpoint).set("x-test-clerk-user", owner);
    expect(read.body.ticket.status).toBe("closed");
    expect(read.body.messages.map((m: { author: string }) => m.author)).toEqual(["user", "admin", "user"]);
  });

  it("keeps the ticket available when SMTP does not deliver", async () => {
    mail.mockRejectedValueOnce(new Error("SMTP unavailable"));
    const created = await create();
    expect(created.status).toBe(201);
    expect((await request(app).get(`${base}/tickets/${created.body.ticket.id}`).set("x-test-clerk-user", owner)).status).toBe(200);
  });

  it("paginates by ticket id without exposing older private tickets belonging to other accounts", async () => {
    const drafts = Array.from({ length: 31 }, () => ({ userId: users[1]!, category: "other" as const, subject: "Pagination" }));
    await db.insert(supportTicketsTable).values(drafts);
    const first = await request(app).get(`${base}/tickets`).set("x-test-clerk-user", other);
    expect(first.body.items).toHaveLength(30);
    const next = await request(app).get(`${base}/tickets`).query({ before: first.body.nextBefore }).set("x-test-clerk-user", other);
    expect(next.body.items).toHaveLength(1);
    expect(next.body.items[0].id).toBeLessThan(first.body.nextBefore);
  });
});

describe("support links", () => {
  it("validates admin permissions, numbers and social domains; saving and clearing changes the public links", async () => {
    const endpoint = `${base}/links`;
    const [previous] = await db.select().from(supportLinksTable).where(eq(supportLinksTable.id, 1));
    const blank = { whatsapp: null, tiktok: null, instagram: null, facebook: null };
    const filled = { whatsapp: "+22890123456", tiktok: "https://www.tiktok.com/@zbarber", instagram: "https://www.instagram.com/zbarber/", facebook: "https://www.facebook.com/zbarber" };
    const initial = await request(app).get(endpoint);
    expect(initial.status).toBe(200);
    expect((await request(app).put(endpoint).set("x-test-clerk-user", owner).send(filled)).status).toBe(401);
    expect((await request(app).put(endpoint).set("Cookie", lockedCookie).send(filled)).status).toBe(403);
    for (const bad of [{ ...filled, whatsapp: "90123456" }, { ...filled, instagram: "https://instagram.com.example.org/" }, { ...filled, facebook: "http://facebook.com/zbarber" }]) {
      expect((await request(app).put(endpoint).set("Cookie", adminCookie).send(bad)).status).toBe(400);
    }
    try {
      expect((await request(app).put(endpoint).set("Cookie", adminCookie).send(filled)).body).toEqual(filled);
      expect((await request(app).get(endpoint)).body).toEqual(filled);
      expect((await request(app).put(endpoint).set("Cookie", adminCookie).send(blank)).body).toEqual(blank);
      expect((await request(app).get(endpoint)).body).toEqual(blank);
    } finally {
      if (previous) await db.insert(supportLinksTable).values(previous).onConflictDoUpdate({ target: supportLinksTable.id, set: previous });
      else await db.delete(supportLinksTable).where(eq(supportLinksTable.id, 1));
    }
  });
});
