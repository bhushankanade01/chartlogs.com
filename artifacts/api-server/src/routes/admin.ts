import { Router, type IRouter } from "express";
import { db, usersTable, tradesTable, sessionsTable, loginHistoryTable } from "@workspace/db";
import { eq, desc, gte, sql, and, ilike, or } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

function formatAdminUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    plan: u.plan,
    role: u.role,
    isActive: u.isActive,
    emailVerified: u.emailVerified,
    lastLogin: u.lastLogin ? u.lastLogin.toISOString() : null,
    subscriptionExpiresAt: u.subscriptionExpiresAt ? u.subscriptionExpiresAt.toISOString() : null,
    stripeCustomerId: u.stripeCustomerId ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

// GET /admin/users — list users with optional search
router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  const conditions = search
    ? [or(ilike(usersTable.email, `%${search}%`), ilike(usersTable.name, `%${search}%`))]
    : [];

  const allUsers = await db.select().from(usersTable)
    .where(conditions.length ? and(...(conditions as [ReturnType<typeof ilike>])) : undefined)
    .orderBy(desc(usersTable.createdAt));

  const total = allUsers.length;
  const users = allUsers.slice(offset, offset + limit).map(formatAdminUser);

  res.json({ users, total });
});

// GET /admin/users/:id — get single user with trade stats
router.get("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(String(req.params.id));
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const trades = await db.select({
    count: sql<number>`COUNT(*)`,
    totalPnl: sql<number>`COALESCE(SUM(CAST(pnl AS NUMERIC)), 0)`,
  }).from(tradesTable).where(eq(tradesTable.userId, userId));

  const loginHistory = await db.select().from(loginHistoryTable)
    .where(eq(loginHistoryTable.userId, userId))
    .orderBy(desc(loginHistoryTable.createdAt))
    .limit(10);

  res.json({
    user: formatAdminUser(user),
    stats: {
      totalTrades: Number(trades[0]?.count ?? 0),
      totalPnl: Number(trades[0]?.totalPnl ?? 0),
    },
    loginHistory: loginHistory.map(h => ({
      id: h.id,
      success: h.success,
      ipAddress: h.ipAddress,
      userAgent: h.userAgent,
      failReason: h.failReason,
      createdAt: h.createdAt.toISOString(),
    })),
  });
});

// PATCH /admin/users/:id — update user (disable, change plan, change role)
router.patch("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(String(req.params.id));
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }

  if (userId === req.user!.id) {
    res.status(400).json({ error: "Cannot modify your own account via admin panel." });
    return;
  }

  const body = req.body as {
    isActive?: boolean;
    plan?: "free" | "pro" | "elite";
    role?: "user" | "admin";
    subscriptionExpiresAt?: string | null;
  };

  const updates: Record<string, unknown> = {};
  if (body.isActive !== undefined) updates.isActive = body.isActive;
  if (body.plan !== undefined) updates.plan = body.plan;
  if (body.role !== undefined) updates.role = body.role;
  if (body.subscriptionExpiresAt !== undefined) {
    updates.subscriptionExpiresAt = body.subscriptionExpiresAt ? new Date(body.subscriptionExpiresAt) : null;
  }

  const [user] = await db.update(usersTable)
    .set(updates as Partial<typeof usersTable.$inferSelect>)
    .where(eq(usersTable.id, userId))
    .returning();

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  // If disabling, delete all sessions
  if (body.isActive === false) {
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
  }

  req.log.info({ adminId: req.user!.id, targetUserId: userId, updates }, "Admin updated user");
  res.json(formatAdminUser(user));
});

// DELETE /admin/users/:id
router.delete("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(String(req.params.id));
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }

  if (userId === req.user!.id) {
    res.status(400).json({ error: "Cannot delete your own account." });
    return;
  }

  const [deleted] = await db.delete(usersTable).where(eq(usersTable.id, userId)).returning();
  if (!deleted) { res.status(404).json({ error: "User not found" }); return; }

  req.log.info({ adminId: req.user!.id, deletedUserId: userId }, "Admin deleted user");
  res.sendStatus(204);
});

// GET /admin/stats — platform analytics
router.get("/admin/stats", requireAdmin, async (req, res): Promise<void> => {
  const now = new Date();
  const day1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totals] = await db.select({
    totalUsers: sql<number>`COUNT(*)`,
    activeUsers: sql<number>`COUNT(*) FILTER (WHERE is_active = true)`,
    inactiveUsers: sql<number>`COUNT(*) FILTER (WHERE is_active = false)`,
    proUsers: sql<number>`COUNT(*) FILTER (WHERE plan = 'pro')`,
    eliteUsers: sql<number>`COUNT(*) FILTER (WHERE plan = 'elite')`,
    freeUsers: sql<number>`COUNT(*) FILTER (WHERE plan = 'free')`,
    newToday: sql<number>`COUNT(*) FILTER (WHERE created_at >= ${day1.toISOString()})`,
    newThisMonth: sql<number>`COUNT(*) FILTER (WHERE created_at >= ${day30.toISOString()})`,
  }).from(usersTable);

  const [dau] = await db.select({
    count: sql<number>`COUNT(DISTINCT user_id)`,
  }).from(loginHistoryTable).where(
    and(gte(loginHistoryTable.createdAt, day1), eq(loginHistoryTable.success, true))
  );

  const [mau] = await db.select({
    count: sql<number>`COUNT(DISTINCT user_id)`,
  }).from(loginHistoryTable).where(
    and(gte(loginHistoryTable.createdAt, day30), eq(loginHistoryTable.success, true))
  );

  const [wau] = await db.select({
    count: sql<number>`COUNT(DISTINCT user_id)`,
  }).from(loginHistoryTable).where(
    and(gte(loginHistoryTable.createdAt, day7), eq(loginHistoryTable.success, true))
  );

  const [tradeStats] = await db.select({
    totalTrades: sql<number>`COUNT(*)`,
  }).from(tradesTable);

  // New users per day for last 30 days
  const rawNewUsers = await db.execute(sql`
    SELECT DATE(created_at AT TIME ZONE 'UTC') as date, COUNT(*) as count
    FROM users
    WHERE created_at >= ${day30.toISOString()}
    GROUP BY DATE(created_at AT TIME ZONE 'UTC')
    ORDER BY date ASC
  `);
  const newUsersByDay = (rawNewUsers.rows as unknown as Array<{ date: string; count: string }>);

  res.json({
    totalUsers: Number(totals.totalUsers),
    activeUsers: Number(totals.activeUsers),
    inactiveUsers: Number(totals.inactiveUsers),
    freeUsers: Number(totals.freeUsers),
    proUsers: Number(totals.proUsers),
    eliteUsers: Number(totals.eliteUsers),
    newUsersToday: Number(totals.newToday),
    newUsersThisMonth: Number(totals.newThisMonth),
    dau: Number(dau.count),
    wau: Number(wau.count),
    mau: Number(mau.count),
    totalTrades: Number(tradeStats.totalTrades),
    newUsersByDay: newUsersByDay.map(r => ({
      date: String(r.date),
      count: Number(r.count),
    })),
  });
});

// GET /admin/login-history
router.get("/admin/login-history", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const history = await db.select().from(loginHistoryTable)
    .orderBy(desc(loginHistoryTable.createdAt))
    .limit(limit);

  res.json(history.map(h => ({
    id: h.id,
    userId: h.userId,
    email: h.email,
    success: h.success,
    ipAddress: h.ipAddress,
    userAgent: h.userAgent,
    failReason: h.failReason,
    createdAt: h.createdAt.toISOString(),
  })));
});

export default router;
