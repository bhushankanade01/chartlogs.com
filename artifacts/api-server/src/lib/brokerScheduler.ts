import { eq, or } from "drizzle-orm";
import { db, brokerConnectionsTable } from "@workspace/db";
import { syncBrokerTrades, checkAndUpdateConnectionStatus } from "./metaapi-sync.js";
import { logger } from "./logger.js";

const THREE_MINUTES = 3 * 60 * 1000;

async function runBrokerSyncForAllConnections(): Promise<void> {
  const connections = await db
    .select()
    .from(brokerConnectionsTable)
    .where(or(
      eq(brokerConnectionsTable.status, "connected"),
      eq(brokerConnectionsTable.status, "pending")
    ));

  if (!connections.length) return;

  logger.info({ count: connections.length }, "Broker sync: processing connections");

  const results = await Promise.allSettled(
    connections.map(async (conn) => {
      if (conn.status === "pending") {
        const newStatus = await checkAndUpdateConnectionStatus(conn);
        if (newStatus === "connected") {
          const updated = { ...conn, status: "connected" as const };
          await syncBrokerTrades(updated);
        }
      } else {
        await syncBrokerTrades(conn);
      }
    })
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
