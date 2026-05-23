import { pgTable, text, serial, timestamp, numeric, integer, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const accountPlatformEnum = pgEnum("account_platform", ["manual", "mt4", "mt5"]);

export const tradingAccountsTable = pgTable("trading_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  broker: text("broker"),
  platform: accountPlatformEnum("platform").notNull().default("manual"),
  startingBalance: numeric("starting_balance", { precision: 20, scale: 4 }).notNull().default("0"),
  currency: text("currency").notNull().default("USD"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTradingAccountSchema = createInsertSchema(tradingAccountsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTradingAccount = z.infer<typeof insertTradingAccountSchema>;
export type TradingAccount = typeof tradingAccountsTable.$inferSelect;
