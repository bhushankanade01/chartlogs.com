import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import app from "../app.js";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// Unique per test run so parallel/repeated runs don't collide
const RUN_ID = Date.now();
const LOGIN_EMAIL = `test-login-${RUN_ID}@test.internal`;
const LOGIN_PASSWORD = "LoginPass123!";
const LEGACY_EMAIL = `test-legacy-${RUN_ID}@test.internal`;
let loginUserId: number;
let legacyUserId: number;

describe("Register flow", () => {
  const registeredEmails: string[] = [];

  afterAll(async () => {
    // Delete any users created via the register endpoint
    for (const email of registeredEmails) {
      await db.delete(usersTable).where(eq(usersTable.email, email));
    }
  });

  it("valid registration returns 201 with a user object and bearer token", async () => {
    const email = `test-register-${RUN_ID}@test.internal`;
    registeredEmails.push(email);

    const res = await request(app).post("/api/auth/register").send({
      email,
      password: "ValidPass123!",
      name: "Test Registrant",
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(email);
  });

  it("duplicate email returns 409", async () => {
    const email = `test-dup-${RUN_ID}@test.internal`;
    registeredEmails.push(email);

    // First registration — should succeed
    await request(app).post("/api/auth/register").send({
      email,
      password: "ValidPass123!",
      name: "First User",
    });

    // Second registration with the same email — should fail
    const res = await request(app).post("/api/auth/register").send({
      email,
      password: "AnotherPass456!",
      name: "Duplicate User",
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });
});

describe("Login flow", () => {
  beforeAll(async () => {
    // Pre-create a user with a bcrypt hash for successful login tests
    const [user] = await db
      .insert(usersTable)
      .values({
        email: LOGIN_EMAIL,
        name: "Login Test User",
        passwordHash: await bcrypt.hash(LOGIN_PASSWORD, 4),
      })
      .returning();
    loginUserId = user!.id;

    // Pre-create a user with a legacy SHA-256 hash
    const sha256Hash = crypto
      .createHash("sha256")
      .update(LOGIN_PASSWORD)
      .digest("hex");
    const [legacyUser] = await db
      .insert(usersTable)
      .values({
        email: LEGACY_EMAIL,
        name: "Legacy Hash User",
        passwordHash: sha256Hash,
      })
      .returning();
    legacyUserId = legacyUser!.id;
  });

  afterAll(async () => {
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, loginUserId));
    await db.delete(usersTable).where(eq(usersTable.id, loginUserId));
    await db.delete(usersTable).where(eq(usersTable.id, legacyUserId));
  });

  it("correct password returns 200 with a bearer token", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(LOGIN_EMAIL);
  });

  it("wrong password returns 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: LOGIN_EMAIL, password: "WrongPass999!" });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid email or password/i);
  });

  it("legacy SHA-256 hash returns 401 with 'Password format outdated' message", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: LEGACY_EMAIL, password: LOGIN_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/password format outdated/i);
  });
});
