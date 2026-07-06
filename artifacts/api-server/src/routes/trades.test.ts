import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../app.js";
import { db, usersTable, sessionsTable, tradesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const RUN_ID = Date.now();
const TEST_EMAIL = `test-trades-${RUN_ID}@test.internal`;
const TEST_PASSWORD = "TradePass123!";

let testUserId: number;
let authToken: string;
let createdTradeId: number;

// Minimal valid trade payload
const TRADE_PAYLOAD = {
  symbol: "EURUSD",
  type: "long",
  entryPrice: 1.1000,
  exitPrice: 1.1050,
  positionSize: 0.1,
  stopLoss: 1.0950,
  takeProfit: 1.1100,
  openTime: new Date("2024-03-01T09:00:00Z").toISOString(),
  closeTime: new Date("2024-03-01T14:00:00Z").toISOString(),
};

describe("Trade CRUD API", () => {
  beforeAll(async () => {
    // Insert test user directly with a bcrypt hash (low rounds for speed)
    const [user] = await db
      .insert(usersTable)
      .values({
        email: TEST_EMAIL,
        name: "Trade Test User",
        passwordHash: await bcrypt.hash(TEST_PASSWORD, 4),
      })
      .returning();
    testUserId = user!.id;

    // Log in to get a bearer token
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    authToken = res.body.token as string;
  });

  afterAll(async () => {
    // Delete any trades that leaked (safety net — most are deleted per-test)
    await db.delete(tradesTable).where(eq(tradesTable.userId, testUserId));
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, testUserId));
    await db.delete(usersTable).where(eq(usersTable.id, testUserId));
  });

  // ── Auth guard ──────────────────────────────────────────────────────────────

  it("GET /api/trades returns 401 without a token", async () => {
    const res = await request(app).get("/api/trades");
    expect(res.status).toBe(401);
  });

  it("POST /api/trades returns 401 without a token", async () => {
    const res = await request(app).post("/api/trades").send(TRADE_PAYLOAD);
    expect(res.status).toBe(401);
  });

  it("DELETE /api/trades/:id returns 401 without a token", async () => {
    const res = await request(app).delete("/api/trades/999");
    expect(res.status).toBe(401);
  });

  // ── Create ──────────────────────────────────────────────────────────────────

  it("POST /api/trades creates a trade and returns it with computed fields", async () => {
    const res = await request(app)
      .post("/api/trades")
      .set("Authorization", `Bearer ${authToken}`)
      .send(TRADE_PAYLOAD);

    expect(res.status).toBe(201);

    const trade = res.body;
    expect(trade.id).toBeDefined();
    expect(trade.symbol).toBe("EURUSD");
    expect(trade.type).toBe("long");
    expect(trade.entryPrice).toBe(1.1);
    expect(trade.exitPrice).toBe(1.105);
    // P&L should be auto-computed (positive for a winning long)
    expect(typeof trade.pnl).toBe("number");
    expect(trade.pnl).toBeGreaterThan(0);
    // Outcome should be derived from P&L
    expect(trade.outcome).toBe("win");
    // userId must match the authenticated user
    expect(trade.userId).toBe(testUserId);

    createdTradeId = trade.id as number;
  });

  // ── List ────────────────────────────────────────────────────────────────────

  it("GET /api/trades returns a list that includes the created trade", async () => {
    const res = await request(app)
      .get("/api/trades")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.trades)).toBe(true);
    expect(typeof res.body.total).toBe("number");

    const found = (res.body.trades as { id: number }[]).find(
      (t) => t.id === createdTradeId
    );
    expect(found).toBeDefined();
  });

  it("GET /api/trades/:id returns the specific trade", async () => {
    const res = await request(app)
      .get(`/api/trades/${createdTradeId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdTradeId);
    expect(res.body.symbol).toBe("EURUSD");
  });

  it("GET /api/trades/:id returns 404 for a non-existent trade", async () => {
    const res = await request(app)
      .get("/api/trades/999999999")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(404);
  });

  it("GET /api/trades does not expose another user's trades", async () => {
    // The test user should only see their own trades — spot-check by
    // verifying every returned trade belongs to testUserId
    const res = await request(app)
      .get("/api/trades")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const trades = res.body.trades as { userId: number }[];
    expect(trades.every((t) => t.userId === testUserId)).toBe(true);
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  it("POST /api/trades returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/trades")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ symbol: "EURUSD" }); // missing type, entryPrice, positionSize, openTime

    expect(res.status).toBe(400);
  });

  // ── Delete ──────────────────────────────────────────────────────────────────

  it("DELETE /api/trades/:id removes the trade", async () => {
    const deleteRes = await request(app)
      .delete(`/api/trades/${createdTradeId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(deleteRes.status).toBe(204);

    // Verify it no longer exists in the DB
    const [row] = await db
      .select({ id: tradesTable.id })
      .from(tradesTable)
      .where(
        and(
          eq(tradesTable.id, createdTradeId),
          eq(tradesTable.userId, testUserId)
        )
      );
    expect(row).toBeUndefined();
  });

  it("DELETE /api/trades/:id returns 404 for an already-deleted trade", async () => {
    const res = await request(app)
      .delete(`/api/trades/${createdTradeId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(404);
  });
});
