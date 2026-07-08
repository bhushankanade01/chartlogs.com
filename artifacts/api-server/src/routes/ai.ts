import { Router } from "express";
import { eq, desc, and, gte, inArray } from "drizzle-orm";
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

const WEEKLY_AI_REPORT_LIMIT = 2;
const QUOTA_REPORT_TYPES = ["weekly_report", "pattern_analysis"] as const;

/** Most recent Monday 00:00:00 UTC, used as the weekly quota window start. */
function getWeekStart(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const daysSinceMonday = (day + 6) % 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);
  return monday;
}

function getWeekResetAt(): Date {
  const start = getWeekStart();
  const next = new Date(start);
  next.setUTCDate(next.getUTCDate() + 7);
  return next;
}

async function getWeeklyAiReportUsage(userId: number): Promise<number> {
  const weekStart = getWeekStart();
  const rows = await db.select({ id: aiReviewsTable.id }).from(aiReviewsTable).where(
    and(
      eq(aiReviewsTable.userId, userId),
      inArray(aiReviewsTable.reportType, QUOTA_REPORT_TYPES),
      gte(aiReviewsTable.createdAt, weekStart),
    ),
  );
  return rows.length;
}

const WEEKLY_QUOTA_MESSAGE = "You've used both AI reports this week. Resets Monday.";

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

router.get("/ai/quota", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const used = await getWeeklyAiReportUsage(userId);
  res.json({
    used,
    limit: WEEKLY_AI_REPORT_LIMIT,
    resetsAt: getWeekResetAt().toISOString(),
  });
});

router.post("/ai/weekly-report", requireAuth, async (req, res): Promise<void> => {
  if (!AI_AVAILABLE) {
    res.status(503).json({ error: "AI features require ANTHROPIC_API_KEY. Add it to your secrets." });
    return;
  }

  const userId = req.user!.id;

  if ((await getWeeklyAiReportUsage(userId)) >= WEEKLY_AI_REPORT_LIMIT) {
    res.status(429).json({ error: WEEKLY_QUOTA_MESSAGE });
    return;
  }

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

  if ((await getWeeklyAiReportUsage(userId)) >= WEEKLY_AI_REPORT_LIMIT) {
    res.status(429).json({ error: WEEKLY_QUOTA_MESSAGE });
    return;
  }

  const trades = await db.select().from(tradesTable)
    .where(eq(tradesTable.userId, userId))
    .orderBy(desc(tradesTable.openTime))
    .limit(50);

  const closed = trades.filter(t => t.pnl !== null);

  if (closed.length < 5) {
    res.status(400).json({ error: "Need at least 5 closed trades for pattern analysis." });
    return;
  }

  // Compute summary stats to anchor AI responses in real numbers
  const winners = closed.filter(t => t.outcome === "win");
  const losers  = closed.filter(t => t.outcome === "loss");
  const totalPnl = closed.reduce((s, t) => s + parseFloat(t.pnl!), 0);
  const winRate  = ((winners.length / closed.length) * 100).toFixed(1);
  const avgWin   = winners.length > 0
    ? (winners.reduce((s, t) => s + parseFloat(t.pnl!), 0) / winners.length).toFixed(2)
    : "0.00";
  const avgLoss  = losers.length > 0
    ? (losers.reduce((s, t) => s + parseFloat(t.pnl!), 0) / losers.length).toFixed(2)
    : "0.00";
  const grossProfit = winners.reduce((s, t) => s + parseFloat(t.pnl!), 0);
  const grossLoss   = Math.abs(losers.reduce((s, t) => s + parseFloat(t.pnl!), 0));
  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? "∞" : "0.00";

  // Sort by P&L ascending to get worst 3 trades
  const sortedByPnl = [...closed].sort((a, b) => parseFloat(a.pnl!) - parseFloat(b.pnl!));
  const worstThree  = sortedByPnl.slice(0, 3);

  // Per-trade detail rows — include prices, timing, size for the AI to reason about
  const tradeRows = closed.slice(0, 40).map((t, i) => {
    const pnl = parseFloat(t.pnl!).toFixed(2);
    const open  = t.openTime  ? new Date(t.openTime).toISOString().slice(0, 16).replace("T", " ") : "?";
    const close = t.closeTime ? new Date(t.closeTime).toISOString().slice(0, 16).replace("T", " ") : "open";
    return `#${i + 1} ${t.symbol} ${(t.type ?? "").toUpperCase()} | entry=${t.entryPrice ?? "?"} exit=${t.exitPrice ?? "?"} | size=${t.positionSize ?? "?"}lots | pnl=$${pnl} | ${(t.outcome ?? "?").toUpperCase()} | opened=${open} closed=${close} | emotion=${t.emotion ?? "none"} | strategy=${t.strategy ?? "none"} | tags=${t.tags?.join(",") || "none"}`;
  }).join("\n");

  const worstRows = worstThree.map((t, i) => {
    const open  = t.openTime  ? new Date(t.openTime).toISOString().slice(0, 10) : "?";
    return `WORST_${i + 1}: ${t.symbol} ${(t.type ?? "").toUpperCase()} | entry=${t.entryPrice ?? "?"} exit=${t.exitPrice ?? "?"} | pnl=$${parseFloat(t.pnl!).toFixed(2)} | date=${open} | emotion=${t.emotion ?? "none"} | strategy=${t.strategy ?? "none"}`;
  }).join("\n");

  const systemPrompt = `You are a trading coach. Analyze ONLY the data provided. Never use generic phrases like "execution quality drifted" or "market conditions". Every insight must reference specific numbers from the trades. For worst trades, explain WHY that specific trade lost based on its entry/exit prices, timing, and how it compares to the user's average winners. Return JSON only — no markdown, no explanation, no code fences.`;

  const userPrompt = `Analyze these ${closed.length} closed trades. Return ONLY valid JSON matching this exact schema:

{
  "blindspots": [
    {
      "title": "<4-6 word problem title>",
      "severity": "warning|critical",
      "explanation": "<1 sentence using actual numbers from the data — max 15 words>",
      "evidence": "<specific numbers, e.g. 'Avg loss $${Math.abs(parseFloat(avgLoss)).toFixed(2)} vs avg win $${parseFloat(avgWin).toFixed(2)}'>",
      "tip": "<1 actionable sentence — specific rule the trader can follow>"
    }
  ],
  "worstTrades": [
    {
      "symbol": "<e.g. EURUSD>",
      "direction": "<LONG|SHORT>",
      "date": "<e.g. Jun 12>",
      "pnl": "<e.g. -$120.50>",
      "whatWentWrong": "<1 sentence referencing entry price, exit, or timing — no generic phrases>",
      "lesson": "<1 sentence actionable rule derived from this specific trade>"
    }
  ],
  "actionPlan": [
    {
      "title": "<bold 3-5 word rule>",
      "why": "<1 sentence with a specific stat from the data>",
      "measure": "<1 sentence: how to know if it's working>"
    }
  ]
}

Rules:
- blindspots: 2-4 items ordered by severity. severity="critical" if it's costing more than 30% of total losses.
- worstTrades: exactly 3 items for WORST_1, WORST_2, WORST_3 below.
- actionPlan: exactly 3 steps numbered by impact.
- NEVER use phrases like "execution quality", "market conditions", "be more disciplined", "improve your mindset".
- Every stat must be a real number from the trade data.

Account summary:
- Total trades: ${closed.length} | Winners: ${winners.length} | Losers: ${losers.length}
- Win rate: ${winRate}% | Total P&L: $${totalPnl.toFixed(2)}
- Avg winner: $${parseFloat(avgWin).toFixed(2)} | Avg loser: $${parseFloat(avgLoss).toFixed(2)}
- Profit factor: ${profitFactor}

Worst 3 trades to analyze:
${worstRows}

All trades (most recent first):
${tradeRows}`;

  try {
    const message = await createAnthropicMessage(userPrompt, { system: systemPrompt });
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
