import { Router, type IRouter } from "express";
import { db, tradesTable, tradingAccountsTable } from "@workspace/db";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import {
  CreateTradeBody,
  UpdateTradeBody,
  ListTradesQueryParams,
  GetTradeParams,
  UpdateTradeParams,
  DeleteTradeParams,
} from "@workspace/api-zod";
import {
  calculatePnl,
  calculatePips,
  calculateRR,
  determineOutcome,
} from "../lib/trade-calculations";

const router: IRouter = Router();

function formatTrade(t: typeof tradesTable.$inferSelect) {
  return {
    id: t.id,
    userId: t.userId,
    accountId: t.accountId ?? null,
    symbol: t.symbol,
    type: t.type,
    entryPrice: t.entryPrice ? parseFloat(t.entryPrice) : 0,
    exitPrice: t.exitPrice ? parseFloat(t.exitPrice) : null,
    positionSize: t.positionSize ? parseFloat(t.positionSize) : 0,
    stopLoss: t.stopLoss ? parseFloat(t.stopLoss) : null,
    takeProfit: t.takeProfit ? parseFloat(t.takeProfit) : null,
    openTime: t.openTime.toISOString(),
    closeTime: t.closeTime ? t.closeTime.toISOString() : null,
    pnl: t.pnl ? parseFloat(t.pnl) : null,
    pips: t.pips ? parseFloat(t.pips) : null,
    rrRatio: t.rrRatio ? parseFloat(t.rrRatio) : null,
    fees: t.fees ? parseFloat(t.fees) : null,
    source: t.source,
    tags: t.tags ?? [],
    emotion: t.emotion,
    notes: t.notes,
    screenshots: t.screenshots ?? [],
    outcome: t.outcome,
    createdAt: t.createdAt.toISOString(),
  };
}

router.get("/trades", requireAuth, async (req, res): Promise<void> => {
  const params = ListTradesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { symbol, type, outcome, startDate, endDate, tag, accountId, limit = 100, offset = 0 } = params.data;
  const userId = req.user!.id;

  const conditions = [eq(tradesTable.userId, userId)];
  if (accountId) conditions.push(eq(tradesTable.accountId, accountId));
  if (symbol) conditions.push(sql`LOWER(${tradesTable.symbol}) = LOWER(${symbol})`);
  if (type) conditions.push(eq(tradesTable.type, type as "long" | "short"));
  if (outcome) conditions.push(eq(tradesTable.outcome, outcome as "win" | "loss" | "breakeven"));
  if (startDate) conditions.push(gte(tradesTable.openTime, new Date(startDate)));
  if (endDate) conditions.push(lte(tradesTable.openTime, new Date(endDate)));

  let query = db.select().from(tradesTable).where(and(...conditions)).orderBy(desc(tradesTable.openTime));

  if (tag) {
    query = db.select().from(tradesTable).where(and(...conditions, sql`${tag} = ANY(${tradesTable.tags})`)).orderBy(desc(tradesTable.openTime));
  }

  const allTrades = await query;
  const total = allTrades.length;
  const trades = allTrades.slice(Number(offset), Number(offset) + Number(limit));

  res.json({ trades: trades.map(formatTrade), total });
});

router.post("/trades", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateTradeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.user!.id;
  const d = parsed.data;

  let pnl: number | null = null;
  let pips: number | null = null;
  let rrRatio: number | null = null;
  let outcome: "win" | "loss" | "breakeven" | null = null;

  const entry = parseFloat(String(d.entryPrice));
  const exit = d.exitPrice != null ? parseFloat(String(d.exitPrice)) : null;
  const size = parseFloat(String(d.positionSize));
  const sl = d.stopLoss != null ? parseFloat(String(d.stopLoss)) : null;
  const tp = d.takeProfit != null ? parseFloat(String(d.takeProfit)) : null;
  const fees = d.fees != null ? parseFloat(String(d.fees)) : 0;

  if (exit !== null) {
    pnl = calculatePnl(d.type as "long" | "short", entry, exit, size, fees);
    pips = calculatePips(d.type as "long" | "short", entry, exit, d.symbol);
    outcome = determineOutcome(pnl);
  }
  rrRatio = calculateRR(d.type as "long" | "short", entry, tp, sl);

  // Validate account ownership if accountId is provided
  if (d.accountId) {
    const [acct] = await db.select({ id: tradingAccountsTable.id })
      .from(tradingAccountsTable)
      .where(and(eq(tradingAccountsTable.id, d.accountId), eq(tradingAccountsTable.userId, userId)));
    if (!acct) {
      res.status(400).json({ error: "Invalid account" });
      return;
    }
  }

  const [trade] = await db.insert(tradesTable).values({
    userId,
    accountId: d.accountId ?? null,
    symbol: d.symbol,
    type: d.type as "long" | "short",
    entryPrice: String(d.entryPrice),
    exitPrice: d.exitPrice != null ? String(d.exitPrice) : null,
    positionSize: String(d.positionSize),
    stopLoss: d.stopLoss != null ? String(d.stopLoss) : null,
    takeProfit: d.takeProfit != null ? String(d.takeProfit) : null,
    openTime: new Date(d.openTime),
    closeTime: d.closeTime ? new Date(d.closeTime) : null,
    pnl: pnl !== null ? String(pnl) : null,
    pips: pips !== null ? String(pips) : null,
    rrRatio: rrRatio !== null ? String(rrRatio) : null,
    fees: d.fees != null ? String(d.fees) : null,
    source: (d.source ?? "manual") as "manual" | "mt4" | "mt5" | "csv",
    tags: d.tags ?? [],
    emotion: d.emotion ?? null,
    notes: d.notes ?? null,
    screenshots: d.screenshots ?? [],
    outcome,
  }).returning();

  res.status(201).json(formatTrade(trade));
});

router.get("/trades/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetTradeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [trade] = await db.select().from(tradesTable)
    .where(and(eq(tradesTable.id, params.data.id), eq(tradesTable.userId, req.user!.id)));

  if (!trade) {
    res.status(404).json({ error: "Trade not found" });
    return;
  }

  res.json(formatTrade(trade));
});

router.patch("/trades/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateTradeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTradeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(tradesTable)
    .where(and(eq(tradesTable.id, params.data.id), eq(tradesTable.userId, req.user!.id)));
  if (!existing) {
    res.status(404).json({ error: "Trade not found" });
    return;
  }

  const d = parsed.data;
  const updates: Record<string, unknown> = {};

  if (d.symbol !== undefined) updates.symbol = d.symbol;
  if (d.type !== undefined) updates.type = d.type;
  if (d.entryPrice !== undefined) updates.entryPrice = String(d.entryPrice);
  if (d.exitPrice !== undefined) updates.exitPrice = d.exitPrice != null ? String(d.exitPrice) : null;
  if (d.positionSize !== undefined) updates.positionSize = String(d.positionSize);
  if (d.stopLoss !== undefined) updates.stopLoss = d.stopLoss != null ? String(d.stopLoss) : null;
  if (d.takeProfit !== undefined) updates.takeProfit = d.takeProfit != null ? String(d.takeProfit) : null;
  if (d.openTime !== undefined) updates.openTime = new Date(d.openTime);
  if (d.closeTime !== undefined) updates.closeTime = d.closeTime ? new Date(d.closeTime) : null;
  if (d.fees !== undefined) updates.fees = d.fees != null ? String(d.fees) : null;
  if (d.source !== undefined) updates.source = d.source;
  if (d.tags !== undefined) updates.tags = d.tags;
  if (d.emotion !== undefined) updates.emotion = d.emotion;
  if (d.notes !== undefined) updates.notes = d.notes;
  if (d.screenshots !== undefined) updates.screenshots = d.screenshots;

  // Recalculate if needed
  const entry = parseFloat(String(updates.entryPrice ?? existing.entryPrice));
  const exit = updates.exitPrice !== undefined
    ? (updates.exitPrice != null ? parseFloat(String(updates.exitPrice)) : null)
    : (existing.exitPrice != null ? parseFloat(existing.exitPrice) : null);
  const size = parseFloat(String(updates.positionSize ?? existing.positionSize));
  const sl = updates.stopLoss !== undefined
    ? (updates.stopLoss != null ? parseFloat(String(updates.stopLoss)) : null)
    : (existing.stopLoss != null ? parseFloat(existing.stopLoss) : null);
  const tp = updates.takeProfit !== undefined
    ? (updates.takeProfit != null ? parseFloat(String(updates.takeProfit)) : null)
    : (existing.takeProfit != null ? parseFloat(existing.takeProfit) : null);
  const fees = updates.fees !== undefined
    ? (updates.fees != null ? parseFloat(String(updates.fees)) : 0)
    : (existing.fees != null ? parseFloat(existing.fees) : 0);
  const tradeType = (updates.type ?? existing.type) as "long" | "short";
  const symbol = String(updates.symbol ?? existing.symbol);

  if (exit !== null) {
    updates.pnl = String(calculatePnl(tradeType, entry, exit, size, fees));
    updates.pips = String(calculatePips(tradeType, entry, exit, symbol));
    updates.outcome = determineOutcome(parseFloat(String(updates.pnl)));
  }
  updates.rrRatio = calculateRR(tradeType, entry, tp, sl) !== null ? String(calculateRR(tradeType, entry, tp, sl)) : null;

  const [trade] = await db.update(tradesTable)
    .set(updates as Partial<typeof tradesTable.$inferSelect>)
    .where(eq(tradesTable.id, params.data.id))
    .returning();

  res.json(formatTrade(trade));
});

router.delete("/trades/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteTradeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [trade] = await db.delete(tradesTable)
    .where(and(eq(tradesTable.id, params.data.id), eq(tradesTable.userId, req.user!.id)))
    .returning();

  if (!trade) {
    res.status(404).json({ error: "Trade not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
