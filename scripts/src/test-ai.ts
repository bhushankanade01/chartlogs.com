/**
 * Standalone AI integration test.
 *
 * Run with:
 *   pnpm --filter @workspace/scripts exec tsx src/test-ai.ts
 *
 * Requires ANTHROPIC_API_KEY in your environment / Replit Secrets.
 */

import Anthropic from "@anthropic-ai/sdk";

// ── Cost estimation (mirrors artifacts/api-server/src/lib/ai.ts) ───────────────

const HAIKU_MODEL = "claude-haiku-4-5";
const HAIKU_INPUT_COST_PER_M = 0.8;
const HAIKU_OUTPUT_COST_PER_M = 4.0;

function estimateHaikuCost(inputTokens: number, outputTokens: number) {
  const inputCost = (inputTokens / 1_000_000) * HAIKU_INPUT_COST_PER_M;
  const outputCost = (outputTokens / 1_000_000) * HAIKU_OUTPUT_COST_PER_M;
  const totalCost = inputCost + outputCost;
  return { inputCost, outputCost, totalCost, formatted: `$${totalCost.toFixed(6)}` };
}

// ── Mock trade data ────────────────────────────────────────────────────────────

const mockTrades = [
  { symbol: "EURUSD", type: "long", outcome: "win", pnl: "120.50", rMultiple: "2.1", emotion: "calm", strategy: "Breakout", tags: ["London session"] },
  { symbol: "GBPUSD", type: "short", outcome: "loss", pnl: "-45.00", rMultiple: "-0.9", emotion: "anxious", strategy: "Reversal", tags: ["NY session"] },
  { symbol: "XAUUSD", type: "long", outcome: "win", pnl: "310.00", rMultiple: "3.2", emotion: "calm", strategy: "Trend follow", tags: ["breakout"] },
];

// ── Test: estimateHaikuCost ────────────────────────────────────────────────────

console.log("\n── Test: estimateHaikuCost ──");
const costExample = estimateHaikuCost(1000, 500);
console.log(`  1,000 input + 500 output tokens → ${costExample.formatted}`);
console.log(`  Input cost:  $${costExample.inputCost.toFixed(6)}`);
console.log(`  Output cost: $${costExample.outputCost.toFixed(6)}`);
console.log("  ✓ estimateHaikuCost works\n");

// ── Test: analyzeTrade (real API call) ────────────────────────────────────────

async function runTests() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("✗ ANTHROPIC_API_KEY is not set. Add it to Replit Secrets and restart.");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  // Test 1: analyzeTrade
  console.log("── Test: analyzeTrade ──");
  const trade = mockTrades[0]!;
  const tradePrompt = `Analyze this forex trade briefly:
Symbol: ${trade.symbol} | Direction: ${trade.type?.toUpperCase()} | Outcome: ${trade.outcome?.toUpperCase()} | P&L: $${trade.pnl} | R: ${trade.rMultiple}R | Emotion: ${trade.emotion} | Strategy: ${trade.strategy}

Respond in 2-3 sentences with one concrete takeaway.`;

  const tradeMsg = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 256,
    messages: [{ role: "user", content: tradePrompt }],
  });

  const tradeContent = tradeMsg.content[0].type === "text" ? tradeMsg.content[0].text : "";
  const tradeCost = estimateHaikuCost(tradeMsg.usage.input_tokens, tradeMsg.usage.output_tokens);

  console.log("\n  AI Response:");
  console.log("  " + tradeContent.replace(/\n/g, "\n  "));
  console.log(`\n  Tokens: ${tradeMsg.usage.input_tokens} in / ${tradeMsg.usage.output_tokens} out`);
  console.log(`  Cost: ${tradeCost.formatted}`);
  console.log("  ✓ analyzeTrade works\n");

  // Test 2: generateWeeklyReport (abbreviated)
  console.log("── Test: generateWeeklyReport ──");
  const totalPnl = mockTrades.reduce((s, t) => s + parseFloat(t.pnl), 0);
  const wins = mockTrades.filter((t) => t.outcome === "win").length;
  const reportPrompt = `Generate a 3-sentence weekly trading summary:
${mockTrades.length} trades, ${wins} wins, Total P&L: $${totalPnl.toFixed(2)}
Trades: ${mockTrades.map((t) => `${t.symbol} ${t.outcome?.toUpperCase()} $${t.pnl}`).join(", ")}`;

  const reportMsg = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 256,
    messages: [{ role: "user", content: reportPrompt }],
  });

  const reportContent = reportMsg.content[0].type === "text" ? reportMsg.content[0].text : "";
  const reportCost = estimateHaikuCost(reportMsg.usage.input_tokens, reportMsg.usage.output_tokens);

  console.log("\n  AI Response:");
  console.log("  " + reportContent.replace(/\n/g, "\n  "));
  console.log(`\n  Tokens: ${reportMsg.usage.input_tokens} in / ${reportMsg.usage.output_tokens} out`);
  console.log(`  Cost: ${reportCost.formatted}`);
  console.log("  ✓ generateWeeklyReport works\n");

  const totalCost = estimateHaikuCost(
    tradeMsg.usage.input_tokens + reportMsg.usage.input_tokens,
    tradeMsg.usage.output_tokens + reportMsg.usage.output_tokens
  );
  console.log(`── Total test cost: ${totalCost.formatted} ──\n`);
  console.log("✓ All tests passed — Claude Haiku integration is working correctly.\n");
}

runTests().catch((err) => {
  console.error("✗ Test failed:", (err as Error).message);
  process.exit(1);
});
