import { pgTable, text, serial, timestamp, numeric, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { tradingAccountsTable } from "./trading_accounts";

export const tradeTypeEnum = pgEnum("trade_type", ["long", "short"]);
export const tradeSourceEnum = pgEnum("trade_source", ["manual", "mt4", "mt5", "csv"]);
export const tradeOutcomeEnum = pgEnum("trade_outcome", ["win", "loss", "breakeven"]);

export const tradesTable = pgTable("trades", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  accountId: integer("account_id").references(() => tradingAccountsTable.id, { onDelete: "set null" }),
  symbol: text("symbol").notNull(),
  type: tradeTypeEnum("type").notNull(),
  entryPrice: numeric("entry_price", { precision: 20, scale: 8 }).notNull(),
  exitPrice: numeric("exit_price", { precision: 20, scale: 8 }),
  positionSize: numeric("position_size", { precision: 20, scale: 8 }).notNull(),
  stopLoss: numeric("stop_loss", { precision: 20, scale: 8 }),
  takeProfit: numeric("take_profit", { precision: 20, scale: 8 }),
  openTime: timestamp("open_time", { withTimezone: true }).notNull(),
  closeTime: timestamp("close_time", { withTimezone: true }),
  pnl: numeric("pnl", { precision: 20, scale: 4 }),
  pips: numeric("pips", { precision: 20, scale: 4 }),
  rrRatio: numeric("rr_ratio", { precision: 10, scale: 4 }),
  fees: numeric("fees", { precision: 20, scale: 4 }),
  source: tradeSourceEnum("source").notNull().default("manual"),
  tags: text("tags").array().notNull().default([]),
  emotion: text("emotion"),
  notes: text("notes"),
  screenshots: text("screenshots").array().notNull().default([]),
  outcome: tradeOutcomeEnum("outcome"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTradeSchema = createInsertSchema(tradesTable).omit({ id: true, createdAt: true, updatedAt: true, pnl: true, pips: true, rrRatio: true, outcome: true });
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof tradesTable.$inferSelect;
