import { Router, type IRouter } from "express";
import { db, tradesTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { GetDashboardStatsQueryParams, GetEquityCurveQueryParams, GetDashboardCalendarQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

function getPeriodStart(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case "1d": return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "1w": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "1m": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "3m": return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "all": return null;
    default: return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

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

router.get("/dashboard/stats", requireAuth, async (req, res): Promise<void> => {
  const params = GetDashboardStatsQueryParams.safeParse(req.query);
  const period = params.success ? (params.data.period ?? "1m") : "1m";
  const accountId = params.success ? params.data.accountId : undefined;
  const userId = req.user!.id;
  const periodStart = getPeriodStart(period);

  const conditions = [eq(tradesTable.userId, userId)];
  if (periodStart) conditions.push(gte(tradesTable.openTime, periodStart));
  if (accountId) conditions.push(eq(tradesTable.accountId, accountId));

  const trades = await db.select().from(tradesTable).where(and(...conditions));
  const closedTrades = trades.filter(t => t.pnl !== null);
  const openTrades = trades.filter(t => t.pnl === null);

  const winners = closedTrades.filter(t => t.outcome === "win");
  const losers = closedTrades.filter(t => t.outcome === "loss");

  const totalPnl = closedTrades.reduce((sum, t) => sum + parseFloat(t.pnl ?? "0"), 0);
  const realizedPnl = totalPnl;
  const unrealizedPnl = 0;
  const winRate = closedTrades.length > 0 ? (winners.length / closedTrades.length) * 100 : 0;

  const avgWinner = winners.length > 0
    ? winners.reduce((sum, t) => sum + parseFloat(t.pnl ?? "0"), 0) / winners.length
    : 0;
  const avgLoser = losers.length > 0
    ? losers.reduce((sum, t) => sum + parseFloat(t.pnl ?? "0"), 0) / losers.length
    : 0;

  const pnls = closedTrades.map(t => parseFloat(t.pnl ?? "0"));
  const bestTrade = pnls.length > 0 ? Math.max(...pnls) : 0;
  const worstTrade = pnls.length > 0 ? Math.min(...pnls) : 0;

  const sorted = [...closedTrades].sort((a, b) => a.openTime.getTime() - b.openTime.getTime());
  let winStreak = 0, lossStreak = 0, curWin = 0, curLoss = 0;
  for (const t of sorted) {
    if (t.outcome === "win") { curWin++; curLoss = 0; winStreak = Math.max(winStreak, curWin); }
    else { curLoss++; curWin = 0; lossStreak = Math.max(lossStreak, curLoss); }
  }

  const avgRR = closedTrades.filter(t => t.rrRatio).length > 0
    ? closedTrades.filter(t => t.rrRatio).reduce((sum, t) => sum + parseFloat(t.rrRatio ?? "0"), 0) / closedTrades.filter(t => t.rrRatio).length
    : 0;

  const grossProfit = winners.reduce((sum, t) => sum + parseFloat(t.pnl ?? "0"), 0);
  const grossLoss = Math.abs(losers.reduce((sum, t) => sum + parseFloat(t.pnl ?? "0"), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
  const expectancy = closedTrades.length > 0 ? totalPnl / closedTrades.length : 0;

  res.json({
    totalPnl: parseFloat(totalPnl.toFixed(2)),
    realizedPnl: parseFloat(realizedPnl.toFixed(2)),
    unrealizedPnl,
    winRate: parseFloat(winRate.toFixed(1)),
    totalTrades: closedTrades.length,
    openTrades: openTrades.length,
    avgWinner: parseFloat(avgWinner.toFixed(2)),
    avgLoser: parseFloat(avgLoser.toFixed(2)),
    bestTrade: parseFloat(bestTrade.toFixed(2)),
    worstTrade: parseFloat(worstTrade.toFixed(2)),
    winStreak,
    lossStreak,
    avgRR: parseFloat(avgRR.toFixed(2)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    expectancy: parseFloat(expectancy.toFixed(2)),
  });
});

router.get("/dashboard/equity-curve", requireAuth, async (req, res): Promise<void> => {
  const params = GetEquityCurveQueryParams.safeParse(req.query);
  const period = params.success ? (params.data.period ?? "1m") : "1m";
  const accountId = params.success ? params.data.accountId : undefined;
  const userId = req.user!.id;
  const periodStart = getPeriodStart(period);

  const conditions = [eq(tradesTable.userId, userId)];
  if (periodStart) conditions.push(gte(tradesTable.openTime, periodStart));
  if (accountId) conditions.push(eq(tradesTable.accountId, accountId));

  const trades = await db.select().from(tradesTable)
    .where(and(...conditions))
    .orderBy(tradesTable.openTime);

  const closedTrades = trades.filter(t => t.pnl !== null);
  let equity = 0;
  const points = closedTrades.map(t => {
    const pnl = parseFloat(t.pnl!);
    equity += pnl;
    return {
      date: (t.closeTime ?? t.openTime).toISOString().split("T")[0],
      equity: parseFloat(equity.toFixed(2)),
      pnl: parseFloat(pnl.toFixed(2)),
    };
  });

  res.json(points);
});

router.get("/dashboard/calendar", requireAuth, async (req, res): Promise<void> => {
  const params = GetDashboardCalendarQueryParams.safeParse(req.query);
  const userId = req.user!.id;
  const accountId = params.success ? params.data.accountId : undefined;
  const now = new Date();
  const year = params.success && params.data.year ? params.data.year : now.getFullYear();
  const month = params.success && params.data.month ? params.data.month : now.getMonth() + 1;

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const conditions = [eq(tradesTable.userId, userId), gte(tradesTable.openTime, startDate)];
  if (accountId) conditions.push(eq(tradesTable.accountId, accountId));

  const trades = await db.select().from(tradesTable).where(and(...conditions));

  const filtered = trades.filter(t => {
    const d = t.closeTime ?? t.openTime;
    return d >= startDate && d < endDate && t.pnl !== null;
  });

  const byDay = new Map<string, { pnl: number; count: number }>();
  for (const t of filtered) {
    const day = (t.closeTime ?? t.openTime).toISOString().split("T")[0];
    const existing = byDay.get(day) ?? { pnl: 0, count: 0 };
    byDay.set(day, { pnl: existing.pnl + parseFloat(t.pnl!), count: existing.count + 1 });
  }

  const result = Array.from(byDay.entries()).map(([date, { pnl, count }]) => ({
    date,
    pnl: parseFloat(pnl.toFixed(2)),
    tradeCount: count,
  }));

  res.json(result);
});

router.get("/dashboard/recent-trades", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const accountId = req.query.accountId ? parseInt(String(req.query.accountId)) : undefined;

  const conditions = [eq(tradesTable.userId, userId)];
  if (accountId && !isNaN(accountId)) conditions.push(eq(tradesTable.accountId, accountId));

  const trades = await db.select().from(tradesTable)
    .where(and(...conditions))
    .orderBy(desc(tradesTable.openTime))
    .limit(5);

  res.json(trades.map(formatTrade));
});

export default router;
