import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "./logger";

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let cachedTransporter: Transporter | null = null;
let cachedFrom: string | null = null;

function readSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user || "no-reply@localhost";
  if (!host || !user || !pass || Number.isNaN(port)) return null;
  return { host, port, user, pass, from, secure: port === 465 };
}

function getTransporter(): { transporter: Transporter; from: string } | null {
  if (cachedTransporter && cachedFrom) return { transporter: cachedTransporter, from: cachedFrom };
  const cfg = readSmtpConfig();
  if (!cfg) return null;
  cachedTransporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  cachedFrom = cfg.from;
  return { transporter: cachedTransporter, from: cachedFrom };
}

/**
 * Send an email via SMTP. If SMTP is not configured, the email is logged to
 * stdout and the function resolves successfully — this lets the invite flow
 * work in dev without blocking on SMTP setup. In production, missing SMTP
 * config is loud (logged at warn level).
 */
export async function sendEmail(opts: SendEmailOptions): Promise<{ delivered: boolean }> {
  const ctx = getTransporter();
  if (!ctx) {
    const level = process.env.NODE_ENV === "production" ? "warn" : "info";
    // Intentionally OMIT the body — invitation/reset emails contain
    // temporary credentials that must never be written to logs. Surface
    // only metadata so operators know SMTP is missing.
    logger[level](
      { to: opts.to, subject: opts.subject },
      "SMTP not configured — email NOT sent. Set SMTP_HOST/PORT/USER/PASS/FROM env vars.",
    );
    return { delivered: false };
  }
  await ctx.transporter.sendMail({
    from: ctx.from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
  return { delivered: true };
}

export function isSmtpConfigured(): boolean {
  return readSmtpConfig() !== null;
}

// ── Branded email template ──────────────────────────────────────────────
// All platform emails share one professional, mobile-friendly HTML layout:
// a dark header with the Zbarber wordmark, a white content card, optional
// key/value detail rows + call-to-action button, and a muted footer. A plain
// text fallback is generated alongside for clients that don't render HTML.

const BRAND_GOLD = "#D4A017";
const BRAND_DARK = "#1A1B1E";
const BRAND_TAGLINE = "L'excellence du barbier";

/** Escape user-provided values before interpolating into email HTML. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailRow {
  label: string;
  value: string;
}

export interface EmailContent {
  /** Used for the document <title> / preheader. */
  title: string;
  /** Main heading shown at the top of the content card. */
  heading: string;
  /** Optional lead paragraph under the heading. */
  intro?: string;
  /** Optional key/value detail rows rendered as a clean table. */
  rows?: EmailRow[];
  /** Optional extra paragraphs after the rows. */
  paragraphs?: string[];
  /** Optional call-to-action button. */
  button?: { label: string; url: string };
  /** Optional small muted note (e.g. a security reminder). */
  note?: string;
}

/**
 * Render a branded Zbarber email. Returns both the HTML body and a plain-text
 * fallback that mirrors the same content.
 */
export function renderEmail(content: EmailContent): { html: string; text: string } {
  const year = new Date().getFullYear();

  const introHtml = content.intro
    ? `<p style="margin:0 0 18px;color:#374151;font-size:15px;line-height:23px;">${escapeHtml(content.intro)}</p>`
    : "";

  const rowsHtml = content.rows?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 18px;">${content.rows
        .map(
          (r) => `<tr>
            <td style="padding:9px 0;border-bottom:1px solid #ececec;color:#6b7280;font-size:13px;width:42%;vertical-align:top;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(r.label)}</td>
            <td style="padding:9px 0;border-bottom:1px solid #ececec;color:${BRAND_DARK};font-size:14px;font-weight:600;vertical-align:top;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(r.value)}</td>
          </tr>`,
        )
        .join("")}</table>`
    : "";

  const paragraphsHtml = (content.paragraphs ?? [])
    .map(
      (p) => `<p style="margin:0 0 14px;color:#374151;font-size:14px;line-height:22px;">${escapeHtml(p)}</p>`,
    )
    .join("");

  const buttonHtml = content.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;">
        <tr><td style="background-color:${BRAND_GOLD};border-radius:4px;">
          <a href="${escapeHtml(content.button.url)}" style="display:inline-block;padding:13px 26px;color:${BRAND_DARK};font-weight:700;font-size:14px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(content.button.label)}</a>
        </td></tr>
      </table>`
    : "";

  const noteHtml = content.note
    ? `<p style="margin:18px 0 0;padding:12px 14px;background-color:#faf6ea;border-left:3px solid ${BRAND_GOLD};color:#6b5d2f;font-size:13px;line-height:20px;">${escapeHtml(content.note)}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(content.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.intro ?? content.title)}</span>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f5;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      <tr>
        <td style="background-color:${BRAND_DARK};padding:30px 32px;text-align:center;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:23px;font-weight:700;letter-spacing:5px;color:#ffffff;text-transform:uppercase;">ZBARBER</div>
          <div style="height:2px;width:42px;background-color:${BRAND_GOLD};margin:11px auto 0;"></div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;color:#9ca3af;text-transform:uppercase;margin-top:11px;">${escapeHtml(BRAND_TAGLINE)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">
          <h1 style="margin:0 0 16px;color:${BRAND_DARK};font-size:20px;line-height:27px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(content.heading)}</h1>
          ${introHtml}
          ${rowsHtml}
          ${paragraphsHtml}
          ${buttonHtml}
          ${noteHtml}
        </td>
      </tr>
      <tr>
        <td style="background-color:#fafafa;border-top:1px solid #ececec;padding:22px 32px;text-align:center;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9ca3af;line-height:18px;">
            &copy; ${year} Zbarber &middot; ${escapeHtml(BRAND_TAGLINE)}<br>
            Cet email vous a été envoyé automatiquement, merci de ne pas y répondre.
          </div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const textParts: string[] = ["ZBARBER", "========", "", content.heading];
  if (content.intro) textParts.push("", content.intro);
  if (content.rows?.length) {
    textParts.push("");
    for (const r of content.rows) textParts.push(`${r.label} : ${r.value}`);
  }
  if (content.paragraphs?.length) textParts.push("", ...content.paragraphs);
  if (content.button) textParts.push("", `${content.button.label} : ${content.button.url}`);
  if (content.note) textParts.push("", content.note);
  textParts.push("", "—", `Zbarber · ${year} · ${BRAND_TAGLINE}`);
  const text = textParts.join("\n");

  return { html, text };
}

/**
 * The address that receives all platform notifications destined for the admin
 * team (new barber registrations, financing requests, account-deletion
 * requests, etc.). Overridable via ADMIN_NOTIFICATION_EMAIL; defaults to the
 * Zbarber contact inbox.
 */
export const ADMIN_NOTIFICATION_EMAIL =
  process.env.ADMIN_NOTIFICATION_EMAIL?.trim() || "zbarberbook@gmail.com";

export interface AdminNotification {
  /** Lead sentence describing what happened. */
  intro: string;
  /** Key/value details of the event. */
  rows?: EmailRow[];
  /** Optional muted note. */
  note?: string;
}

/**
 * Send a branded notification email to the admin team. Fire-and-forget: never
 * throws, so callers can invoke it without awaiting and a mail failure can
 * never break the originating request. If SMTP is unconfigured the message is
 * logged (see sendEmail).
 */
export function notifyAdmin(subject: string, body: AdminNotification): void {
  const { html, text } = renderEmail({
    title: `[Zbarber] ${subject}`,
    heading: subject,
    intro: body.intro,
    rows: body.rows,
    note: body.note,
  });
  void sendEmail({ to: ADMIN_NOTIFICATION_EMAIL, subject: `[Zbarber] ${subject}`, html, text }).catch((err) => {
    logger.error({ err, subject }, "Failed to send admin notification email");
  });
}
