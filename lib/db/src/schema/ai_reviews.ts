import { pgTable, text, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { tradesTable } from "./trades";

export const aiReportTypeEnum = pgEnum("ai_report_type", ["trade_review", "weekly_report", "pattern_analysis"]);

export const aiReviewsTable = pgTable("ai_reviews", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tradeId: integer("trade_id").references(() => tradesTable.id, { onDelete: "set null" }),
  reportType: aiReportTypeEnum("report_type").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAiReviewSchema = createInsertSchema(aiReviewsTable).omit({ id: true, createdAt: true });
export type InsertAiReview = z.infer<typeof insertAiReviewSchema>;
export type AiReview = typeof aiReviewsTable.$inferSelect;
