const PIP_SIZES: Record<string, number> = {
  default: 0.0001,
  jpy: 0.01,
  xau: 0.1,
  xag: 0.01,
};

export function getPipSize(symbol: string): number {
  const lower = symbol.toLowerCase();
  if (lower.includes("jpy")) return PIP_SIZES.jpy;
  if (lower.includes("xau") || lower.includes("gold")) return PIP_SIZES.xau;
  if (lower.includes("xag") || lower.includes("silver")) return PIP_SIZES.xag;
  return PIP_SIZES.default;
}

export function calculatePnl(
  type: "long" | "short",
  entryPrice: number,
  exitPrice: number,
  positionSize: number,
  fees: number = 0
): number {
  const direction = type === "long" ? 1 : -1;
  const rawPnl = (exitPrice - entryPrice) * positionSize * direction * 100000;
  return parseFloat((rawPnl - fees).toFixed(4));
}

export function calculatePips(
  type: "long" | "short",
  entryPrice: number,
  exitPrice: number,
  symbol: string
): number {
  const pipSize = getPipSize(symbol);
  const direction = type === "long" ? 1 : -1;
  return parseFloat(((exitPrice - entryPrice) / pipSize * direction).toFixed(1));
}

export function calculateRR(
  type: "long" | "short",
  entryPrice: number,
  takeProfitPrice: number | null,
  stopLossPrice: number | null
): number | null {
  if (!takeProfitPrice || !stopLossPrice) return null;
  const reward = Math.abs(takeProfitPrice - entryPrice);
  const risk = Math.abs(entryPrice - stopLossPrice);
  if (risk === 0) return null;
  return parseFloat((reward / risk).toFixed(2));
}

export function determineOutcome(pnl: number): "win" | "loss" | "breakeven" {
  if (pnl > 0) return "win";
  if (pnl < 0) return "loss";
  return "breakeven";
}
