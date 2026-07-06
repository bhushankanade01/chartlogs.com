import nodemailer from "nodemailer";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { logger } from "./logger.js";

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
}

function isSmtpConfigured(): boolean {
  return !!(
    process.env["SMTP_HOST"] &&
    process.env["SMTP_PORT"] &&
    process.env["SMTP_USER"] &&
    process.env["SMTP_PASS"] &&
    process.env["SMTP_FROM"]
  );
}

function isResendConfigured(): boolean {
  // REPLIT_CONNECTORS_HOSTNAME is auto-injected when the Resend connector
  // is bound to this Repl via the Replit integrations system.
  return !!process.env["REPLIT_CONNECTORS_HOSTNAME"];
}

async function sendViaSmtp({ to, subject, text }: SendEmailOptions): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env["SMTP_HOST"],
    port: Number(process.env["SMTP_PORT"]),
    secure: Number(process.env["SMTP_PORT"]) === 465,
    auth: {
      user: process.env["SMTP_USER"],
      pass: process.env["SMTP_PASS"],
    },
  });

  await transporter.sendMail({
    from: process.env["SMTP_FROM"],
    to,
    subject,
    text,
  });

  logger.info({ to, subject }, "Email sent via SMTP");
}

async function sendViaResend({ to, subject, text }: SendEmailOptions): Promise<void> {
  const connectors = new ReplitConnectors();
  // Default sender uses Resend's test domain. Set RESEND_FROM (or SMTP_FROM)
  // to an address on a verified domain for production use (resend.com/domains).
  const from = process.env["RESEND_FROM"] ?? process.env["SMTP_FROM"] ?? "ChartLogs <onboarding@resend.dev>";

  // Proxy the Resend /emails call through the Replit connectors SDK.
  // The SDK handles identity, token refresh, and auth headers automatically.
  const response = await connectors.proxy("resend", "/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 403) {
      throw new Error(
        `Resend sandbox restriction: only the account owner's email can receive messages until a domain is verified at https://resend.com/domains. Raw: ${body}`
      );
    }
    throw new Error(`Resend API error ${response.status}: ${body}`);
  }

  logger.info({ to, subject }, "Email sent via Resend");
}

export async function sendEmail({ to, subject, text }: SendEmailOptions): Promise<void> {
  // Transport priority: SMTP (explicit user config) → Resend (Replit integration) → log fallback.
  // SMTP is tried first so that deliberately-configured credentials always take precedence.

  if (isSmtpConfigured()) {
    await sendViaSmtp({ to, subject, text });
    return;
  }

  if (isResendConfigured()) {
    await sendViaResend({ to, subject, text });
    return;
  }

  // Dev fallback — no transport configured; log email body so the flow stays testable
  logger.info({ to, subject }, "No email transport configured — logging email instead of sending");
  logger.info({ to, subject, body: text }, "=== EMAIL (dev fallback) ===");
}
