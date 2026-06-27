import { db, reservationsTable, usersTable, barbersTable, servicesTable } from "@workspace/db";
import { and, eq, gt, lte, isNull, inArray } from "drizzle-orm";
import { sendEmail, renderEmail } from "./email";
import { logger } from "./logger";

// How often the sweep runs.
const SWEEP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
// Reminders go out for any upcoming reservation within the next 24h.
// Using a single upper bound (rather than a narrow [23h,24h] band) means a
// reservation is still reminded if the scheduler was down during the ideal
// window — it simply gets picked up on the next sweep, as long as it's still
// in the future.
const LEAD_MAX_MS = 24 * 60 * 60 * 1000;

function formatWhen(date: Date): string {
  return date.toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function runReminderSweep(): Promise<number> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + LEAD_MAX_MS);

  // Atomically CLAIM the reservations first: set reminderSentAt in the same
  // statement that selects unsent rows. This guarantees that two overlapping
  // sweeps (or multiple API instances) can never both pick the same row, so
  // a client is never emailed twice. We send emails only for rows we claimed.
  const claimed = await db
    .update(reservationsTable)
    .set({ reminderSentAt: now })
    .where(
      and(
        inArray(reservationsTable.status, ["pending", "confirmed"]),
        isNull(reservationsTable.reminderSentAt),
        gt(reservationsTable.scheduledAt, now),
        lte(reservationsTable.scheduledAt, windowEnd),
      ),
    )
    .returning({ id: reservationsTable.id });

  if (claimed.length === 0) return 0;
  const ids = claimed.map((r) => r.id);

  const rows = await db
    .select({
      id: reservationsTable.id,
      scheduledAt: reservationsTable.scheduledAt,
      clientName: usersTable.name,
      clientEmail: usersTable.email,
      salonName: barbersTable.salonName,
      serviceName: servicesTable.name,
    })
    .from(reservationsTable)
    .leftJoin(usersTable, eq(reservationsTable.clientId, usersTable.id))
    .leftJoin(barbersTable, eq(reservationsTable.barberId, barbersTable.id))
    .leftJoin(servicesTable, eq(reservationsTable.serviceId, servicesTable.id))
    .where(inArray(reservationsTable.id, ids));

  let sent = 0;
  for (const r of rows) {
    // No email on file — already claimed above, nothing more to do.
    if (!r.clientEmail) continue;
    const when = formatWhen(new Date(r.scheduledAt));
    const salon = r.salonName ?? "votre salon";
    const service = r.serviceName ?? "votre prestation";
    try {
      const { html, text } = renderEmail({
        title: `Rappel de rendez-vous — ${salon}`,
        heading: "Rappel de votre rendez-vous",
        intro: `Bonjour ${r.clientName ?? ""}, ceci est un rappel pour votre rendez-vous de demain.`,
        rows: [
          { label: "Prestation", value: service },
          { label: "Salon", value: salon },
          { label: "Date et heure", value: when },
        ],
        note: "À bientôt chez Zbarber !",
      });
      await sendEmail({
        to: r.clientEmail,
        subject: `Rappel : votre rendez-vous chez ${salon} demain`,
        html,
        text,
      });
      sent += 1;
    } catch (err) {
      logger.error({ err, reservationId: r.id }, "Failed to send reservation reminder");
    }
  }
  if (sent > 0) logger.info({ sent }, "Reservation reminders sent");
  return sent;
}

let timer: NodeJS.Timeout | null = null;

export function startReminderScheduler(): void {
  if (timer) return;
  // Kick off shortly after boot, then on a fixed interval.
  setTimeout(() => {
    runReminderSweep().catch((err) => logger.error({ err }, "Reminder sweep failed"));
  }, 30 * 1000);
  timer = setInterval(() => {
    runReminderSweep().catch((err) => logger.error({ err }, "Reminder sweep failed"));
  }, SWEEP_INTERVAL_MS);
  logger.info({ intervalMs: SWEEP_INTERVAL_MS }, "Reservation reminder scheduler started");
}
