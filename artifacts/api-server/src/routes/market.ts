import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// Seeded economic calendar events (mock data - would normally fetch from an API)
const EVENTS = [
  { id: "1", time: "2026-05-20T08:30:00Z", country: "US", currency: "USD", impact: "high" as const, event: "Non-Farm Payrolls", actual: "177K", forecast: "175K", previous: "228K" },
  { id: "2", time: "2026-05-20T09:00:00Z", country: "EU", currency: "EUR", impact: "medium" as const, event: "CPI Flash Estimate y/y", actual: null, forecast: "2.2%", previous: "2.4%" },
  { id: "3", time: "2026-05-20T10:00:00Z", country: "US", currency: "USD", impact: "high" as const, event: "ISM Manufacturing PMI", actual: null, forecast: "49.5", previous: "50.3" },
  { id: "4", time: "2026-05-20T12:30:00Z", country: "CA", currency: "CAD", impact: "medium" as const, event: "Retail Sales m/m", actual: null, forecast: "0.3%", previous: "-0.1%" },
  { id: "5", time: "2026-05-20T13:00:00Z", country: "US", currency: "USD", impact: "low" as const, event: "Factory Orders m/m", actual: null, forecast: "0.6%", previous: "-0.5%" },
  { id: "6", time: "2026-05-20T14:00:00Z", country: "GB", currency: "GBP", impact: "high" as const, event: "BOE Interest Rate Decision", actual: null, forecast: "4.25%", previous: "4.50%" },
  { id: "7", time: "2026-05-20T16:00:00Z", country: "JP", currency: "JPY", impact: "medium" as const, event: "Trade Balance", actual: null, forecast: "0.08T", previous: "0.06T" },
  { id: "8", time: "2026-05-21T08:30:00Z", country: "US", currency: "USD", impact: "high" as const, event: "Unemployment Claims", actual: null, forecast: "210K", previous: "207K" },
  { id: "9", time: "2026-05-21T09:45:00Z", country: "US", currency: "USD", impact: "medium" as const, event: "Services PMI", actual: null, forecast: "54.3", previous: "53.8" },
  { id: "10", time: "2026-05-21T10:30:00Z", country: "CA", currency: "CAD", impact: "high" as const, event: "BOC Interest Rate Decision", actual: null, forecast: "2.75%", previous: "3.00%" },
  { id: "11", time: "2026-05-22T08:30:00Z", country: "US", currency: "USD", impact: "high" as const, event: "Core PCE Price Index m/m", actual: null, forecast: "0.2%", previous: "0.3%" },
  { id: "12", time: "2026-05-22T10:00:00Z", country: "EU", currency: "EUR", impact: "high" as const, event: "ECB Monetary Policy Meeting Accounts", actual: null, forecast: null, previous: null },
  { id: "13", time: "2026-05-23T08:30:00Z", country: "US", currency: "USD", impact: "medium" as const, event: "GDP q/q", actual: null, forecast: "1.8%", previous: "2.1%" },
  { id: "14", time: "2026-05-23T15:00:00Z", country: "US", currency: "USD", impact: "high" as const, event: "Consumer Sentiment", actual: null, forecast: "67.5", previous: "64.7" },
  { id: "15", time: "2026-05-24T08:30:00Z", country: "JP", currency: "JPY", impact: "medium" as const, event: "Household Spending y/y", actual: null, forecast: "-0.5%", previous: "0.1%" },
  { id: "16", time: "2026-05-24T09:00:00Z", country: "GB", currency: "GBP", impact: "high" as const, event: "Retail Sales m/m", actual: null, forecast: "0.4%", previous: "-0.4%" },
];

router.get("/market/calendar", requireAuth, async (req, res): Promise<void> => {
  const period = (req.query.period as string) ?? "today";
  const impact = (req.query.impact as string) ?? "all";
  const currency = req.query.currency as string | undefined;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const endOfWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  let events = [...EVENTS];

  if (period === "today") {
    events = events.filter(e => {
      const d = new Date(e.time);
      return d >= today && d < tomorrow;
    });
  } else if (period === "tomorrow") {
    events = events.filter(e => {
      const d = new Date(e.time);
      return d >= tomorrow && d < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);
    });
  } else if (period === "this_week") {
    events = events.filter(e => new Date(e.time) < endOfWeek);
  }

  if (impact !== "all") {
    events = events.filter(e => e.impact === impact);
  }

  if (currency) {
    events = events.filter(e => e.currency.toUpperCase() === currency.toUpperCase());
  }

  res.json(events);
});

export default router;
