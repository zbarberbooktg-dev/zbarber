import { db, reservationsTable, usersTable, barbersTable, servicesTable } from "@workspace/db";
import { and, eq, gt, lte, isNull, inArray, sql } from "drizzle-orm";
import { sendEmail, renderEmail } from "./email";
import { sendPush } from "./push";
import { logger } from "./logger";

// How often the sweep runs.
const SWEEP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
// Clients idle for this long since their last booking get a re-engagement push.
const REENGAGE_AFTER_DAYS = 21;
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

/**
 * Send the post-appointment thank-you / review-invite email for a single
 * reservation. Uses claim-then-send: it atomically stamps `thankYouSentAt` only
 * if it was NULL, so the email is sent at most once even if "completed" is
 * applied repeatedly or two requests race. Never throws.
 */
export async function sendThankYouEmail(reservationId: number): Promise<boolean> {
  try {
    const now = new Date();
    // CLAIM: only succeeds while the row is completed and not yet thanked.
    const claimed = await db
      .update(reservationsTable)
      .set({ thankYouSentAt: now })
      .where(
        and(
          eq(reservationsTable.id, reservationId),
          eq(reservationsTable.status, "completed"),
          isNull(reservationsTable.thankYouSentAt),
        ),
      )
      .returning({ id: reservationsTable.id });
    if (claimed.length === 0) return false;

    const [row] = await db
      .select({
        clientName: usersTable.name,
        clientEmail: usersTable.email,
        salonName: barbersTable.salonName,
        serviceName: servicesTable.name,
      })
      .from(reservationsTable)
      .leftJoin(usersTable, eq(reservationsTable.clientId, usersTable.id))
      .leftJoin(barbersTable, eq(reservationsTable.barberId, barbersTable.id))
      .leftJoin(servicesTable, eq(reservationsTable.serviceId, servicesTable.id))
      .where(eq(reservationsTable.id, reservationId))
      .limit(1);

    if (!row?.clientEmail) return false;
    const salon = row.salonName ?? "votre salon";
    const service = row.serviceName ?? "votre prestation";
    const { html, text } = renderEmail({
      title: `Merci de votre visite — ${salon}`,
      heading: "Merci de votre visite !",
      intro: `Bonjour ${row.clientName ?? ""}, merci d'avoir choisi ${salon} pour votre ${service}. Nous espérons que vous êtes ravi(e) du résultat.`,
      paragraphs: [
        "Votre avis compte énormément. Prenez un instant pour noter votre expérience et laisser un commentaire — cela aide les autres clients et récompense votre barbier.",
        "Au plaisir de vous revoir très bientôt pour votre prochain rendez-vous.",
      ],
      note: "Réservez à nouveau directement depuis l'application Zbarber.",
    });
    await sendEmail({
      to: row.clientEmail,
      subject: `Merci de votre visite chez ${salon} — laissez votre avis`,
      html,
      text,
    });
    logger.info({ reservationId }, "Thank-you email sent");
    return true;
  } catch (err) {
    logger.error({ err, reservationId }, "Failed to send thank-you email");
    return false;
  }
}

/**
 * Re-engagement sweep: push clients who have booked before but have gone quiet
 * for REENGAGE_AFTER_DAYS, inviting them back. Claim-then-send via the user's
 * `lastReengagementAt` marker (reset to NULL on every new booking) guarantees
 * each quiet stretch triggers at most one push.
 */
export async function runReengagementSweep(): Promise<number> {
  const claimed = await db
    .update(usersTable)
    .set({ lastReengagementAt: new Date() })
    .where(
      and(
        isNull(usersTable.lastReengagementAt),
        sql`${usersTable.id} IN (
          SELECT ${reservationsTable.clientId}
          FROM ${reservationsTable}
          GROUP BY ${reservationsTable.clientId}
          HAVING MAX(${reservationsTable.createdAt}) < NOW() - (${REENGAGE_AFTER_DAYS} || ' days')::interval
        )`,
      ),
    )
    .returning({ id: usersTable.id });

  if (claimed.length === 0) return 0;
  let sent = 0;
  for (const u of claimed) {
    try {
      await sendPush(
        u.id,
        "Vous nous manquez !",
        "Cela fait un moment… Réservez votre prochain rendez-vous chez votre barbier préféré.",
        { type: "reengagement" },
      );
      sent += 1;
    } catch (err) {
      logger.error({ err, userId: u.id }, "Failed to send re-engagement push");
    }
  }
  if (sent > 0) logger.info({ sent }, "Re-engagement pushes sent");
  return sent;
}

let timer: NodeJS.Timeout | null = null;
let reengageTimer: NodeJS.Timeout | null = null;

export function startReminderScheduler(): void {
  if (timer) return;
  // Kick off shortly after boot, then on a fixed interval.
  setTimeout(() => {
    runReminderSweep().catch((err) => logger.error({ err }, "Reminder sweep failed"));
    runReengagementSweep().catch((err) => logger.error({ err }, "Re-engagement sweep failed"));
  }, 30 * 1000);
  timer = setInterval(() => {
    runReminderSweep().catch((err) => logger.error({ err }, "Reminder sweep failed"));
  }, SWEEP_INTERVAL_MS);
  // Re-engagement is far less time-sensitive — run it hourly.
  reengageTimer = setInterval(() => {
    runReengagementSweep().catch((err) => logger.error({ err }, "Re-engagement sweep failed"));
  }, 60 * 60 * 1000);
  void reengageTimer;
  logger.info({ intervalMs: SWEEP_INTERVAL_MS }, "Reservation reminder scheduler started");
}
