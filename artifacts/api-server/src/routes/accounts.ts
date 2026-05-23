import { Router, type IRouter } from "express";
import { db, tradingAccountsTable, tradesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function formatAccount(a: typeof tradingAccountsTable.$inferSelect) {
  return {
    id: a.id,
    userId: a.userId,
    name: a.name,
    broker: a.broker ?? null,
    platform: a.platform,
    startingBalance: parseFloat(a.startingBalance),
    currency: a.currency,
    isDefault: a.isDefault,
    createdAt: a.createdAt.toISOString(),
  };
}

// GET /accounts
router.get("/accounts", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const accounts = await db.select().from(tradingAccountsTable)
    .where(eq(tradingAccountsTable.userId, userId))
    .orderBy(tradingAccountsTable.createdAt);

  // Attach totalPnl per account
  const accountsWithStats = await Promise.all(accounts.map(async (acc) => {
    const [stats] = await db.select({
      totalPnl: sql<string>`COALESCE(SUM(${tradesTable.pnl}), 0)`,
      tradeCount: sql<string>`COUNT(*)`,
    }).from(tradesTable).where(and(
      eq(tradesTable.userId, userId),
      eq(tradesTable.accountId, acc.id),
    ));
    return {
      ...formatAccount(acc),
      totalPnl: parseFloat(stats.totalPnl ?? "0"),
      tradeCount: parseInt(stats.tradeCount ?? "0", 10),
    };
  }));

  res.json(accountsWithStats);
});

// POST /accounts
router.post("/accounts", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { name, broker, platform, startingBalance, currency, isDefault } = req.body;

  if (!name || !platform || startingBalance === undefined || !currency) {
    res.status(400).json({ error: "name, platform, startingBalance, and currency are required" });
    return;
  }

  // If this account is set as default, clear other defaults
  if (isDefault) {
    await db.update(tradingAccountsTable)
      .set({ isDefault: false })
      .where(eq(tradingAccountsTable.userId, userId));
  }

  const [account] = await db.insert(tradingAccountsTable).values({
    userId,
    name,
    broker: broker || null,
    platform: platform as "manual" | "mt4" | "mt5",
    startingBalance: String(startingBalance),
    currency,
    isDefault: isDefault ?? false,
  }).returning();

  res.status(201).json(formatAccount(account));
});

// PATCH /accounts/:id
router.patch("/accounts/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const accountId = parseInt(String(req.params.id));
  if (isNaN(accountId)) { res.status(400).json({ error: "Invalid account ID" }); return; }

  const [existing] = await db.select().from(tradingAccountsTable)
    .where(and(eq(tradingAccountsTable.id, accountId), eq(tradingAccountsTable.userId, userId)));
  if (!existing) { res.status(404).json({ error: "Account not found" }); return; }

  const { name, broker, platform, startingBalance, currency, isDefault } = req.body;
  const updates: Record<string, unknown> = {};

  if (name !== undefined) updates.name = name;
  if (broker !== undefined) updates.broker = broker || null;
  if (platform !== undefined) updates.platform = platform;
  if (startingBalance !== undefined) updates.startingBalance = String(startingBalance);
  if (currency !== undefined) updates.currency = currency;
  if (isDefault !== undefined) updates.isDefault = isDefault;

  // Clear other defaults if this one is being set as default
  if (isDefault) {
    await db.update(tradingAccountsTable)
      .set({ isDefault: false })
      .where(eq(tradingAccountsTable.userId, userId));
    updates.isDefault = true;
  }

  const [account] = await db.update(tradingAccountsTable)
    .set(updates as Partial<typeof tradingAccountsTable.$inferInsert>)
    .where(eq(tradingAccountsTable.id, accountId))
    .returning();

  res.json(formatAccount(account));
});

// DELETE /accounts/:id
router.delete("/accounts/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const accountId = parseInt(String(req.params.id));
  if (isNaN(accountId)) { res.status(400).json({ error: "Invalid account ID" }); return; }

  const [account] = await db.delete(tradingAccountsTable)
    .where(and(eq(tradingAccountsTable.id, accountId), eq(tradingAccountsTable.userId, userId)))
    .returning();

  if (!account) { res.status(404).json({ error: "Account not found" }); return; }
  res.sendStatus(204);
});

export default router;
