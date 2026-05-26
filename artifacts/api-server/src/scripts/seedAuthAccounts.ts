import { createClerkClient } from "@clerk/express";
import { db, usersTable, barbersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

type Spec = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "admin" | "client" | "barber";
  salon?: { salonName: string; city: string; phone: string };
};

const ACCOUNTS: Spec[] = [
  { email: "admin@globalbarber.com", password: "AdminGB!2026", firstName: "Admin", lastName: "Global Barber", role: "admin" },
  { email: "client.demo@globalbarber.com", password: "ClientGB!2026", firstName: "Client", lastName: "Démo", role: "client" },
  { email: "barber.demo@globalbarber.com", password: "BarberGB!2026", firstName: "Barber", lastName: "Démo", role: "barber",
    salon: { salonName: "Salon Démo", city: "Abidjan", phone: "+225 00 00 00 00" } },
];

async function findOrCreateClerkUser(spec: Spec) {
  const existing = await clerk.users.getUserList({ emailAddress: [spec.email] });
  if (existing.data.length) {
    const u = existing.data[0];
    console.log(`  already exists in Clerk: ${u.id}`);
    return u;
  }
  const u = await clerk.users.createUser({
    emailAddress: [spec.email],
    password: spec.password,
    firstName: spec.firstName,
    lastName: spec.lastName,
    skipPasswordChecks: true,
  });
  console.log(`  created in Clerk: ${u.id}`);
  return u;
}

async function upsertLocalUser(clerkUserId: string, spec: Spec) {
  const [byClerk] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkUserId)).limit(1);
  if (byClerk) {
    const [updated] = await db.update(usersTable)
      .set({ role: spec.role, status: "active", name: `${spec.firstName} ${spec.lastName}`.trim() })
      .where(eq(usersTable.id, byClerk.id)).returning();
    return updated;
  }
  const [byEmail] = await db.select().from(usersTable).where(eq(usersTable.email, spec.email)).limit(1);
  if (byEmail) {
    const [updated] = await db.update(usersTable)
      .set({ clerkUserId, role: spec.role, status: "active" })
      .where(eq(usersTable.id, byEmail.id)).returning();
    return updated;
  }
  const [created] = await db.insert(usersTable).values({
    clerkUserId, email: spec.email, name: `${spec.firstName} ${spec.lastName}`.trim(),
    role: spec.role, status: "active",
  }).returning();
  return created;
}

async function ensureBarberProfile(userId: number, salon: NonNullable<Spec["salon"]>) {
  const [existing] = await db.select().from(barbersTable).where(eq(barbersTable.userId, userId)).limit(1);
  if (existing) {
    if (existing.status !== "approved") {
      await db.update(barbersTable).set({ status: "approved" }).where(eq(barbersTable.id, existing.id));
    }
    return existing.id;
  }
  const [created] = await db.insert(barbersTable).values({ userId, ...salon, status: "approved" }).returning();
  return created.id;
}

async function main() {
  for (const spec of ACCOUNTS) {
    console.log(`\n${spec.email} (${spec.role})`);
    const cu = await findOrCreateClerkUser(spec);
    const local = await upsertLocalUser(cu.id, spec);
    console.log(`  DB user id=${local.id} role=${local.role} status=${local.status}`);
    if (spec.role === "barber" && spec.salon) {
      const bid = await ensureBarberProfile(local.id, spec.salon);
      console.log(`  barber profile id=${bid} status=approved`);
    }
  }
  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
