import { Router, type IRouter } from "express";
import { db, tradesTable, checklistTemplatesTable, checklistResponsesTable } from "@workspace/db";
import type { InferSelectModel } from "drizzle-orm";
import { eq, and, gte } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import {
  GetPerformanceQueryParams,
  GetAnalyticsBySymbolQueryParams,
  GetAnalyticsByDayQueryParams,
  GetAnalyticsByTagQueryParams,
  GetAnalyticsByEmotionQueryParams,
  GetAnalyticsByStrategyQueryParams,
  GetAnalyticsBySessionQueryParams,
  GetAnalyticsByHourQueryParams,
  GetAnalyticsRMultiplesQueryParams,
  GetAnalyticsStreaksQueryParams,
  GetAnalyticsProfitFactorTrendQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getPeriodStart(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case "today": return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "7d": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "3m": return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "1y": return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    case "all": return null;
    default: return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

function filterByOutcome<T extends { outcome: InferSelectModel<typeof tradesTable>["outcome"] }>(
  trades: T[],
  outcome: string,
): T[] {
  if (outcome === "winners") return trades.filter(t => t.outcome === "win");
  if (outcome === "losers") return trades.filter(t => t.outcome === "loss");
  return trades;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

router.get("/analytics/performance", requireAuth, async (req, res): Promise<void> => {
  const params = GetPerformanceQueryParams.safeParse(req.query);
  const period = params.success ? (params.data.period ?? "30d") : "30d";
  const filter = params.success ? (params.data.filter ?? "all") : "all";
  const accountId = params.success ? params.data.accountId : undefined;
  const userId = req.user!.id;
  const periodStart = getPeriodStart(period);

  const conditions = [eq(tradesTable.userId, userId)];
  if (periodStart) conditions.push(gte(tradesTable.openTime, periodStart));
  if (accountId) conditions.push(eq(tradesTable.accountId, accountId));

  let allTrades = await db.select().from(tradesTable).where(and(...conditions)).orderBy(tradesTable.openTime);
  const closedTrades = allTrades.filter(t => t.pnl !== null);

  let filtered = closedTrades;
  if (filter === "winners") filtered = closedTrades.filter(t => t.outcome === "win");
  else if (filter === "losers") filtered = closedTrades.filter(t => t.outcome === "loss");

  const winners = filtered.filter(t => t.outcome === "win");
  const losers = filtered.filter(t => t.outcome === "loss");
  const longTrades = filtered.filter(t => t.type === "long");
  const shortTrades = filtered.filter(t => t.type === "short");

  const totalPnl = filtered.reduce((s, t) => s + parseFloat(t.pnl!), 0);
  const winRate = filtered.length > 0 ? (winners.length / filtered.length) * 100 : 0;
  const grossProfit = winners.reduce((s, t) => s + parseFloat(t.pnl!), 0);
  const grossLoss = Math.abs(losers.reduce((s, t) => s + parseFloat(t.pnl!), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
  const expectancy = filtered.length > 0 ? totalPnl / filtered.length : 0;

  const longPnl = longTrades.reduce((s, t) => s + parseFloat(t.pnl!), 0);
  const shortPnl = shortTrades.reduce((s, t) => s + parseFloat(t.pnl!), 0);
  const longWinRate = longTrades.length > 0 ? (longTrades.filter(t => t.outcome === "win").length / longTrades.length) * 100 : 0;
  const shortWinRate = shortTrades.length > 0 ? (shortTrades.filter(t => t.outcome === "win").length / shortTrades.length) * 100 : 0;

  let equity = 0;
  const equityCurve = filtered.map(t => {
    equity += parseFloat(t.pnl!);
    return {
      date: (t.closeTime ?? t.openTime).toISOString().split("T")[0],
      equity: parseFloat(equity.toFixed(2)),
      pnl: parseFloat(parseFloat(t.pnl!).toFixed(2)),
    };
  });

  let peak = 0;
  const drawdown = equityCurve.map(p => {
    if (p.equity > peak) peak = p.equity;
    const dd = peak > 0 ? ((p.equity - peak) / peak) * 100 : 0;
    return { date: p.date, drawdown: parseFloat(dd.toFixed(2)) };
  });

  const breakeven = filtered.filter(t => t.outcome === "breakeven").length;

  // Max consecutive losses
  let maxConsecLosses = 0;
  let curLoss = 0;
  for (const t of filtered) {
    if (t.outcome === "loss") { curLoss++; maxConsecLosses = Math.max(maxConsecLosses, curLoss); }
    else curLoss = 0;
  }

  // Max drawdown duration — use cumulative equity curve, measure peak-to-trough days
  let maxDdDays = 0;
  let runningEquity = 0;
  let peakEq = 0;
  let peakDate: Date | null = null;
  for (const t of filtered) {
    runningEquity += parseFloat(t.pnl!);
    const tradeDate = new Date(t.closeTime ?? t.openTime);
    if (runningEquity >= peakEq) { peakEq = runningEquity; peakDate = tradeDate; }
    else if (peakDate) {
      const days = Math.round((tradeDate.getTime() - peakDate.getTime()) / 86400000);
      maxDdDays = Math.max(maxDdDays, days);
    }
  }

  res.json({
    totalPnl: parseFloat(totalPnl.toFixed(2)),
    winRate: parseFloat(winRate.toFixed(1)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    expectancy: parseFloat(expectancy.toFixed(2)),
    totalTrades: filtered.length,
    winners: winners.length,
    losers: losers.length,
    breakeven,
    longTrades: longTrades.length,
    shortTrades: shortTrades.length,
    longPnl: parseFloat(longPnl.toFixed(2)),
    shortPnl: parseFloat(shortPnl.toFixed(2)),
    longWinRate: parseFloat(longWinRate.toFixed(1)),
    shortWinRate: parseFloat(shortWinRate.toFixed(1)),
    maxConsecutiveLosses: maxConsecLosses,
    maxDrawdownDuration: maxDdDays,
    equityCurve,
    drawdown,
  });
});

router.get("/analytics/by-symbol", requireAuth, async (req, res): Promise<void> => {
  const params = GetAnalyticsBySymbolQueryParams.safeParse(req.query);
  const period = params.success ? (params.data.period ?? "all") : "all";
  const outcome = params.success ? (params.data.outcome ?? "all") : "all";
  const accountId = params.success ? params.data.accountId : undefined;
  const userId = req.user!.id;
  const periodStart = getPeriodStart(period);

  const conditions = [eq(tradesTable.userId, userId)];
  if (periodStart) conditions.push(gte(tradesTable.openTime, periodStart));
  if (accountId) conditions.push(eq(tradesTable.accountId, accountId));

  const trades = await db.select().from(tradesTable).where(and(...conditions));
  const closed = filterByOutcome(trades.filter(t => t.pnl !== null), outcome);

  const bySymbol = new Map<string, { pnl: number; count: number; wins: number }>();
  for (const t of closed) {
    const sym = t.symbol.toUpperCase();
    const existing = bySymbol.get(sym) ?? { pnl: 0, count: 0, wins: 0 };
    bySymbol.set(sym, {
      pnl: existing.pnl + parseFloat(t.pnl!),
      count: existing.count + 1,
      wins: existing.wins + (t.outcome === "win" ? 1 : 0),
    });
  }

  const result = Array.from(bySymbol.entries())
    .map(([symbol, { pnl, count, wins }]) => ({
      symbol,
      trades: count,
      pnl: parseFloat(pnl.toFixed(2)),
      winRate: parseFloat(((wins / count) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.pnl - a.pnl);

  res.json(result);
});

router.get("/analytics/by-day", requireAuth, async (req, res): Promise<void> => {
  const params = GetAnalyticsByDayQueryParams.safeParse(req.query);
  const period = params.success ? (params.data.period ?? "all") : "all";
  const outcome = params.success ? (params.data.outcome ?? "all") : "all";
  const accountId = params.success ? params.data.accountId : undefined;
  const userId = req.user!.id;
  const periodStart = getPeriodStart(period);

  const conditions = [eq(tradesTable.userId, userId)];
  if (periodStart) conditions.push(gte(tradesTable.openTime, periodStart));
  if (accountId) conditions.push(eq(tradesTable.accountId, accountId));

  const trades = await db.select().from(tradesTable).where(and(...conditions));
  const closed = filterByOutcome(trades.filter(t => t.pnl !== null), outcome);

  const byDay = new Map<number, { pnl: number; count: number; wins: number }>();
  for (const t of closed) {
    const day = t.openTime.getDay();
    const existing = byDay.get(day) ?? { pnl: 0, count: 0, wins: 0 };
    byDay.set(day, {
      pnl: existing.pnl + parseFloat(t.pnl!),
      count: existing.count + 1,
      wins: existing.wins + (t.outcome === "win" ? 1 : 0),
    });
  }

  const result = [1, 2, 3, 4, 5].map(day => {
    const data = byDay.get(day) ?? { pnl: 0, count: 0, wins: 0 };
    return {
      day: DAY_NAMES[day],
      trades: data.count,
      pnl: parseFloat(data.pnl.toFixed(2)),
      winRate: data.count > 0 ? parseFloat(((data.wins / data.count) * 100).toFixed(1)) : 0,
    };
  });

  res.json(result);
});

router.get("/analytics/by-tag", requireAuth, async (req, res): Promise<void> => {
  const params = GetAnalyticsByTagQueryParams.safeParse(req.query);
  const outcome = params.success ? (params.data.outcome ?? "all") : "all";
  const userId = req.user!.id;
  const accountId = req.query.accountId ? parseInt(String(req.query.accountId)) : undefined;

  const conditions = [eq(tradesTable.userId, userId)];
  if (accountId && !isNaN(accountId)) conditions.push(eq(tradesTable.accountId, accountId));

  const trades = await db.select().from(tradesTable).where(and(...conditions));
  const closed = filterByOutcome(trades.filter(t => t.pnl !== null), outcome);

  const byTag = new Map<string, { pnl: number; count: number; wins: number }>();
  for (const t of closed) {
    for (const tag of (t.tags ?? [])) {
      const existing = byTag.get(tag) ?? { pnl: 0, count: 0, wins: 0 };
      byTag.set(tag, {
        pnl: existing.pnl + parseFloat(t.pnl!),
        count: existing.count + 1,
        wins: existing.wins + (t.outcome === "win" ? 1 : 0),
      });
    }
  }

  const result = Array.from(byTag.entries())
    .map(([tag, { pnl, count, wins }]) => ({
      tag,
      trades: count,
      pnl: parseFloat(pnl.toFixed(2)),
      winRate: parseFloat(((wins / count) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.pnl - a.pnl);

  res.json(result);
});

router.get("/analytics/by-emotion", requireAuth, async (req, res): Promise<void> => {
  const params = GetAnalyticsByEmotionQueryParams.safeParse(req.query);
  const outcome = params.success ? (params.data.outcome ?? "all") : "all";
  const userId = req.user!.id;
  const accountId = req.query.accountId ? parseInt(String(req.query.accountId)) : undefined;

  const conditions = [eq(tradesTable.userId, userId)];
  if (accountId && !isNaN(accountId)) conditions.push(eq(tradesTable.accountId, accountId));

  const trades = await db.select().from(tradesTable).where(and(...conditions));
  const closed = filterByOutcome(trades.filter(t => t.pnl !== null && t.emotion), outcome);

  const byEmotion = new Map<string, { pnl: number; count: number; wins: number }>();
  for (const t of closed) {
    const emotion = t.emotion!;
    const existing = byEmotion.get(emotion) ?? { pnl: 0, count: 0, wins: 0 };
    byEmotion.set(emotion, {
      pnl: existing.pnl + parseFloat(t.pnl!),
      count: existing.count + 1,
      wins: existing.wins + (t.outcome === "win" ? 1 : 0),
    });
  }

  const result = Array.from(byEmotion.entries())
    .map(([emotion, { pnl, count, wins }]) => ({
      emotion,
      trades: count,
      pnl: parseFloat(pnl.toFixed(2)),
      winRate: parseFloat(((wins / count) * 100).toFixed(1)),
    }));

  res.json(result);
});

router.get("/analytics/by-strategy", requireAuth, async (req, res): Promise<void> => {
  const params = GetAnalyticsByStrategyQueryParams.safeParse(req.query);
  const outcome = params.success ? (params.data.outcome ?? "all") : "all";
  const userId = req.user!.id;
  const accountId = req.query.accountId ? parseInt(String(req.query.accountId)) : undefined;

  const conditions = [eq(tradesTable.userId, userId)];
  if (accountId && !isNaN(accountId)) conditions.push(eq(tradesTable.accountId, accountId));

  const trades = await db.select().from(tradesTable).where(and(...conditions));
  const withStrategy = filterByOutcome(trades.filter(t => t.strategy && t.pnl !== null), outcome);

  const byStrategy = new Map<string, { pnl: number; count: number; wins: number; rMultiples: number[] }>();
  for (const t of withStrategy) {
    const strategy = t.strategy!;
    const existing = byStrategy.get(strategy) ?? { pnl: 0, count: 0, wins: 0, rMultiples: [] };
    byStrategy.set(strategy, {
      pnl: existing.pnl + parseFloat(t.pnl!),
      count: existing.count + 1,
      wins: existing.wins + (t.outcome === "win" ? 1 : 0),
      rMultiples: t.rMultiple ? [...existing.rMultiples, parseFloat(t.rMultiple)] : existing.rMultiples,
    });
  }

  const result = Array.from(byStrategy.entries())
    .map(([strategy, { pnl, count, wins, rMultiples }]) => ({
      strategy,
      trades: count,
      pnl: parseFloat(pnl.toFixed(2)),
      winRate: parseFloat(((wins / count) * 100).toFixed(1)),
      avgRMultiple: rMultiples.length > 0
        ? parseFloat((rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length).toFixed(2))
        : null,
    }))
    .sort((a, b) => b.pnl - a.pnl);

  res.json(result);
});

router.get("/analytics/by-session", requireAuth, async (req, res): Promise<void> => {
  const params = GetAnalyticsBySessionQueryParams.safeParse(req.query);
  const userId = req.user!.id;
  const period = String(params.success ? (params.data.period ?? "all") : "all");
  const outcome = params.success ? (params.data.outcome ?? "all") : "all";
  const accountId = req.query.accountId ? parseInt(String(req.query.accountId)) : undefined;
  const periodStart = getPeriodStart(period);

  const conditions = [eq(tradesTable.userId, userId)];
  if (periodStart) conditions.push(gte(tradesTable.openTime, periodStart));
  if (accountId && !isNaN(accountId)) conditions.push(eq(tradesTable.accountId, accountId));

  const trades = await db.select().from(tradesTable).where(and(...conditions));
  const closed = filterByOutcome(trades.filter(t => t.pnl !== null && t.session), outcome);

  const bySession = new Map<string, { pnl: number; count: number; wins: number }>();
  for (const t of closed) {
    const session = t.session!;
    const existing = bySession.get(session) ?? { pnl: 0, count: 0, wins: 0 };
    bySession.set(session, {
      pnl: existing.pnl + parseFloat(t.pnl!),
      count: existing.count + 1,
      wins: existing.wins + (t.outcome === "win" ? 1 : 0),
    });
  }

  const result = Array.from(bySession.entries())
    .map(([session, { pnl, count, wins }]) => ({
      session,
      trades: count,
      pnl: parseFloat(pnl.toFixed(2)),
      winRate: parseFloat(((wins / count) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.pnl - a.pnl);

  res.json(result);
});

router.get("/analytics/by-hour", requireAuth, async (req, res): Promise<void> => {
  const params = GetAnalyticsByHourQueryParams.safeParse(req.query);
  const userId = req.user!.id;
  const period = String(params.success ? (params.data.period ?? "all") : "all");
  const outcome = params.success ? (params.data.outcome ?? "all") : "all";
  const accountId = req.query.accountId ? parseInt(String(req.query.accountId)) : undefined;
  const periodStart = getPeriodStart(period);

  const conditions = [eq(tradesTable.userId, userId)];
  if (periodStart) conditions.push(gte(tradesTable.openTime, periodStart));
  if (accountId && !isNaN(accountId)) conditions.push(eq(tradesTable.accountId, accountId));

  const trades = await db.select().from(tradesTable).where(and(...conditions));
  const closed = filterByOutcome(trades.filter(t => t.pnl !== null), outcome);

  const grid = new Map<string, { pnlSum: number; count: number }>();
  for (const t of closed) {
    const d = t.openTime;
    const day = d.getUTCDay();
    const hour = d.getUTCHours();
    const key = `${day}:${hour}`;
    const existing = grid.get(key) ?? { pnlSum: 0, count: 0 };
    grid.set(key, { pnlSum: existing.pnlSum + parseFloat(t.pnl!), count: existing.count + 1 });
  }

  // Return full 7×24 grid (all cells, including zeros)
  const result = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const cell = grid.get(`${day}:${hour}`);
      result.push({
        day,
        hour,
        avgPnl: cell ? parseFloat((cell.pnlSum / cell.count).toFixed(2)) : 0,
        trades: cell ? cell.count : 0,
      });
    }
  }

  res.json(result);
});

router.get("/analytics/r-multiples", requireAuth, async (req, res): Promise<void> => {
  const params = GetAnalyticsRMultiplesQueryParams.safeParse(req.query);
  const userId = req.user!.id;
  const period = String(params.success ? (params.data.period ?? "all") : "all");
  const outcome = params.success ? (params.data.outcome ?? "all") : "all";
  const accountId = req.query.accountId ? parseInt(String(req.query.accountId)) : undefined;
  const periodStart = getPeriodStart(period);

  const conditions = [eq(tradesTable.userId, userId)];
  if (periodStart) conditions.push(gte(tradesTable.openTime, periodStart));
  if (accountId && !isNaN(accountId)) conditions.push(eq(tradesTable.accountId, accountId));

  const trades = await db.select().from(tradesTable).where(and(...conditions));
  const withR = filterByOutcome(trades.filter(t => t.rMultiple !== null && t.pnl !== null), outcome);

  const bucketDefs = [
    { label: "<-3R", min: -Infinity, max: -3 },
    { label: "-3R to -2R", min: -3, max: -2 },
    { label: "-2R to -1R", min: -2, max: -1 },
    { label: "-1R to 0R", min: -1, max: 0 },
    { label: "0R to 1R", min: 0, max: 1 },
    { label: "1R to 2R", min: 1, max: 2 },
    { label: "2R to 3R", min: 2, max: 3 },
    { label: "3R to 5R", min: 3, max: 5 },
    { label: ">5R", min: 5, max: Infinity },
  ];

  const counts = new Array(bucketDefs.length).fill(0);
  let rSum = 0;
  for (const t of withR) {
    const r = parseFloat(t.rMultiple!);
    rSum += r;
    const idx = bucketDefs.findIndex(b => r >= b.min && r < b.max);
    if (idx >= 0) counts[idx]++;
  }

  res.json({
    buckets: bucketDefs.map((b, i) => ({ label: b.label, count: counts[i] })),
    avgRMultiple: withR.length > 0 ? parseFloat((rSum / withR.length).toFixed(2)) : null,
    totalTrades: withR.length,
  });
});

router.get("/analytics/streaks", requireAuth, async (req, res): Promise<void> => {
  const params = GetAnalyticsStreaksQueryParams.safeParse(req.query);
  const userId = req.user!.id;
  const period = String(params.success ? (params.data.period ?? "all") : "all");
  const outcome = params.success ? (params.data.outcome ?? "all") : "all";
  const accountId = req.query.accountId ? parseInt(String(req.query.accountId)) : undefined;
  const periodStart = getPeriodStart(period);

  const conditions = [eq(tradesTable.userId, userId)];
  if (periodStart) conditions.push(gte(tradesTable.openTime, periodStart));
  if (accountId && !isNaN(accountId)) conditions.push(eq(tradesTable.accountId, accountId));

  const trades = await db.select().from(tradesTable).where(and(...conditions)).orderBy(tradesTable.openTime);
  const closed = filterByOutcome(trades.filter(t => t.pnl !== null && t.outcome), outcome);

  let bestWin = 0, worstLoss = 0;
  let curWin = 0, curLoss = 0;
  for (const t of closed) {
    if (t.outcome === "win") { curWin++; curLoss = 0; bestWin = Math.max(bestWin, curWin); }
    else if (t.outcome === "loss") { curLoss++; curWin = 0; worstLoss = Math.max(worstLoss, curLoss); }
    else { curWin = 0; curLoss = 0; }
  }

  let currentStreak = 0;
  let currentType: string | null = null;
  if (closed.length > 0) {
    const lastOutcome = closed[closed.length - 1].outcome!;
    currentType = lastOutcome;
    for (let i = closed.length - 1; i >= 0; i--) {
      if (closed[i].outcome === lastOutcome) currentStreak++;
      else break;
    }
  }

  const timeline = closed.slice(-50).map(t => ({ outcome: t.outcome as "win" | "loss" | "breakeven" }));

  res.json({ currentStreak, currentType, bestWinStreak: bestWin, worstLossStreak: worstLoss, timeline });
});

router.get("/analytics/profit-factor-trend", requireAuth, async (req, res): Promise<void> => {
  const params = GetAnalyticsProfitFactorTrendQueryParams.safeParse(req.query);
  const userId = req.user!.id;
  const period = String(params.success ? (params.data.period ?? "all") : "all");
  const outcome = params.success ? (params.data.outcome ?? "all") : "all";
  const accountId = req.query.accountId ? parseInt(String(req.query.accountId)) : undefined;
  const periodStart = getPeriodStart(period);

  const conditions = [eq(tradesTable.userId, userId)];
  if (periodStart) conditions.push(gte(tradesTable.openTime, periodStart));
  if (accountId && !isNaN(accountId)) conditions.push(eq(tradesTable.accountId, accountId));

  const trades = await db.select().from(tradesTable).where(and(...conditions)).orderBy(tradesTable.openTime);
  const closed = filterByOutcome(trades.filter(t => t.pnl !== null), outcome);

  const byMonth = new Map<string, { gross: number; loss: number; count: number }>();
  for (const t of closed) {
    const d = t.closeTime ?? t.openTime;
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const existing = byMonth.get(month) ?? { gross: 0, loss: 0, count: 0 };
    const pnl = parseFloat(t.pnl!);
    byMonth.set(month, {
      gross: existing.gross + (pnl > 0 ? pnl : 0),
      loss: existing.loss + (pnl < 0 ? Math.abs(pnl) : 0),
      count: existing.count + 1,
    });
  }

  const result = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { gross, loss, count }]) => ({
      month,
      profitFactor: parseFloat((loss > 0 ? gross / loss : gross > 0 ? 9.99 : 0).toFixed(2)),
      trades: count,
    }));

  res.json(result);
});

router.get("/analytics/checklist-compliance", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const accountId = req.query.accountId ? parseInt(String(req.query.accountId)) : undefined;

  const templates = await db.select().from(checklistTemplatesTable)
    .where(eq(checklistTemplatesTable.userId, userId));

  if (templates.length === 0) {
    res.json([]);
    return;
  }

  // Filter responses by account if requested (join through trades table)
  let tradeIds: number[] | null = null;
  if (accountId && !isNaN(accountId)) {
    const trades = await db.select({ id: tradesTable.id }).from(tradesTable)
      .where(and(eq(tradesTable.userId, userId), eq(tradesTable.accountId, accountId)));
    tradeIds = trades.map(t => t.id);
  }

  const responseConditions = [eq(checklistResponsesTable.userId, userId)];
  const responses = await db.select().from(checklistResponsesTable)
    .where(and(...responseConditions));

  const result = templates.map(t => {
    const templateResponses = responses.filter(r =>
      r.templateId === t.id && (tradeIds === null || tradeIds.includes(r.tradeId))
    );
    const questions = t.questions as { id: string; text: string }[];
    const total = questions.length;

    let totalRate = 0;
    for (const r of templateResponses) {
      const answers = r.answers as { questionId: string; checked: boolean }[];
      const checked = answers.filter(a => a.checked).length;
      totalRate += total > 0 ? (checked / total) * 100 : 0;
    }

    const avgComplianceRate = templateResponses.length > 0
      ? parseFloat((totalRate / templateResponses.length).toFixed(1))
      : 0;

    return {
      templateId: t.id,
      templateName: t.name,
      totalResponses: templateResponses.length,
      avgComplianceRate,
    };
  }).filter(t => t.totalResponses > 0);

  res.json(result);
});

export default router;
