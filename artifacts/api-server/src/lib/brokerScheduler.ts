import { eq } from "drizzle-orm";
import { db, brokerConnectionsTable } from "@workspace/db";
import { syncBrokerTrades } from "./metaapi-sync.js";
import { logger } from "./logger.js";

const THREE_MINUTES = 3 * 60 * 1000;

async function runBrokerSyncForAllConnections(): Promise<void> {
  const connections = await db
    .select()
    .from(brokerConnectionsTable)
    .where(eq(brokerConnectionsTable.status, "connected"));

  if (!connections.length) return;

  logger.info({ count: connections.length }, "Broker sync: syncing connections");

  const results = await Promise.allSettled(
    connections.map((conn) => syncBrokerTrades(conn))
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    logger.warn({ failed, total: connections.length }, "Some broker syncs failed");
  }
}

export function startBrokerSyncScheduler(): void {
  logger.info({ intervalMs: THREE_MINUTES }, "Broker sync scheduler started");

  const tick = () => {
    runBrokerSyncForAllConnections().catch((err) => {
      logger.error({ err }, "Broker sync scheduler error");
    });
    setTimeout(tick, THREE_MINUTES);
  };

  setTimeout(tick, THREE_MINUTES);
}
