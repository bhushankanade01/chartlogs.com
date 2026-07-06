import nodemailer from "nodemailer";
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

export async function sendEmail({ to, subject, text }: SendEmailOptions): Promise<void> {
  if (!isSmtpConfigured()) {
    logger.info({ to, subject }, "SMTP not configured — logging email instead of sending");
    logger.info({ to, subject, body: text }, "=== EMAIL (dev fallback) ===");
    return;
  }

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

  logger.info({ to, subject }, "Email sent");
}
