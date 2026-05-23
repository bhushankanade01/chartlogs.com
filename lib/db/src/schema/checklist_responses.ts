import { pgTable, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { tradesTable } from "./trades";
import { checklistTemplatesTable } from "./checklist_templates";

export const checklistResponsesTable = pgTable("checklist_responses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tradeId: integer("trade_id").notNull().references(() => tradesTable.id, { onDelete: "cascade" }),
  templateId: integer("template_id").notNull().references(() => checklistTemplatesTable.id, { onDelete: "cascade" }),
  answers: jsonb("answers").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ChecklistResponse = typeof checklistResponsesTable.$inferSelect;
