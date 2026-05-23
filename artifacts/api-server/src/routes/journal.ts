import { Router, type IRouter } from "express";
import { db, journalEntriesTable, tradesTable } from "@workspace/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import {
  ListJournalEntriesQueryParams,
  GetJournalEntryParams,
  UpsertJournalEntryParams,
  UpsertJournalEntryBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatTrade(t: typeof tradesTable.$inferSelect) {
  return {
    id: t.id,
    userId: t.userId,
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

router.get("/journal", requireAuth, async (req, res): Promise<void> => {
  const params = ListJournalEntriesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = req.user!.id;
  const status = params.data.status ?? "all";
  const accountId = params.data.accountId;

  if (status === "journaled") {
    const journaledConditions = [eq(journalEntriesTable.userId, userId)];
    if (accountId) journaledConditions.push(eq(tradesTable.accountId, accountId));

    const entries = await db
      .select({ entry: journalEntriesTable, trade: tradesTable })
      .from(journalEntriesTable)
      .innerJoin(tradesTable, eq(journalEntriesTable.tradeId, tradesTable.id))
      .where(and(...journaledConditions));

    res.json(entries.map(({ entry, trade }) => ({
      id: entry.id,
      tradeId: entry.tradeId,
      userId: entry.userId,
      notes: entry.notes,
      mood: entry.mood,
      screenshots: entry.screenshots ?? [],
      trade: formatTrade(trade),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    })));
    return;
  }

  if (status === "pending") {
    // Trades without journal entries
    const tradeConditions = [eq(tradesTable.userId, userId)];
    if (accountId) tradeConditions.push(eq(tradesTable.accountId, accountId));
    const trades = await db.select().from(tradesTable).where(and(...tradeConditions));
    const journaled = await db.select({ tradeId: journalEntriesTable.tradeId }).from(journalEntriesTable).where(eq(journalEntriesTable.userId, userId));
    const journaledIds = new Set(journaled.map(j => j.tradeId));
    const pendingTrades = trades.filter(t => !journaledIds.has(t.id));

    res.json(pendingTrades.map(trade => ({
      id: -1,
      tradeId: trade.id,
      userId,
      notes: null,
      mood: null,
      screenshots: [],
      trade: formatTrade(trade),
      createdAt: trade.createdAt.toISOString(),
      updatedAt: trade.createdAt.toISOString(),
    })));
    return;
  }

  // all: return all trades with or without journal entries
  const allTradeConditions = [eq(tradesTable.userId, userId)];
  if (accountId) allTradeConditions.push(eq(tradesTable.accountId, accountId));
  const trades = await db.select().from(tradesTable).where(and(...allTradeConditions));
  const entries = await db.select().from(journalEntriesTable).where(eq(journalEntriesTable.userId, userId));
  const entriesMap = new Map(entries.map(e => [e.tradeId, e]));

  res.json(trades.map(trade => {
    const entry = entriesMap.get(trade.id);
    return {
      id: entry?.id ?? -1,
      tradeId: trade.id,
      userId,
      notes: entry?.notes ?? null,
      mood: entry?.mood ?? null,
      screenshots: entry?.screenshots ?? [],
      trade: formatTrade(trade),
      createdAt: entry?.createdAt.toISOString() ?? trade.createdAt.toISOString(),
      updatedAt: entry?.updatedAt.toISOString() ?? trade.createdAt.toISOString(),
    };
  }));
});

router.get("/journal/:tradeId", requireAuth, async (req, res): Promise<void> => {
  const params = GetJournalEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [result] = await db
    .select({ entry: journalEntriesTable, trade: tradesTable })
    .from(journalEntriesTable)
    .innerJoin(tradesTable, eq(journalEntriesTable.tradeId, tradesTable.id))
    .where(and(
      eq(journalEntriesTable.tradeId, params.data.tradeId),
      eq(journalEntriesTable.userId, req.user!.id)
    ));

  if (!result) {
    res.status(404).json({ error: "Journal entry not found" });
    return;
  }

  const { entry, trade } = result;
  res.json({
    id: entry.id,
    tradeId: entry.tradeId,
    userId: entry.userId,
    notes: entry.notes,
    mood: entry.mood,
    screenshots: entry.screenshots ?? [],
    trade: formatTrade(trade),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  });
});

router.put("/journal/:tradeId", requireAuth, async (req, res): Promise<void> => {
  const params = UpsertJournalEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpsertJournalEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.user!.id;
  const tradeId = params.data.tradeId;

  // Verify trade belongs to user
  const [trade] = await db.select().from(tradesTable)
    .where(and(eq(tradesTable.id, tradeId), eq(tradesTable.userId, userId)));
  if (!trade) {
    res.status(404).json({ error: "Trade not found" });
    return;
  }

  const values = {
    tradeId,
    userId,
    notes: parsed.data.notes ?? null,
    mood: parsed.data.mood ?? null,
    screenshots: parsed.data.screenshots ?? [],
  };

  const [existing] = await db.select().from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.tradeId, tradeId), eq(journalEntriesTable.userId, userId)));

  let entry: typeof journalEntriesTable.$inferSelect;
  if (existing) {
    [entry] = await db.update(journalEntriesTable).set(values).where(eq(journalEntriesTable.id, existing.id)).returning();
  } else {
    [entry] = await db.insert(journalEntriesTable).values(values).returning();
  }

  res.json({
    id: entry.id,
    tradeId: entry.tradeId,
    userId: entry.userId,
    notes: entry.notes,
    mood: entry.mood,
    screenshots: entry.screenshots ?? [],
    trade: formatTrade(trade),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  });
});

export default router;
