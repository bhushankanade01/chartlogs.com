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

function isResendApiKeyConfigured(): boolean {
  return !!process.env["RESEND_API_KEY"];
}

function isResendConnectorConfigured(): boolean {
  // REPLIT_CONNECTORS_HOSTNAME is only available in the dev environment,
  // not in deployed autoscale — use RESEND_API_KEY for production instead.
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

async function sendViaResendApiKey({ to, subject, text }: SendEmailOptions): Promise<void> {
  // Direct Resend API call — works in both dev and production (deployed autoscale).
  // Requires RESEND_API_KEY. Domain must be verified at resend.com/domains for
  // sending to arbitrary recipients (sandbox only allows account owner's email).
  const from = process.env["RESEND_FROM"] ?? process.env["SMTP_FROM"] ?? "ChartLogs <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env["RESEND_API_KEY"]}`,
    },
    body: JSON.stringify({ from, to, subject, text }),
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 403) {
      throw new Error(
        `Resend sandbox restriction: verify your domain at https://resend.com/domains and set RESEND_FROM to use it. Raw: ${body}`
      );
    }
    throw new Error(`Resend API error ${response.status}: ${body}`);
  }

  logger.info({ to, subject }, "Email sent via Resend API key");
}

async function sendViaResendConnector({ to, subject, text }: SendEmailOptions): Promise<void> {
  // Replit connectors SDK proxy — only works in the dev/workspace environment.
  const connectors = new ReplitConnectors();
  const from = process.env["RESEND_FROM"] ?? process.env["SMTP_FROM"] ?? "ChartLogs <onboarding@resend.dev>";

  const response = await connectors.proxy("resend", "/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 403) {
      throw new Error(
        `Resend sandbox restriction: verify your domain at https://resend.com/domains. Raw: ${body}`
      );
    }
    throw new Error(`Resend connector error ${response.status}: ${body}`);
  }

  logger.info({ to, subject }, "Email sent via Resend connector (dev)");
}

export async function sendEmail({ to, subject, text }: SendEmailOptions): Promise<void> {
  // Transport priority:
  // 1. SMTP — explicit user credentials, works everywhere
  // 2. Resend API key — direct API call, works in dev + production
  // 3. Resend connector — Replit SDK proxy, dev environment only
  // 4. Log fallback — no transport configured

  if (isSmtpConfigured()) {
    await sendViaSmtp({ to, subject, text });
    return;
  }

  if (isResendApiKeyConfigured()) {
    await sendViaResendApiKey({ to, subject, text });
    return;
  }

  if (isResendConnectorConfigured()) {
    await sendViaResendConnector({ to, subject, text });
    return;
  }

  logger.info({ to, subject }, "No email transport configured — logging email instead of sending");
  logger.info({ to, subject, body: text }, "=== EMAIL (dev fallback) ===");
}
