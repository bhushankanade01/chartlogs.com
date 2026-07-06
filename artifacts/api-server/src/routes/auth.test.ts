import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import app from "../app.js";
import { db, usersTable, passwordResetTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// Unique per test run to avoid cross-run conflicts
const TEST_EMAIL = `test-reset-${Date.now()}@test.internal`;
const TEST_PASSWORD = "TestPass123!";
let testUserId: number;

describe("Password reset flow", () => {
  beforeAll(async () => {
    const [user] = await db
      .insert(usersTable)
      .values({
        email: TEST_EMAIL,
        name: "Test Reset User",
        // Use low rounds (4) for speed in tests
        passwordHash: await bcrypt.hash(TEST_PASSWORD, 4),
      })
      .returning();
    testUserId = user!.id;
  });

  afterAll(async () => {
    // Clean up the test user (cascades to reset tokens and sessions)
    await db.delete(usersTable).where(eq(usersTable.id, testUserId));
  });

  afterEach(async () => {
    // Remove any reset tokens created during each test
    await db
      .delete(passwordResetTokensTable)
      .where(eq(passwordResetTokensTable.userId, testUserId));
  });

  it("forgot-password with an unknown email returns 200 (no enumeration)", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nobody@unknown.internal" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it("forgot-password with a known email returns 200", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: TEST_EMAIL });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it("valid reset token changes password and allows login with the new password", async () => {
    const newPassword = "NewPass456!";
    const token = crypto.randomBytes(32).toString("hex");

    await db.insert(passwordResetTokensTable).values({
      userId: testUserId,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const resetRes = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: newPassword });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body).toEqual({ success: true });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: newPassword });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();

    // Restore original password so subsequent tests have a clean slate
    await db
      .update(usersTable)
      .set({ passwordHash: await bcrypt.hash(TEST_PASSWORD, 4) })
      .where(eq(usersTable.id, testUserId));
  });

  it("expired token returns 400", async () => {
    const token = crypto.randomBytes(32).toString("hex");

    await db.insert(passwordResetTokensTable).values({
      userId: testUserId,
      token,
      // 1 second in the past
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "AnyPass789!" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expired/i);
  });

  it("already-used token returns 400", async () => {
    const token = crypto.randomBytes(32).toString("hex");

    await db.insert(passwordResetTokensTable).values({
      userId: testUserId,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      used: true,
    });

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "AnyPass789!" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid|expired/i);
  });
});
