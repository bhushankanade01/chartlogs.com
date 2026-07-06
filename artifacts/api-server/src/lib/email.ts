import nodemailer from "nodemailer";
import { Resend } from "resend";
import { logger } from "./logger.js";

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
}

function isResendConfigured(): boolean {
  return !!process.env["RESEND_API_KEY"];
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

async function sendViaResend({ to, subject, text }: SendEmailOptions): Promise<void> {
  const resend = new Resend(process.env["RESEND_API_KEY"]);
  const from = process.env["SMTP_FROM"] ?? process.env["RESEND_FROM"] ?? "ChartLogs <noreply@chartlogs.app>";

  const { error } = await resend.emails.send({ from, to, subject, text });
  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
  logger.info({ to, subject }, "Email sent via Resend");
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

export async function sendEmail({ to, subject, text }: SendEmailOptions): Promise<void> {
  if (isResendConfigured()) {
    await sendViaResend({ to, subject, text });
    return;
  }

  if (isSmtpConfigured()) {
    await sendViaSmtp({ to, subject, text });
    return;
  }

  // Dev fallback — no email transport configured
  logger.info({ to, subject }, "No email transport configured — logging email instead of sending");
  logger.info({ to, subject, body: text }, "=== EMAIL (dev fallback) ===");
}
