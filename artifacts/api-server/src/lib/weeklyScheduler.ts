import { desc, eq, gte, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, tradesTable, aiReviewsTable } from "@workspace/db";
import { AI_AVAILABLE } from "@workspace/integrations-anthropic-ai";
import { generateWeeklyReport, createAnthropicMessage } from "./ai.js";
import { logger } from "./logger.js";

// ── Timing helpers ─────────────────────────────────────────────────────────────

/** Returns milliseconds until next Friday at 21:00 UTC. */
function msUntilNextFriday9PM(): number {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun … 5=Fri … 6=Sat
  let daysToAdd = (5 - dayOfWeek + 7) % 7; // days until Friday

  const target = new Date(now);
  target.setUTCDate(now.getUTCDate() + daysToAdd);
  target.setUTCHours(21, 0, 0, 0);

  // If we are already past Friday 21:00 UTC this week, push to next Friday
  if (target.getTime() <= now.getTime()) {
    target.setUTCDate(target.getUTCDate() + 7);
  }

  return target.getTime() - now.getTime();
}

// ── Email stub ─────────────────────────────────────────────────────────────────

/**
 * TODO: Wire up a real email provider (SendGrid, Resend, AWS SES, etc.)
 * For now this logs that the email would be sent.
 */
async function sendReportEmail(params: {
  to: string;
  subject: string;
  markdownContent: string;
}): Promise<void> {
  // Replace this with your email provider SDK call, e.g.:
  //   await resend.emails.send({ from: "...", to: params.to, subject: params.subject, text: params.markdownContent });
  logger.info(
    { to: params.to, subject: params.subject },
    "EMAIL STUB: weekly report would be sent here — wire up an email provider"
  );
}

// ── Per-user generators ────────────────────────────────────────────────────────

export async function generateWeeklyReportForUser(userId: number): Promise<void> {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const trades = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.userId, userId), gte(tradesTable.openTime, since)))
    .orderBy(desc(tradesTable.openTime));

  const closed = trades.filter((t) => t.pnl !== null);
  if (closed.length === 0) return;

  const { content, usage, cost } = await generateWeeklyReport(
    closed.map((t) => ({
      symbol: t.symbol,
      type: t.type,
      outcome: t.outcome,
      pnl: t.pnl,
      rMultiple: t.rMultiple,
      emotion: t.emotion,
      strategy: t.strategy,
      tags: t.tags,
      session: t.session,
    }))
  );

  await db.insert(aiReviewsTable).values({
    userId,
    tradeId: null,
    reportType: "weekly_report",
    content,
  });

  logger.info(
    { userId, trades: closed.length, tokens: usage, cost: cost.formatted },
    "Auto weekly report generated"
  );

  // Fetch user email for delivery
  const [user] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, userId));
  if (user) {
    await sendReportEmail({
      to: user.email,
      subject: `ChartLogs: Your Weekly Trading Report — ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
      markdownContent: content,
    });
  }
}

export async function generatePatternAnalysisForUser(userId: number): Promise<void> {
  const trades = await db
    .select()
    .from(tradesTable)
    .where(eq(tradesTable.userId, userId))
    .orderBy(desc(tradesTable.openTime))
    .limit(30);

  const closed = trades.filter((t) => t.pnl !== null);
  if (closed.length < 5) return;

  const tradeSummaries = closed
    .map(
      (t) =>
        `${t.symbol} ${t.type?.toUpperCase()} | ${t.outcome?.toUpperCase()} | P&L: $${parseFloat(t.pnl!).toFixed(2)} | R: ${t.rMultiple != null ? t.rMultiple + "R" : "N/A"} | Session: ${t.session ?? "N/A"} | Emotion: ${t.emotion ?? "N/A"} | Strategy: ${t.strategy ?? "N/A"}`
    )
    .join("\n");

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

// ── All-user runners ───────────────────────────────────────────────────────────

async function runWeeklyReportsForAllUsers(): Promise<void> {
  if (!AI_AVAILABLE) {
    logger.info("Weekly report scheduler: AI not available, skipping");
    return;
  }

  logger.info("Weekly report scheduler: starting Friday auto-generation");
  const users = await db.select({ id: usersTable.id }).from(usersTable);

  const results = await Promise.allSettled(users.map((u) => generateWeeklyReportForUser(u.id)));

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    logger.warn({ failed, total: users.length }, "Some weekly reports failed");
  } else {
    logger.info({ total: users.length }, "Weekly reports generated and emailed for all users");
  }
}

async function runPatternAnalysisForAllUsers(): Promise<void> {
  if (!AI_AVAILABLE) return;

  logger.info("Pattern analysis scheduler: starting background analysis");
  const users = await db.select({ id: usersTable.id }).from(usersTable);

  const results = await Promise.allSettled(users.map((u) => generatePatternAnalysisForUser(u.id)));

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    logger.warn({ failed, total: users.length }, "Some pattern analyses failed");
  } else {
    logger.info({ total: users.length }, "Pattern analysis completed for all users");
  }
}

// ── Scheduler exports ──────────────────────────────────────────────────────────

/**
 * Starts the weekly report job. Fires every Friday at 21:00 UTC,
 * generates an AI report for every user, and emails it.
 */
export function startWeeklyScheduler(): void {
  const delay = msUntilNextFriday9PM();
  const hours = Math.round(delay / 3_600_000);
  logger.info(
    { delayMs: delay, hoursUntilFriday9PM: hours },
    "Weekly report scheduler: next run on Friday 21:00 UTC"
  );

  const tick = () => {
    runWeeklyReportsForAllUsers().catch((err) => {
      logger.error({ err }, "Weekly report auto-generation failed");
    });
    setTimeout(tick, 7 * 24 * 60 * 60 * 1000); // re-arm every 7 days
  };

  setTimeout(tick, delay);
}

/**
 * Starts the pattern analysis background job (every 6 hours).
 */
export function startPatternAnalysisScheduler(): void {
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  logger.info("Pattern analysis scheduler: runs every 6 hours");

  const tick = () => {
    runPatternAnalysisForAllUsers().catch((err) => {
      logger.error({ err }, "Background pattern analysis failed");
    });
    setTimeout(tick, SIX_HOURS);
  };

  setTimeout(tick, SIX_HOURS);
}
