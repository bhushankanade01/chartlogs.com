import { desc, eq, gte, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, tradesTable, aiReviewsTable } from "@workspace/db";
import { AI_AVAILABLE } from "@workspace/integrations-anthropic-ai";
import { createAnthropicMessage, TRADING_SYSTEM_PROMPT } from "./ai.js";
import { logger } from "./logger.js";

function msUntilNextMonday(): number {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysUntilMonday = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7 || 7;
  const nextMonday = new Date(now);
  nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday);
  nextMonday.setUTCHours(6, 0, 0, 0);
  return nextMonday.getTime() - now.getTime();
}

export async function generateWeeklyReportForUser(userId: number): Promise<void> {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const trades = await db.select().from(tradesTable)
    .where(and(eq(tradesTable.userId, userId), gte(tradesTable.openTime, since)))
    .orderBy(desc(tradesTable.openTime));

  const closed = trades.filter(t => t.pnl !== null);
  if (closed.length === 0) return;

  const totalPnl = closed.reduce((s, t) => s + parseFloat(t.pnl!), 0);
  const wins = closed.filter(t => t.outcome === "win").length;
  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;

  const tradeSummaries = closed.slice(0, 20).map(t =>
    `${t.symbol} ${t.type?.toUpperCase()} | ${t.outcome?.toUpperCase()} | P&L: $${parseFloat(t.pnl!).toFixed(2)} | R: ${t.rMultiple != null ? t.rMultiple + "R" : "N/A"} | Emotion: ${t.emotion ?? "N/A"} | Strategy: ${t.strategy ?? "N/A"}`
  ).join("\n");

  const prompt = `Generate a weekly trading performance report for the past 7 days.

Statistics:
- Total trades: ${closed.length}
- Wins: ${wins}, Win rate: ${winRate.toFixed(1)}%
- Total P&L: $${totalPnl.toFixed(2)}

Individual trades:
${tradeSummaries}

Format the report exactly as:

# Weekly Trading Report — ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}

## Performance Summary
[3-4 sentences covering overall week performance, key metrics]

## Top Mistakes This Week
[3 specific recurring mistakes with trade examples]

## Emotional Patterns
[Analysis of emotion × outcome patterns from the data]

## Best Setup
[The single best-executed trade and why it worked]

## 3 Improvement Actions for Next Week
1. [Specific, measurable action]
2. [Specific, measurable action]
3. [Specific, measurable action]`;

  const message = await createAnthropicMessage(prompt);
  const content = message.content[0].type === "text" ? message.content[0].text : "";

  await db.insert(aiReviewsTable).values({
    userId,
    tradeId: null,
    reportType: "weekly_report",
    content,
  });

  logger.info({ userId }, "Auto weekly report generated");
}

export async function generatePatternAnalysisForUser(userId: number): Promise<void> {
  const trades = await db.select().from(tradesTable)
    .where(eq(tradesTable.userId, userId))
    .orderBy(desc(tradesTable.openTime))
    .limit(30);

  const closed = trades.filter(t => t.pnl !== null);
  if (closed.length < 5) return;

  const tradeSummaries = closed.map(t =>
    `${t.symbol} ${t.type?.toUpperCase()} | ${t.outcome?.toUpperCase()} | P&L: $${parseFloat(t.pnl!).toFixed(2)} | R: ${t.rMultiple != null ? t.rMultiple + "R" : "N/A"} | Session: ${t.session ?? "N/A"} | Emotion: ${t.emotion ?? "N/A"} | Strategy: ${t.strategy ?? "N/A"}`
  ).join("\n");

  const prompt = `Analyze the last ${closed.length} closed trades and detect recurring behavioral and technical patterns.

Trades (most recent first):
${tradeSummaries}

Provide pattern analysis in this format:

# Pattern Analysis — Last ${closed.length} Trades

## Recurring Mistake Patterns
[3-5 specific patterns with frequency]

## Emotional Trading Patterns  
[Analysis of how emotions correlate with outcomes — be specific with percentages]

## Best Performing Conditions
[When / how / what you trade best — specific conditions that correlate with wins]

## Worst Performing Conditions
[The consistent losing scenarios to avoid]

## Strategy Effectiveness
[Which strategies are working and which aren't based on the data]

## Overall Behavioral Assessment
[2-3 sentence honest assessment of the trading psychology visible in the data]`;

  const message = await createAnthropicMessage(prompt);
  const content = message.content[0].type === "text" ? message.content[0].text : "";

  await db.insert(aiReviewsTable).values({
    userId,
    tradeId: null,
    reportType: "pattern_analysis",
    content,
  });

  logger.info({ userId }, "Background pattern analysis generated");
}

async function runWeeklyReportsForAllUsers(): Promise<void> {
  if (!AI_AVAILABLE) {
    logger.info("Weekly report scheduler: AI not available, skipping");
    return;
  }

  logger.info("Weekly report scheduler: starting auto-generation");
  const users = await db.select({ id: usersTable.id }).from(usersTable);

  const results = await Promise.allSettled(
    users.map(u => generateWeeklyReportForUser(u.id))
  );

  const failed = results.filter(r => r.status === "rejected").length;
  if (failed > 0) {
    logger.warn({ failed, total: users.length }, "Some weekly reports failed");
  } else {
    logger.info({ total: users.length }, "Weekly reports generated for all users");
  }
}

async function runPatternAnalysisForAllUsers(): Promise<void> {
  if (!AI_AVAILABLE) return;

  logger.info("Pattern analysis scheduler: starting background analysis");
  const users = await db.select({ id: usersTable.id }).from(usersTable);

  const results = await Promise.allSettled(
    users.map(u => generatePatternAnalysisForUser(u.id))
  );

  const failed = results.filter(r => r.status === "rejected").length;
  if (failed > 0) {
    logger.warn({ failed, total: users.length }, "Some pattern analyses failed");
  } else {
    logger.info({ total: users.length }, "Pattern analysis completed for all users");
  }
}

export function startWeeklyScheduler(): void {
  const delay = msUntilNextMonday();
  const days = Math.round(delay / 86400000);
  logger.info({ delayMs: delay, daysUntilMonday: days }, "Weekly report scheduler: next run scheduled");

  setTimeout(function tick() {
    runWeeklyReportsForAllUsers().catch(err => {
      logger.error({ err }, "Weekly report auto-generation failed");
    });
    setTimeout(tick, 7 * 24 * 60 * 60 * 1000);
  }, delay);
}

export function startPatternAnalysisScheduler(): void {
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  logger.info("Pattern analysis scheduler: runs every 6 hours");

  const tick = () => {
    runPatternAnalysisForAllUsers().catch(err => {
      logger.error({ err }, "Background pattern analysis failed");
    });
    setTimeout(tick, SIX_HOURS);
  };

  setTimeout(tick, SIX_HOURS);
}
