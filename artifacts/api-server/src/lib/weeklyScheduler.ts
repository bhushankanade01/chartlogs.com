import { desc, eq, gte, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, tradesTable, aiReviewsTable } from "@workspace/db";
import { getAnthropicClient, AI_AVAILABLE } from "@workspace/integrations-anthropic-ai";
import { logger } from "./logger.js";

const SYSTEM_PROMPT = `You are an expert forex/stock trading coach and performance analyst. 
You analyze trades and provide structured, actionable feedback. 
Be direct, specific, and constructive. Focus on risk management, emotional patterns, and execution quality.
Format responses in clear sections using markdown headings.`;

function msUntilNextMonday(): number {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysUntilMonday = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7 || 7;
  const nextMonday = new Date(now);
  nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday);
  nextMonday.setUTCHours(6, 0, 0, 0);
  return nextMonday.getTime() - now.getTime();
}

async function generateWeeklyReportForUser(userId: number): Promise<void> {
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

  const client = getAnthropicClient();
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0].type === "text" ? message.content[0].text : "";

  await db.insert(aiReviewsTable).values({
    userId,
    tradeId: null,
    reportType: "weekly_report",
    content,
  });

  logger.info({ userId }, "Auto weekly report generated");
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
