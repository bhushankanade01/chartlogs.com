import { getAnthropicClient } from "@workspace/integrations-anthropic-ai";

export const HAIKU_MODEL = "claude-haiku-4-5";

// Claude Haiku 4.5 pricing per 1M tokens
const HAIKU_INPUT_COST_PER_M = 0.8;
const HAIKU_OUTPUT_COST_PER_M = 4.0;

export const TRADING_SYSTEM_PROMPT = `You are an expert forex/stock trading coach and performance analyst.
You analyze trades and provide structured, actionable feedback.
Be direct, specific, and constructive. Focus on risk management, emotional patterns, and execution quality.
Format responses in clear sections using markdown headings.`;

// ── Cost estimation ────────────────────────────────────────────────────────────

export function estimateHaikuCost(
  inputTokens: number,
  outputTokens: number
): { inputCost: number; outputCost: number; totalCost: number; formatted: string } {
  const inputCost = (inputTokens / 1_000_000) * HAIKU_INPUT_COST_PER_M;
  const outputCost = (outputTokens / 1_000_000) * HAIKU_OUTPUT_COST_PER_M;
  const totalCost = inputCost + outputCost;
  return { inputCost, outputCost, totalCost, formatted: `$${totalCost.toFixed(6)}` };
}

// ── Core API wrappers ──────────────────────────────────────────────────────────

export function createAnthropicMessage(prompt: string) {
  const client = getAnthropicClient();
  return client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 4096,
    system: TRADING_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });
}

export function streamAnthropicMessage(prompt: string) {
  const client = getAnthropicClient();
  return client.messages.stream({
    model: HAIKU_MODEL,
    max_tokens: 4096,
    system: TRADING_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });
}

// ── High-level helpers (usable from routes, scheduler, and scripts) ────────────

export interface TradeSummary {
  symbol: string;
  type?: string | null;
  outcome?: string | null;
  pnl?: string | null;
  rMultiple?: string | null;
  emotion?: string | null;
  strategy?: string | null;
  tags?: string[] | null;
  session?: string | null;
  entryPrice?: string | null;
  exitPrice?: string | null;
  stopLoss?: string | null;
  takeProfit?: string | null;
  positionSize?: string | null;
  journalNotes?: string | null;
}

/**
 * Generate a weekly performance report from a list of closed trades.
 * Returns the markdown report text, token usage, and estimated cost.
 */
export async function generateWeeklyReport(trades: TradeSummary[]): Promise<{
  content: string;
  usage: { inputTokens: number; outputTokens: number };
  cost: ReturnType<typeof estimateHaikuCost>;
}> {
  const closed = trades.filter((t) => t.pnl !== null && t.pnl !== undefined);
  if (closed.length === 0) throw new Error("No closed trades to report on");

  const totalPnl = closed.reduce((s, t) => s + parseFloat(t.pnl!), 0);
  const wins = closed.filter((t) => t.outcome === "win").length;
  const losses = closed.filter((t) => t.outcome === "loss").length;
  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;

  const tradeSummaries = closed
    .slice(0, 20)
    .map(
      (t) =>
        `${t.symbol} ${t.type?.toUpperCase() ?? "?"} | ${t.outcome?.toUpperCase() ?? "?"} | P&L: $${parseFloat(t.pnl!).toFixed(2)} | R: ${t.rMultiple != null ? t.rMultiple + "R" : "N/A"} | Emotion: ${t.emotion ?? "N/A"} | Strategy: ${t.strategy ?? "N/A"} | Tags: ${t.tags?.join(",") || "none"}`
    )
    .join("\n");

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

  const message = await createAnthropicMessage(prompt);
  const content = message.content[0].type === "text" ? message.content[0].text : "";
  const usage = { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens };
  return { content, usage, cost: estimateHaikuCost(usage.inputTokens, usage.outputTokens) };
}

/**
 * Analyze a single trade and return structured AI coaching feedback.
 */
export async function analyzeTrade(trade: TradeSummary): Promise<{
  content: string;
  usage: { inputTokens: number; outputTokens: number };
  cost: ReturnType<typeof estimateHaikuCost>;
}> {
  const prompt = `Analyze this trade and provide a structured review:

Trade Details:
- Symbol: ${trade.symbol}
- Direction: ${trade.type?.toUpperCase() ?? "Unknown"}
- Entry: ${trade.entryPrice ?? "N/A"}, Exit: ${trade.exitPrice ?? "Open"}
- Position Size: ${trade.positionSize ?? "N/A"} lots
- Stop Loss: ${trade.stopLoss ?? "Not set"}, Take Profit: ${trade.takeProfit ?? "Not set"}
- R-Multiple: ${trade.rMultiple != null ? trade.rMultiple + "R" : "Not calculated"}
- P&L: ${trade.pnl != null ? "$" + parseFloat(trade.pnl).toFixed(2) : "Open"}
- Outcome: ${trade.outcome ?? "Open"}
- Session: ${trade.session ?? "Unknown"}
- Emotion: ${trade.emotion ?? "Not recorded"}
- Strategy: ${trade.strategy ?? "None tagged"}
- Tags: ${trade.tags?.join(", ") || "None"}
${trade.journalNotes ? `- Journal Notes: ${trade.journalNotes}` : ""}

Provide your review in exactly this format:

## What Went Well
[2-3 specific positives about this trade's execution, setup, or management]

## Areas to Improve
[2-3 specific, actionable improvements]

## Risk Management Score
[Score X/10 with one-line rationale]

## Pattern Label
[Single label like "Clean breakout entry", "Revenge trade", "FOMO entry", "Premature exit", "Patient execution", "Overlevered", etc.]

## Key Takeaway
[One sentence — the single most important lesson from this trade]`;

  const message = await createAnthropicMessage(prompt);
  const content = message.content[0].type === "text" ? message.content[0].text : "";
  const usage = { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens };
  return { content, usage, cost: estimateHaikuCost(usage.inputTokens, usage.outputTokens) };
}
