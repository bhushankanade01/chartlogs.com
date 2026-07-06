import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../app.js";
import { db, usersTable, sessionsTable, tradesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ── Fixed test data ──────────────────────────────────────────────────────────
//
// We insert trades directly with known pnl/outcome values so assertions against
// aggregated numbers are exact and deterministic — not derived from price math.
//
// Trade layout:
//   [A] EURUSD long  pnl=+100  outcome=win    openTime=60 days ago (outside 7d/30d)
//   [B] GBPUSD short pnl=+50   outcome=win    openTime=3 days ago  (inside 7d)
//   [C] USDJPY long  pnl=-40   outcome=loss   openTime=3 days ago  (inside 7d)
//
// Derived expected values:
//   period=all : trades=3, winners=2, losers=1, winRate=66.7, totalPnl=110.00
//   period=7d  : trades=2, winners=1, losers=1, winRate=50.0, totalPnl=10.00
//   by-symbol (all): EURUSD(100.00, 1, 100%), GBPUSD(50.00, 1, 100%), USDJPY(-40.00, 1, 0%)

const RUN_ID = Date.now();
const USER_EMAIL = `test-analytics-${RUN_ID}@test.internal`;
const OTHER_EMAIL = `test-analytics-other-${RUN_ID}@test.internal`;
const PASSWORD = "AnalyticsPass123!";

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

const BASE_TRADE = {
  type: "long" as const,
  entryPrice: "1.10000",
  exitPrice: "1.10500",
  positionSize: "0.10",
  source: "manual" as const,
};

let userId: number;
let otherUserId: number;
let token: string;
let otherToken: string;

describe("Analytics API", () => {
  beforeAll(async () => {
    // Create primary test user
    const [user] = await db
      .insert(usersTable)
      .values({
        email: USER_EMAIL,
        name: "Analytics Test User",
        passwordHash: await bcrypt.hash(PASSWORD, 4),
      })
      .returning();
    userId = user!.id;

    // Create secondary user (to verify isolation)
    const [otherUser] = await db
      .insert(usersTable)
      .values({
        email: OTHER_EMAIL,
        name: "Other Analytics User",
        passwordHash: await bcrypt.hash(PASSWORD, 4),
      })
      .returning();
    otherUserId = otherUser!.id;

    // Log both in for bearer tokens
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: USER_EMAIL, password: PASSWORD });
    token = loginRes.body.token as string;

    const otherLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: OTHER_EMAIL, password: PASSWORD });
    otherToken = otherLoginRes.body.token as string;

    // Seed known trades directly (bypasses price-based pnl calculation)
    await db.insert(tradesTable).values([
      {
        ...BASE_TRADE,
        userId,
        symbol: "EURUSD",
        type: "long",
        pnl: "100.00",
        outcome: "win",
        openTime: daysAgo(60),
        closeTime: daysAgo(60),
      },
      {
        ...BASE_TRADE,
        userId,
        symbol: "GBPUSD",
        type: "short",
        pnl: "50.00",
        outcome: "win",
        openTime: daysAgo(3),
        closeTime: daysAgo(3),
      },
      {
        ...BASE_TRADE,
        userId,
        symbol: "USDJPY",
        type: "long",
        pnl: "-40.00",
        outcome: "loss",
        openTime: daysAgo(3),
        closeTime: daysAgo(3),
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(tradesTable).where(eq(tradesTable.userId, userId));
    await db.delete(tradesTable).where(eq(tradesTable.userId, otherUserId));
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, otherUserId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    await db.delete(usersTable).where(eq(usersTable.id, otherUserId));
  });

  // ── Auth guards ─────────────────────────────────────────────────────────────

  it("GET /api/analytics/performance returns 401 without a token", async () => {
    const res = await request(app).get("/api/analytics/performance");
    expect(res.status).toBe(401);
  });

  it("GET /api/analytics/by-symbol returns 401 without a token", async () => {
    const res = await request(app).get("/api/analytics/by-symbol");
    expect(res.status).toBe(401);
  });

  it("GET /api/analytics/by-day returns 401 without a token", async () => {
    const res = await request(app).get("/api/analytics/by-day");
    expect(res.status).toBe(401);
  });

  // ── Performance summary — period=all ────────────────────────────────────────

  it("GET /api/analytics/performance?period=all returns correct trade counts", async () => {
    const res = await request(app)
      .get("/api/analytics/performance?period=all")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalTrades).toBe(3);
    expect(res.body.winners).toBe(2);
    expect(res.body.losers).toBe(1);
  });

  it("GET /api/analytics/performance?period=all returns correct total P&L", async () => {
    const res = await request(app)
      .get("/api/analytics/performance?period=all")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    // 100 + 50 + (-40) = 110
    expect(res.body.totalPnl).toBe(110.00);
  });

  it("GET /api/analytics/performance?period=all returns correct win rate", async () => {
    const res = await request(app)
      .get("/api/analytics/performance?period=all")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    // 2/3 * 100 = 66.666... → rounded to 66.7
    expect(res.body.winRate).toBe(66.7);
  });

  it("GET /api/analytics/performance?period=all returns correct profit factor", async () => {
    const res = await request(app)
      .get("/api/analytics/performance?period=all")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    // grossProfit = 150, grossLoss = 40 → PF = 150/40 = 3.75
    expect(res.body.profitFactor).toBe(3.75);
  });

  it("GET /api/analytics/performance?period=all returns correct expectancy", async () => {
    const res = await request(app)
      .get("/api/analytics/performance?period=all")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    // totalPnl/totalTrades = 110/3 ≈ 36.67
    expect(res.body.expectancy).toBe(36.67);
  });

  // ── Performance summary — period filter (7d excludes old trade) ─────────────

  it("GET /api/analytics/performance?period=7d excludes trades older than 7 days", async () => {
    const res = await request(app)
      .get("/api/analytics/performance?period=7d")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Only trades B and C (3 days ago) are within 7d; trade A (60 days ago) is excluded
    expect(res.body.totalTrades).toBe(2);
    expect(res.body.winners).toBe(1);
    expect(res.body.losers).toBe(1);
  });

  it("GET /api/analytics/performance?period=7d returns correct P&L for the filtered window", async () => {
    const res = await request(app)
      .get("/api/analytics/performance?period=7d")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    // 50 + (-40) = 10
    expect(res.body.totalPnl).toBe(10.00);
    // 1/2 * 100 = 50.0
    expect(res.body.winRate).toBe(50.0);
  });

  it("GET /api/analytics/performance?period=30d excludes trades older than 30 days", async () => {
    const res = await request(app)
      .get("/api/analytics/performance?period=30d")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Trade A is 60 days ago — outside 30d window
    expect(res.body.totalTrades).toBe(2);
  });

  // ── By-symbol aggregation ───────────────────────────────────────────────────

  it("GET /api/analytics/by-symbol aggregates P&L and win rate per symbol", async () => {
    const res = await request(app)
      .get("/api/analytics/by-symbol")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const bySymbol = Object.fromEntries(
      (res.body as { symbol: string; pnl: number; trades: number; winRate: number }[])
        .map(s => [s.symbol, s])
    );

    expect(bySymbol["EURUSD"]).toMatchObject({ pnl: 100.00, trades: 1, winRate: 100.0 });
    expect(bySymbol["GBPUSD"]).toMatchObject({ pnl: 50.00, trades: 1, winRate: 100.0 });
    expect(bySymbol["USDJPY"]).toMatchObject({ pnl: -40.00, trades: 1, winRate: 0.0 });
  });

  it("GET /api/analytics/by-symbol is sorted by P&L descending", async () => {
    const res = await request(app)
      .get("/api/analytics/by-symbol")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const pnls = (res.body as { pnl: number }[]).map(s => s.pnl);
    for (let i = 0; i < pnls.length - 1; i++) {
      expect(pnls[i]).toBeGreaterThanOrEqual(pnls[i + 1]!);
    }
  });

  // ── By-day shape ────────────────────────────────────────────────────────────

  it("GET /api/analytics/by-day returns exactly 5 weekday entries", async () => {
    const res = await request(app)
      .get("/api/analytics/by-day")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(5);

    const days = (res.body as { day: string }[]).map(d => d.day);
    expect(days).toEqual(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  });

  // ── Cross-user isolation ────────────────────────────────────────────────────

  it("GET /api/analytics/performance does not include another user's trades", async () => {
    const res = await request(app)
      .get("/api/analytics/performance?period=all")
      .set("Authorization", `Bearer ${otherToken}`);

    expect(res.status).toBe(200);
    // Other user has no trades — should see zeros
    expect(res.body.totalTrades).toBe(0);
    expect(res.body.totalPnl).toBe(0);
    expect(res.body.winRate).toBe(0);
  });

  it("GET /api/analytics/by-symbol does not expose another user's trades", async () => {
    const res = await request(app)
      .get("/api/analytics/by-symbol")
      .set("Authorization", `Bearer ${otherToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});
