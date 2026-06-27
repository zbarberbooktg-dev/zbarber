import { db, reservationsTable, usersTable, barbersTable, servicesTable } from "@workspace/db";
import { and, eq, gt, lt, lte, isNull, inArray, sql } from "drizzle-orm";
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

// ── Barber document-deadline reminders ──
// After first validation a barber has DOCUMENT_WINDOW_DAYS to upload an official
// authorization document. Without nudges, many forget. We send up to two
// reminders as the deadline approaches: stage 1 when between 1 and 7 days
// remain, stage 2 when ≤1 day remains. `barbersTable.documentReminderStage` is
// the dedup marker (claim-then-send), mirroring the reservation reminder
// pattern.
//
// The windows are NON-overlapping (stage 1: >1d and ≤7d; stage 2: >now and
// ≤1d). If they overlapped, a barber first seen with ≤1 day left would be
// claimed by stage 1 and then immediately by stage 2 in the same sweep,
// firing both reminders back-to-back. With a lower bound on stage 1, each
// barber matches exactly one stage per sweep.
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DOC_REMINDER_STAGES = [
  { stage: 1, fromMs: ONE_DAY_MS, withinMs: 7 * ONE_DAY_MS, label: "7 jours" },
  { stage: 2, fromMs: 0, withinMs: ONE_DAY_MS, label: "1 jour" },
] as const;

// Public base URL of the mobile app, used to build the document-upload link.
function appPublicUrl(): string {
  const explicit = process.env.APP_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const domains = process.env.REPLIT_DOMAINS?.split(",").map((d) => d.trim()).filter(Boolean);
  if (domains && domains[0]) return `https://${domains[0]}/mobile`;
  return "";
}

export async function runDocumentReminderSweep(): Promise<number> {
  let sent = 0;
  // Capture a SINGLE `now` for the whole sweep so every stage's window is
  // derived from the same instant. If each stage recomputed `now`, the time
  // spent claiming/sending stage 1 would shift stage 2's window forward and
  // reopen an overlap band where a barber could be claimed by both stages.
  const now = new Date();

  // CLAIM PHASE — claim all stages up front, before any sending. Windows are
  // non-overlapping (stage 1: (now+1d, now+7d]; stage 2: (now, now+1d]), and
  // because every claim runs against the same `now` AND happens before the
  // send loop, a barber can be claimed by at most one stage per sweep. If a
  // barber's 7-day window was entirely missed (scheduler downtime spanning
  // days 23–29) they simply receive the 1-day reminder once — never both, never
  // zero.
  type ClaimedBarber = { id: number; userId: number; salonName: string; deadline: Date | null; stage: number; label: string };
  const allClaimed: ClaimedBarber[] = [];
  for (const { stage, fromMs, withinMs, label } of DOC_REMINDER_STAGES) {
    const windowStart = new Date(now.getTime() + fromMs);
    const windowEnd = new Date(now.getTime() + withinMs);
    const claimed = await db
      .update(barbersTable)
      .set({ documentReminderStage: stage })
      .where(
        and(
          eq(barbersTable.status, "awaiting_document"),
          isNull(barbersTable.documentUrl),
          lt(barbersTable.documentReminderStage, stage),
          gt(barbersTable.documentDeadline, windowStart),
          lte(barbersTable.documentDeadline, windowEnd),
        ),
      )
      .returning({
        id: barbersTable.id,
        userId: barbersTable.userId,
        salonName: barbersTable.salonName,
        deadline: barbersTable.documentDeadline,
      });
    for (const b of claimed) allClaimed.push({ ...b, stage, label });
  }

  if (allClaimed.length === 0) return 0;

  // SEND PHASE — fan out email + push for every claimed barber.
  const userIds = allClaimed.map((b) => b.userId);
  const owners = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(inArray(usersTable.id, userIds));
  const emailByUser = new Map(owners.map((o) => [o.id, o.email]));
  const url = appPublicUrl();

  for (const b of allClaimed) {
    const { stage, label } = b;
    const deadlineStr = b.deadline ? new Date(b.deadline).toLocaleDateString("fr-FR") : "";
    // Push (fire-and-forget; never throws).
    void sendPush(
      b.userId,
      "Document professionnel à transmettre ⏳",
      `Il vous reste ${label} pour téléverser votre document et finaliser la vérification de « ${b.salonName} ».`,
      { type: "barber_document_reminder", barberId: b.id, stage },
    );
    const email = emailByUser.get(b.userId);
    if (!email) continue;
    try {
      const { html, text } = renderEmail({
        title: `[Zbarber] Document professionnel à transmettre`,
        heading: "Votre vérification est presque terminée",
        intro: `Il vous reste ${label} pour transmettre le document officiel autorisant l'activité du salon « ${b.salonName} ».`,
        paragraphs: [
          "Sans document conforme avant la date limite, votre compte reste en attente et n'aura pas accès à toutes les fonctionnalités barbier.",
          "Téléversez votre licence professionnelle, certificat officiel ou autorisation administrative depuis votre profil dans l'application.",
        ],
        button: url ? { label: "Téléverser mon document", url } : undefined,
        note: deadlineStr ? `Date limite d'envoi : ${deadlineStr}.` : undefined,
      });
      await sendEmail({
        to: email,
        subject: `[Zbarber] Plus que ${label} pour transmettre votre document`,
        html,
        text,
      });
      sent += 1;
    } catch (err) {
      logger.error({ err, barberId: b.id }, "Failed to send barber document reminder");
    }
  }
  if (sent > 0) logger.info({ sent }, "Barber document reminders sent");
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
    runDocumentReminderSweep().catch((err) => logger.error({ err }, "Document reminder sweep failed"));
  }, 30 * 1000);
  timer = setInterval(() => {
    runReminderSweep().catch((err) => logger.error({ err }, "Reminder sweep failed"));
  }, SWEEP_INTERVAL_MS);
  // Re-engagement and barber document reminders are far less time-sensitive —
  // run them hourly.
  reengageTimer = setInterval(() => {
    runReengagementSweep().catch((err) => logger.error({ err }, "Re-engagement sweep failed"));
    runDocumentReminderSweep().catch((err) => logger.error({ err }, "Document reminder sweep failed"));
  }, 60 * 60 * 1000);
  void reengageTimer;
  logger.info({ intervalMs: SWEEP_INTERVAL_MS }, "Reservation reminder scheduler started");
}
