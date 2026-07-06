import { Router } from "express";
import { eq, desc, and, gte } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  tradesTable,
  journalEntriesTable,
  aiReviewsTable,
  checklistResponsesTable,
  checklistTemplatesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";
import { AI_AVAILABLE } from "@workspace/integrations-anthropic-ai";
import { streamAnthropicMessage, createAnthropicMessage } from "../lib/ai.js";

const router = Router();

/**
 * Converts an Anthropic SDK error into a user-facing HTTP status + message.
 * Returns 402 for billing errors, 429 for rate limits, 503 for overload,
 * and 500 for everything else.
 */
function resolveAnthropicError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("credit balance is too low") || raw.includes("insufficient_quota") || raw.includes("billing")) {
    return {
      status: 402,
      message: "Anthropic account has no credits. Add credits at console.anthropic.com → Plans & Billing, then try again.",
    };
  }
  if (raw.includes("rate limit") || raw.includes("rate_limit")) {
    return { status: 429, message: "Anthropic rate limit hit. Please wait a moment and try again." };
  }
  if (raw.includes("overloaded")) {
    return { status: 503, message: "Anthropic is temporarily overloaded. Please try again shortly." };
  }
  return { status: 500, message: "AI request failed. Please try again." };
}

function getPeriodStart(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

router.get("/ai/status", requireAuth, (_req, res): void => {
  res.json({
    available: AI_AVAILABLE,
    message: AI_AVAILABLE
      ? "AI features are active"
      : "Add ANTHROPIC_API_KEY to your secrets to enable AI features",
  });
});

router.post("/ai/trade-review/:tradeId", requireAuth, async (req, res): Promise<void> => {
  if (!AI_AVAILABLE) {
    res.status(503).json({ error: "AI features require ANTHROPIC_API_KEY. Add it to your secrets." });
    return;
  }

  const tradeId = parseInt(String(req.params.tradeId));
  const userId = req.user!.id;

  const [trade] = await db.select().from(tradesTable)
    .where(and(eq(tradesTable.id, tradeId), eq(tradesTable.userId, userId)));

  if (!trade) {
    res.status(404).json({ error: "Trade not found" });
    return;
  }

  const [journalEntry] = await db.select().from(journalEntriesTable)
    .where(eq(journalEntriesTable.tradeId, tradeId));

  const checklistRows = await db
    .select({
      templateName: checklistTemplatesTable.name,
      questions: checklistTemplatesTable.questions,
      answers: checklistResponsesTable.answers,
    })
    .from(checklistResponsesTable)
    .innerJoin(
      checklistTemplatesTable,
      eq(checklistResponsesTable.templateId, checklistTemplatesTable.id),
    )
    .where(
      and(
        eq(checklistResponsesTable.tradeId, tradeId),
        eq(checklistResponsesTable.userId, userId),
      ),
    );

  let checklistSection = "";
  if (checklistRows.length > 0) {
    const lines: string[] = [];
    for (const row of checklistRows) {
      lines.push(`Checklist: ${row.templateName}`);
      const questions = Array.isArray(row.questions) ? row.questions : [];
      const answers = Array.isArray(row.answers) ? row.answers : [];
      questions.forEach((q, i) => {
        const answer = answers[i];
        const qText = typeof q === "object" && q !== null && "text" in q ? String((q as { text: string }).text) : String(q);
        const aText = answer !== undefined && answer !== null ? String(answer) : "—";
        lines.push(`  Q: ${qText} → ${aText}`);
      });
    }
    checklistSection = "\nChecklist Answers:\n" + lines.join("\n");
  }

  const tradeContext = `
Trade Details:
- Symbol: ${trade.symbol}
- Direction: ${trade.type?.toUpperCase()}
- Entry: ${trade.entryPrice}, Exit: ${trade.exitPrice ?? "Open"}
- Position Size: ${trade.positionSize} lots
- Stop Loss: ${trade.stopLoss ?? "Not set"}, Take Profit: ${trade.takeProfit ?? "Not set"}
- R-Multiple: ${trade.rMultiple != null ? trade.rMultiple + "R" : "Not calculated"}
- P&L: ${trade.pnl != null ? "$" + parseFloat(trade.pnl).toFixed(2) : "Open"}
- Outcome: ${trade.outcome ?? "Open"}
- Session: ${trade.session ?? "Unknown"}
- Strategy: ${trade.strategy ?? "None tagged"}
- Tags: ${trade.tags?.join(", ") || "None"}
- Emotion: ${trade.emotion ?? "Not recorded"}
- Trade Rating: ${trade.rating ?? "Not rated"}/5
- Open: ${trade.openTime}, Close: ${trade.closeTime ?? "Still open"}
${journalEntry?.notes ? `- Journal Notes: ${journalEntry.notes}` : ""}${checklistSection}
`.trim();

  const prompt = `Analyze this trade and provide a structured review:

${tradeContext}

Provide your review in exactly this format:

## What Went Well
[2-3 specific positives about this trade's execution, setup, or management]

## Areas to Improve
[2-3 specific, actionable improvements]

## Checklist Adherence
[If checklist answers are present, comment on rule adherence. If no checklist, skip this section.]

## Risk Management Score
[Score X/10 with one-line rationale]

## Pattern Label
[Single label like "Clean breakout entry", "Revenge trade", "FOMO entry", "Premature exit", "Patient execution", "Overlevered", etc.]

## Key Takeaway
[One sentence — the single most important lesson from this trade]`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullContent = "";

  try {
    const stream = streamAnthropicMessage(prompt);

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullContent += event.delta.text;
        res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
      }
    }

    await db.insert(aiReviewsTable).values({
      userId,
      tradeId,
      reportType: "trade_review",
      content: fullContent,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "AI trade review failed");
    const { message } = resolveAnthropicError(err);
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
});

router.post("/ai/weekly-report", requireAuth, async (req, res): Promise<void> => {
  if (!AI_AVAILABLE) {
    res.status(503).json({ error: "AI features require ANTHROPIC_API_KEY. Add it to your secrets." });
    return;
  }

  const userId = req.user!.id;
  const since = getPeriodStart(7);

  const trades = await db.select().from(tradesTable)
    .where(and(eq(tradesTable.userId, userId), gte(tradesTable.openTime, since)))
    .orderBy(desc(tradesTable.openTime));

  const closed = trades.filter(t => t.pnl !== null);

  if (closed.length === 0) {
    res.status(400).json({ error: "No closed trades in the past 7 days to generate a report." });
    return;
  }

  const totalPnl = closed.reduce((s, t) => s + parseFloat(t.pnl!), 0);
  const wins = closed.filter(t => t.outcome === "win").length;
  const losses = closed.filter(t => t.outcome === "loss").length;
  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;

  const tradeSummaries = closed.slice(0, 20).map(t =>
    `${t.symbol} ${t.type?.toUpperCase()} | ${t.outcome?.toUpperCase()} | P&L: $${parseFloat(t.pnl!).toFixed(2)} | R: ${t.rMultiple != null ? t.rMultiple + "R" : "N/A"} | Emotion: ${t.emotion ?? "N/A"} | Strategy: ${t.strategy ?? "N/A"} | Tags: ${t.tags?.join(",") || "none"}`
  ).join("\n");

  const prompt = `Generate a weekly trading performance report for the past 7 days.

Statistics:
- Total trades: ${closed.length}
- Wins: ${wins}, Losses: ${losses}, Win rate: ${winRate.toFixed(1)}%
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

## Worst Setup
[The single worst trade and the lesson]

## 3 Improvement Actions for Next Week
1. [Specific, measurable action]
2. [Specific, measurable action]
3. [Specific, measurable action]`;

  try {
    const message = await createAnthropicMessage(prompt);
    const content = message.content[0].type === "text" ? message.content[0].text : "";

    const [report] = await db.insert(aiReviewsTable).values({
      userId,
      tradeId: null,
      reportType: "weekly_report",
      content,
    }).returning();

    res.json({
      id: report.id,
      tradeId: null,
      reportType: "weekly_report",
      content,
      createdAt: report.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Weekly report generation failed");
    const { status, message } = resolveAnthropicError(err);
    res.status(status).json({ error: message });
  }
});

router.get("/ai/patterns", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const [latest] = await db.select().from(aiReviewsTable)
    .where(and(eq(aiReviewsTable.userId, userId), eq(aiReviewsTable.reportType, "pattern_analysis")))
    .orderBy(desc(aiReviewsTable.createdAt))
    .limit(1);

  if (!latest) {
    res.json(null);
    return;
  }

  res.json({
    id: latest.id,
    tradeId: latest.tradeId,
    reportType: latest.reportType,
    content: latest.content,
    createdAt: latest.createdAt.toISOString(),
  });
});

router.post("/ai/patterns", requireAuth, async (req, res): Promise<void> => {
  if (!AI_AVAILABLE) {
    res.status(503).json({ error: "AI features require ANTHROPIC_API_KEY. Add it to your secrets." });
    return;
  }

  const userId = req.user!.id;

  const trades = await db.select().from(tradesTable)
    .where(eq(tradesTable.userId, userId))
    .orderBy(desc(tradesTable.openTime))
    .limit(30);

  const closed = trades.filter(t => t.pnl !== null);

  if (closed.length < 5) {
    res.status(400).json({ error: "Need at least 5 closed trades for pattern analysis." });
    return;
  }

  const tradeSummaries = closed.map(t =>
    `${t.symbol} ${t.type?.toUpperCase()} | ${t.outcome?.toUpperCase()} | P&L: $${parseFloat(t.pnl!).toFixed(2)} | R: ${t.rMultiple != null ? t.rMultiple + "R" : "N/A"} | Session: ${t.session ?? "N/A"} | Emotion: ${t.emotion ?? "N/A"} | Strategy: ${t.strategy ?? "N/A"} | Tags: ${t.tags?.join(",") || "none"}`
  ).join("\n");

  const prompt = `Analyze the last ${closed.length} closed trades. Respond with ONLY valid JSON — no markdown, no explanation, no code fences. Use this exact schema:

{
  "criticalIssues": [
    { "stat": "<number or %>", "label": "<4-6 words>", "detail": "<6-8 words max>" }
  ],
  "strengths": [
    { "stat": "<number or %>", "label": "<4-6 words>", "detail": "<6-8 words max>" }
  ],
  "worstPatterns": [
    { "label": "<pattern name 4-6 words>", "frequency": "<e.g. 6 of last 10 trades>" }
  ],
  "immediateActions": [
    { "priority": "high|medium|low", "action": "<max 8 words>" }
  ],
  "flags": ["<short warning badge 2-4 words>"]
}

Rules:
- criticalIssues: 2-4 items, things hurting performance most (e.g. low win rate on direction, big losses in session)
- strengths: 1-3 items, what is actually working
- worstPatterns: 2-4 recurring behavioral mistakes with frequency from the data
- immediateActions: 3 actions max, ordered by priority
- flags: 2-5 short data-quality or risk warnings (e.g. "No R-Values", "Revenge Trading", "Overtrading Fridays")
- Every stat must come from the actual trade data below

Trades (most recent first):
${tradeSummaries}`;

  try {
    const message = await createAnthropicMessage(prompt);
    const content = message.content[0].type === "text" ? message.content[0].text : "";

    const [report] = await db.insert(aiReviewsTable).values({
      userId,
      tradeId: null,
      reportType: "pattern_analysis",
      content,
    }).returning();

    res.json({
      id: report.id,
      tradeId: null,
      reportType: "pattern_analysis",
      content,
      createdAt: report.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Pattern analysis failed");
    const { status, message } = resolveAnthropicError(err);
    res.status(status).json({ error: message });
  }
});

router.get("/ai/reports", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const reportType = req.query.reportType as string | undefined;
  const tradeId = req.query.tradeId ? parseInt(String(req.query.tradeId)) : undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? "20")), 50);

  const conditions = [eq(aiReviewsTable.userId, userId)];
  if (reportType) conditions.push(eq(aiReviewsTable.reportType, reportType as "trade_review" | "weekly_report" | "pattern_analysis"));
  if (tradeId && !isNaN(tradeId)) conditions.push(eq(aiReviewsTable.tradeId, tradeId));

  const reports = await db.select().from(aiReviewsTable)
    .where(and(...conditions))
    .orderBy(desc(aiReviewsTable.createdAt))
    .limit(limit);

  res.json(reports.map(r => ({
    id: r.id,
    tradeId: r.tradeId,
    reportType: r.reportType,
    content: r.content,
    createdAt: r.createdAt.toISOString(),
  })));
});

export default router;
