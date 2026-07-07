import { Router, type IRouter } from "express";
import { db, usersTable, sessionsTable, passwordResetTokensTable, loginHistoryTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { RegisterBody, LoginBody, ForgotPasswordBody, ResetPasswordBody, VerifyEmailBody } from "@workspace/api-zod";
import { sendEmail } from "../lib/email.js";

const router: IRouter = Router();

const BCRYPT_ROUNDS = 12;

/** Returns true if the hash was created with bcrypt (starts with $2b$ or $2a$) */
function isBcryptHash(hash: string): boolean {
  return hash.startsWith("$2b$") || hash.startsWith("$2a$");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    role: user.role,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    lastLogin: user.lastLogin ? user.lastLogin.toISOString() : null,
    subscriptionExpiresAt: user.subscriptionExpiresAt ? user.subscriptionExpiresAt.toISOString() : null,
    timezone: user.timezone,
    currency: user.currency,
    defaultLotSize: user.defaultLotSize ? parseFloat(user.defaultLotSize) : null,
    createdAt: user.createdAt.toISOString(),
  };
}

async function logLoginAttempt(opts: {
  userId?: number;
  email: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  failReason?: string;
}) {
  try {
    await db.insert(loginHistoryTable).values({
      userId: opts.userId ?? null,
      email: opts.email,
      ipAddress: opts.ipAddress ?? null,
      userAgent: opts.userAgent ?? null,
      success: opts.success,
      failReason: opts.failReason ?? null,
    });
  } catch {
    // non-critical — never fail the request due to logging
  }
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env["NODE_ENV"] === "test",
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env["NODE_ENV"] === "test",
});

router.post("/auth/register", authLimiter, async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password, name } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const verificationToken = generateToken();

  const [user] = await db.insert(usersTable).values({
    email: normalizedEmail,
    name: name.trim(),
    passwordHash,
    emailVerificationToken: verificationToken,
  }).returning();

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({ userId: user.id, token, expiresAt });

  req.log.info({ userId: user.id, email: normalizedEmail }, "New user registered");

  // Send verification email — fire-and-forget so registration never fails due to email issues
  const appUrl =
    process.env["APP_URL"] ??
    `https://${(process.env["REPLIT_DOMAINS"] ?? "localhost:80").split(",")[0]!.trim()}`;
  const verifyLink = `${appUrl}/verify-email?token=${verificationToken}`;
  sendEmail({
    to: normalizedEmail,
    subject: "ChartLogs — Verify your email",
    text: `Hi ${name.trim()},\n\nWelcome to ChartLogs! Click the link below to verify your email address.\n\n${verifyLink}\n\nIf you didn't create this account, you can safely ignore this email.\n\n— The ChartLogs Team`,
  }).catch((err: unknown) => {
    req.log.error({ err, userId: user.id }, "Failed to send verification email");
    req.log.info({ verifyLink }, "Verification link (email delivery failed — use this in dev/test)");
  });

  res.status(201).json({ user: formatUser(user), token });
});

router.post("/auth/login", authLimiter, async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();
  const ipAddress = req.ip ?? req.headers["x-forwarded-for"]?.toString();
  const userAgent = req.headers["user-agent"];

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));

  if (!user) {
    await logLoginAttempt({ email: normalizedEmail, ipAddress, userAgent, success: false, failReason: "user_not_found" });
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (!user.isActive) {
    await logLoginAttempt({ userId: user.id, email: normalizedEmail, ipAddress, userAgent, success: false, failReason: "account_disabled" });
    res.status(403).json({ error: "Your account has been disabled. Please contact support." });
    return;
  }

  // Detect legacy SHA256 hashes — reject with actionable message
  if (!isBcryptHash(user.passwordHash)) {
    await logLoginAttempt({ userId: user.id, email: normalizedEmail, ipAddress, userAgent, success: false, failReason: "legacy_hash" });
    res.status(401).json({ error: "Password format outdated — please use Forgot Password to set a new password." });
    return;
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    await logLoginAttempt({ userId: user.id, email: normalizedEmail, ipAddress, userAgent, success: false, failReason: "wrong_password" });
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await Promise.all([
    db.insert(sessionsTable).values({ userId: user.id, token, expiresAt }),
    db.update(usersTable).set({ lastLogin: new Date() }).where(eq(usersTable.id, user.id)),
    logLoginAttempt({ userId: user.id, email: normalizedEmail, ipAddress, userAgent, success: true }),
  ]);

  res.json({ user: formatUser(user), token });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  }
  res.json({ success: true });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const token = authHeader.slice(7);
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.token, token));
  if (!session || session.expiresAt < new Date()) {
    res.status(401).json({ error: "Session expired" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: "Account disabled" });
    return;
  }

  res.json(formatUser(user));
});

router.patch("/auth/me/settings", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const token = authHeader.slice(7);
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.token, token));
  if (!session || session.expiresAt < new Date()) {
    res.status(401).json({ error: "Session expired" });
    return;
  }

  const body = req.body as {
    name?: string;
    timezone?: string;
    currency?: string;
    defaultLotSize?: number | null;
  };

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.timezone !== undefined) updates.timezone = body.timezone;
  if (body.currency !== undefined) updates.currency = body.currency;
  if (body.defaultLotSize !== undefined) updates.defaultLotSize = body.defaultLotSize != null ? String(body.defaultLotSize) : null;

  const [user] = await db.update(usersTable)
    .set(updates as Partial<typeof usersTable.$inferSelect>)
    .where(eq(usersTable.id, session.userId))
    .returning();

  res.json(formatUser(user));
});

router.post("/auth/verify-email", async (req, res): Promise<void> => {
  const parsed = VerifyEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { token } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.emailVerificationToken, token));

  if (!user) {
    res.status(400).json({ error: "Invalid or expired verification link. Please request a new one." });
    return;
  }

  if (user.emailVerified) {
    res.json({ success: true });
    return;
  }

  await db
    .update(usersTable)
    .set({ emailVerified: true, emailVerificationToken: null })
    .where(eq(usersTable.id, user.id));

  req.log.info({ userId: user.id }, "Email verified");
  res.json({ success: true });
});

router.post("/auth/forgot-password", strictLimiter, async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const normalizedEmail = parsed.data.email.toLowerCase().trim();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));

  // Always return 200 to prevent email enumeration
  if (user && user.isActive) {
    const resetToken = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokensTable).values({
      userId: user.id,
      token: resetToken,
      expiresAt,
    });

    // APP_URL takes priority (set this to https://chartlogs.com in production secrets).
    // Falls back to first Replit domain, then localhost for dev.
    const appUrl =
      process.env["APP_URL"] ??
      `https://${(process.env["REPLIT_DOMAINS"] ?? "localhost:80").split(",")[0]!.trim()}`;
    const resetLink = `${appUrl}/reset-password?token=${resetToken}`;

    req.log.info({ userId: user.id, email: normalizedEmail }, "Password reset requested");

    try {
      await sendEmail({
        to: normalizedEmail,
        subject: "ChartLogs — Reset your password",
        text: `Hi ${user.name ?? "there"},\n\nClick the link below to reset your ChartLogs password. This link expires in 1 hour.\n\n${resetLink}\n\nIf you didn't request this, you can safely ignore this email.\n\n— The ChartLogs Team`,
      });
    } catch (err) {
      // Log the failure but never surface it — always return 200 to prevent email enumeration
      req.log.error({ err, userId: user.id }, "Failed to send password reset email");
      req.log.info({ resetLink }, "Password reset link (email delivery failed — use this in dev/test)");
    }
  }

  res.json({ success: true });
});

router.post("/auth/reset-password", strictLimiter, async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { token, password } = parsed.data;

  const [resetToken] = await db.select().from(passwordResetTokensTable)
    .where(and(
      eq(passwordResetTokensTable.token, token),
      eq(passwordResetTokensTable.used, false)
    ));

  if (!resetToken || resetToken.expiresAt < new Date()) {
    res.status(400).json({ error: "Invalid or expired reset token. Please request a new one." });
    return;
  }

  const newPasswordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await Promise.all([
    db.update(usersTable).set({ passwordHash: newPasswordHash }).where(eq(usersTable.id, resetToken.userId)),
    db.update(passwordResetTokensTable).set({ used: true }).where(eq(passwordResetTokensTable.id, resetToken.id)),
    db.delete(sessionsTable).where(eq(sessionsTable.userId, resetToken.userId)),
  ]);

  req.log.info({ userId: resetToken.userId }, "Password reset successfully");
  res.json({ success: true });
});

export default router;
