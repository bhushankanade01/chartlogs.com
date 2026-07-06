import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../app.js";
import {
  db,
  usersTable,
  sessionsTable,
  tradesTable,
  journalEntriesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

const RUN_ID = Date.now();
const USER_A_EMAIL = `test-journal-a-${RUN_ID}@test.internal`;
const USER_B_EMAIL = `test-journal-b-${RUN_ID}@test.internal`;
const PASSWORD = "JournalPass123!";

let userAId: number;
let userBId: number;
let tokenA: string;
let tokenB: string;
let tradeAId: number;  // trade owned by user A
let tradeBId: number;  // trade owned by user B

// Minimal valid trade payload (open-only — no exit/PnL needed for journal tests)
const tradeSeed = (label: string) => ({
  symbol: `EURUSD`,
  type: "long",
  entryPrice: 1.1000,
  positionSize: 0.1,
  openTime: new Date(`2024-0${label === "a" ? 1 : 2}-01T09:00:00Z`).toISOString(),
});

async function createUserAndLogin(email: string) {
  const [user] = await db
    .insert(usersTable)
    .values({
      email,
      name: `Journal Test ${email}`,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
    })
    .returning();
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: PASSWORD });
  return { userId: user!.id, token: res.body.token as string };
}

describe("Journal entry API", () => {
  beforeAll(async () => {
    // Create two independent users
    const a = await createUserAndLogin(USER_A_EMAIL);
    const b = await createUserAndLogin(USER_B_EMAIL);
    userAId = a.userId;
    userBId = b.userId;
    tokenA = a.token;
    tokenB = b.token;

    // Each user needs a trade to attach journal entries to
    const resA = await request(app)
      .post("/api/trades")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(tradeSeed("a"));
    tradeAId = (resA.body as { id: number }).id;

    const resB = await request(app)
      .post("/api/trades")
      .set("Authorization", `Bearer ${tokenB}`)
      .send(tradeSeed("b"));
    tradeBId = (resB.body as { id: number }).id;
  });

  afterAll(async () => {
    // Clean up in dependency order: journal → trades → sessions → users
    await db.delete(journalEntriesTable).where(eq(journalEntriesTable.userId, userAId));
    await db.delete(journalEntriesTable).where(eq(journalEntriesTable.userId, userBId));
    await db.delete(tradesTable).where(eq(tradesTable.userId, userAId));
    await db.delete(tradesTable).where(eq(tradesTable.userId, userBId));
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, userAId));
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, userBId));
    await db.delete(usersTable).where(eq(usersTable.id, userAId));
    await db.delete(usersTable).where(eq(usersTable.id, userBId));
  });

  // ── Auth guards ─────────────────────────────────────────────────────────────

  it("GET /api/journal returns 401 without a token", async () => {
    const res = await request(app).get("/api/journal");
    expect(res.status).toBe(401);
  });

  it("GET /api/journal/:tradeId returns 401 without a token", async () => {
    const res = await request(app).get(`/api/journal/${tradeAId}`);
    expect(res.status).toBe(401);
  });

  it("PUT /api/journal/:tradeId returns 401 without a token", async () => {
    const res = await request(app)
      .put(`/api/journal/${tradeAId}`)
      .send({ notes: "No auth" });
    expect(res.status).toBe(401);
  });

  // ── Create (upsert) ─────────────────────────────────────────────────────────

  it("GET /api/journal/:tradeId returns 404 when no entry exists yet", async () => {
    const res = await request(app)
      .get(`/api/journal/${tradeAId}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(404);
  });

  it("PUT /api/journal/:tradeId creates a journal entry and returns it", async () => {
    const res = await request(app)
      .put(`/api/journal/${tradeAId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ notes: "Held through volatility — good discipline.", mood: "confident" });

    expect(res.status).toBe(200);
    expect(res.body.tradeId).toBe(tradeAId);
    expect(res.body.userId).toBe(userAId);
    expect(res.body.notes).toBe("Held through volatility — good discipline.");
    expect(res.body.mood).toBe("confident");
    expect(res.body.trade).toBeDefined();
  });

  // ── Read ────────────────────────────────────────────────────────────────────

  it("GET /api/journal/:tradeId returns the entry after creation", async () => {
    const res = await request(app)
      .get(`/api/journal/${tradeAId}`)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.tradeId).toBe(tradeAId);
    expect(res.body.notes).toBe("Held through volatility — good discipline.");
    expect(res.body.mood).toBe("confident");
  });

  it("GET /api/journal list includes the created entry", async () => {
    const res = await request(app)
      .get("/api/journal?status=journaled")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = (res.body as { tradeId: number }[]).find(
      (e) => e.tradeId === tradeAId
    );
    expect(found).toBeDefined();
  });

  // ── Update (upsert) ─────────────────────────────────────────────────────────

  it("PUT /api/journal/:tradeId updates notes and mood on an existing entry", async () => {
    const res = await request(app)
      .put(`/api/journal/${tradeAId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ notes: "Updated reflection: should have exited earlier.", mood: "frustrated" });

    expect(res.status).toBe(200);
    expect(res.body.notes).toBe("Updated reflection: should have exited earlier.");
    expect(res.body.mood).toBe("frustrated");
  });

  it("GET /api/journal/:tradeId reflects the updated notes", async () => {
    const res = await request(app)
      .get(`/api/journal/${tradeAId}`)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.notes).toBe("Updated reflection: should have exited earlier.");
    expect(res.body.mood).toBe("frustrated");
  });

  it("only one journal entry exists per trade (upsert, not duplicate)", async () => {
    const rows = await db
      .select({ id: journalEntriesTable.id })
      .from(journalEntriesTable)
      .where(
        and(
          eq(journalEntriesTable.tradeId, tradeAId),
          eq(journalEntriesTable.userId, userAId)
        )
      );
    expect(rows.length).toBe(1);
  });

  // ── Cross-user isolation ────────────────────────────────────────────────────

  it("GET /api/journal/:tradeId returns 404 when the trade belongs to another user", async () => {
    // user B tries to read user A's journal entry
    const res = await request(app)
      .get(`/api/journal/${tradeAId}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it("PUT /api/journal/:tradeId returns 404 when the trade belongs to another user", async () => {
    // user B tries to write a journal entry on user A's trade
    const res = await request(app)
      .put(`/api/journal/${tradeAId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ notes: "Injected by user B" });
    expect(res.status).toBe(404);
  });

  it("GET /api/journal list does not expose another user's entries", async () => {
    // user B's list should have no entries for user A's trade
    const res = await request(app)
      .get("/api/journal?status=journaled")
      .set("Authorization", `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    const tradeIds = (res.body as { tradeId: number }[]).map((e) => e.tradeId);
    expect(tradeIds).not.toContain(tradeAId);
  });
});
