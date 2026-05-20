import { Router, type IRouter } from "express";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { RegisterBody, LoginBody } from "@workspace/api-zod";

const router: IRouter = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + process.env.SESSION_SECRET).digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password, name } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const passwordHash = hashPassword(password);
  const [user] = await db.insert(usersTable).values({ email, name, passwordHash }).returning();

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({ userId: user.id, token, expiresAt });

  res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      timezone: user.timezone,
      currency: user.currency,
      defaultLotSize: user.defaultLotSize ? parseFloat(user.defaultLotSize) : null,
      createdAt: user.createdAt.toISOString(),
    },
    token,
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const passwordHash = hashPassword(password);

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || user.passwordHash !== passwordHash) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({ userId: user.id, token, expiresAt });

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      timezone: user.timezone,
      currency: user.currency,
      defaultLotSize: user.defaultLotSize ? parseFloat(user.defaultLotSize) : null,
      createdAt: user.createdAt.toISOString(),
    },
    token,
  });
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

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    timezone: user.timezone,
    currency: user.currency,
    defaultLotSize: user.defaultLotSize ? parseFloat(user.defaultLotSize) : null,
    createdAt: user.createdAt.toISOString(),
  });
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

  const [user] = await db.update(usersTable).set(updates as Partial<typeof usersTable.$inferSelect>).where(eq(usersTable.id, session.userId)).returning();

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    timezone: user.timezone,
    currency: user.currency,
    defaultLotSize: user.defaultLotSize ? parseFloat(user.defaultLotSize) : null,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
