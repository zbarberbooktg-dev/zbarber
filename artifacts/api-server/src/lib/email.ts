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
