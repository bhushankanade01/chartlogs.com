/**
 * One-time migration: update demo@chartlogs.com password hash to bcrypt.
 * Run with: pnpm --filter @workspace/scripts run update-demo-password
 *
 * Safe to re-run — it is idempotent (updates the row regardless of current hash).
 */
import bcryptjs from "bcryptjs";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });

const hash = await bcryptjs.hash("demo1234", 12);

const result = await pool.query(
  `UPDATE users SET password_hash = $1 WHERE email = 'demo@chartlogs.com' RETURNING id, email`,
  [hash]
);

if (result.rowCount === 0) {
  console.log("demo@chartlogs.com not found — nothing updated.");
} else {
  console.log(`Updated bcrypt hash for ${result.rows[0].email} (id=${result.rows[0].id})`);
}

await pool.end();
process.exit(0);
