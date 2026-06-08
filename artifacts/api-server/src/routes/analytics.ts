import { Router, type IRouter } from "express";
import { db, tradesTable, checklistTemplatesTable, checklistResponsesTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import {
  GetPerformanceQueryParams,
  GetAnalyticsBySymbolQueryParams,
  GetAnalyticsByDayQueryParams,
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

  res.json({
    totalPnl: parseFloat(totalPnl.toFixed(2)),
    winRate: parseFloat(winRate.toFixed(1)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    expectancy: parseFloat(expectancy.toFixed(2)),
    totalTrades: filtered.length,
    winners: winners.length,
    losers: losers.length,
    longTrades: longTrades.length,
    shortTrades: shortTrades.length,
    longPnl: parseFloat(longPnl.toFixed(2)),
    shortPnl: parseFloat(shortPnl.toFixed(2)),
    longWinRate: parseFloat(longWinRate.toFixed(1)),
    shortWinRate: parseFloat(shortWinRate.toFixed(1)),
    equityCurve,
    drawdown,
  });
});

router.get("/analytics/by-symbol", requireAuth, async (req, res): Promise<void> => {
  const params = GetAnalyticsBySymbolQueryParams.safeParse(req.query);
  const period = params.success ? (params.data.period ?? "all") : "all";
  const accountId = params.success ? params.data.accountId : undefined;
  const userId = req.user!.id;
  const periodStart = getPeriodStart(period);

  const conditions = [eq(tradesTable.userId, userId)];
  if (periodStart) conditions.push(gte(tradesTable.openTime, periodStart));
  if (accountId) conditions.push(eq(tradesTable.accountId, accountId));

  const trades = await db.select().from(tradesTable).where(and(...conditions));
  const closed = trades.filter(t => t.pnl !== null);

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
  const accountId = params.success ? params.data.accountId : undefined;
  const userId = req.user!.id;
  const periodStart = getPeriodStart(period);

  const conditions = [eq(tradesTable.userId, userId)];
  if (periodStart) conditions.push(gte(tradesTable.openTime, periodStart));
  if (accountId) conditions.push(eq(tradesTable.accountId, accountId));

  const trades = await db.select().from(tradesTable).where(and(...conditions));
  const closed = trades.filter(t => t.pnl !== null);

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
  const userId = req.user!.id;
  const accountId = req.query.accountId ? parseInt(String(req.query.accountId)) : undefined;

  const conditions = [eq(tradesTable.userId, userId)];
  if (accountId && !isNaN(accountId)) conditions.push(eq(tradesTable.accountId, accountId));

  const trades = await db.select().from(tradesTable).where(and(...conditions));
  const closed = trades.filter(t => t.pnl !== null);

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
  const userId = req.user!.id;
  const accountId = req.query.accountId ? parseInt(String(req.query.accountId)) : undefined;

  const conditions = [eq(tradesTable.userId, userId)];
  if (accountId && !isNaN(accountId)) conditions.push(eq(tradesTable.accountId, accountId));

  const trades = await db.select().from(tradesTable).where(and(...conditions));
  const closed = trades.filter(t => t.pnl !== null && t.emotion);

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
  const userId = req.user!.id;
  const accountId = req.query.accountId ? parseInt(String(req.query.accountId)) : undefined;

  const conditions = [eq(tradesTable.userId, userId)];
  if (accountId && !isNaN(accountId)) conditions.push(eq(tradesTable.accountId, accountId));

  const trades = await db.select().from(tradesTable).where(and(...conditions));
  const withStrategy = trades.filter(t => t.strategy && t.pnl !== null);

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
  const userId = req.user!.id;
  const accountId = req.query.accountId ? parseInt(String(req.query.accountId)) : undefined;

  const conditions = [eq(tradesTable.userId, userId)];
  if (accountId && !isNaN(accountId)) conditions.push(eq(tradesTable.accountId, accountId));

  const trades = await db.select().from(tradesTable).where(and(...conditions));
  const closed = trades.filter(t => t.pnl !== null && t.session);

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
