import { Router, type IRouter } from "express";
import { CalculatePositionSizeBody } from "@workspace/api-zod";

const router: IRouter = Router();

const PIP_VALUES: Record<string, number> = {
  EURUSD: 10, GBPUSD: 10, AUDUSD: 10, NZDUSD: 10,
  USDCAD: 7.5, USDCHF: 10.5, USDJPY: 6.5, GBPJPY: 6.5, EURJPY: 6.5,
  XAUUSD: 100, XAGUSD: 50,
  default: 10,
};

function getPipValue(pair: string): number {
  const upper = pair.toUpperCase().replace("/", "");
  return PIP_VALUES[upper] ?? PIP_VALUES.default;
}

router.post("/tools/position-size", async (req, res): Promise<void> => {
  const parsed = CalculatePositionSizeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { accountBalance, riskPercent, stopLossPips, pair } = parsed.data;

  const dollarRisk = (accountBalance * riskPercent) / 100;
  const pipValue = getPipValue(pair);
  const lotSize = dollarRisk / (stopLossPips * pipValue);
  const units = lotSize * 100000;

  res.json({
    lotSize: parseFloat(lotSize.toFixed(4)),
    units: Math.round(units),
    dollarRisk: parseFloat(dollarRisk.toFixed(2)),
    pipValue,
  });
});

export default router;
