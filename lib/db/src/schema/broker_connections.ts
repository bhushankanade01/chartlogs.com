import { pgTable, text, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const brokerTypeEnum = pgEnum("broker_type", ["mt4", "mt5"]);
export const brokerConnectionStatusEnum = pgEnum("broker_connection_status", [
  "pending",
  "connected",
  "error",
  "disconnecting",
]);

export const brokerConnectionsTable = pgTable("broker_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  brokerType: brokerTypeEnum("broker_type").notNull(),
  accountNumber: text("account_number").notNull(),
  serverName: text("server_name").notNull(),
  metaapiAccountId: text("metaapi_account_id"),
  status: brokerConnectionStatusEnum("status").notNull().default("pending"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type BrokerConnection = typeof brokerConnectionsTable.$inferSelect;
