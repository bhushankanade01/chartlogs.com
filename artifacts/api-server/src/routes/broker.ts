import { Router, type IRouter } from "express";
import { db, brokerConnectionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { createMetaApiAccount, deleteMetaApiAccount, getMetaApiAccount } from "../lib/metaapi.js";
import { syncBrokerTrades, checkAndUpdateConnectionStatus } from "../lib/metaapi-sync.js";
import { logger } from "../lib/logger.js";

interface ConnectBrokerBody {
  accountNumber: string;
  serverName: string;
  investorPassword: string;
  brokerType: "mt4" | "mt5";
}

function validateConnectBody(body: unknown): ConnectBrokerBody | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b["accountNumber"] !== "string" || !b["accountNumber"].trim()) return null;
  if (typeof b["serverName"] !== "string" || !b["serverName"].trim()) return null;
  if (typeof b["investorPassword"] !== "string" || !b["investorPassword"].trim()) return null;
  if (b["brokerType"] !== "mt4" && b["brokerType"] !== "mt5") return null;
  return {
    accountNumber: b["accountNumber"].trim(),
    serverName: b["serverName"].trim(),
    investorPassword: b["investorPassword"].trim(),
    brokerType: b["brokerType"] as "mt4" | "mt5",
  };
}

const router: IRouter = Router();

function formatConnection(c: typeof brokerConnectionsTable.$inferSelect, metaapiState?: string) {
  return {
    id: c.id,
    brokerType: c.brokerType,
    accountNumber: c.accountNumber,
    serverName: c.serverName,
    status: c.status,
    metaapiState: metaapiState ?? null,
    lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
    errorMessage: c.errorMessage ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

router.post("/broker/connect", requireAuth, async (req, res): Promise<void> => {
  const parsed = validateConnectBody(req.body);
  if (!parsed) {
    res.status(400).json({ error: "accountNumber, serverName, investorPassword and brokerType (mt4|mt5) are required" });
    return;
  }

  const userId = req.user!.id;
  const { accountNumber, serverName, investorPassword, brokerType } = parsed;

  const existing = await db.select({ id: brokerConnectionsTable.id })
    .from(brokerConnectionsTable)
    .where(eq(brokerConnectionsTable.userId, userId));

  if (existing.length > 0) {
    res.status(409).json({ error: "You already have a broker connection. Disconnect it first." });
    return;
  }

  let metaapiAccountId: string | undefined;
  try {
    const acct = await createMetaApiAccount(accountNumber, investorPassword, serverName, brokerType);
    metaapiAccountId = acct._id;
  } catch (err) {
    logger.warn({ err, userId }, "MetaApi account creation failed");
    res.status(502).json({ error: `Failed to connect to MetaApi: ${(err as Error).message}` });
    return;
  }

  const [conn] = await db.insert(brokerConnectionsTable).values({
    userId,
    brokerType,
    accountNumber,
    serverName,
    metaapiAccountId,
    status: "pending",
  }).returning();

  res.status(201).json(formatConnection(conn));
});

router.get("/broker/status", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;

  const connections = await db.select()
    .from(brokerConnectionsTable)
    .where(eq(brokerConnectionsTable.userId, userId));

  if (!connections.length) {
    res.json({ connection: null });
    return;
  }

  const conn = connections[0]!;
  let liveStatus = conn.status;
  let metaapiState: string | undefined;

  if (conn.metaapiAccountId && (conn.status === "pending" || conn.status === "connected")) {
    try {
      const info = await getMetaApiAccount(conn.metaapiAccountId);
      metaapiState = info.state;
      const isConnected = info.connectionStatus === "CONNECTED";
      liveStatus = isConnected ? "connected" : info.connectionStatus === "CONNECTING" ? "pending" : "error";

      if (liveStatus !== conn.status) {
        await db.update(brokerConnectionsTable)
          .set({
            status: liveStatus as "pending" | "connected" | "error",
            errorMessage: isConnected ? null : `Broker status: ${info.connectionStatus}`,
            updatedAt: new Date(),
          })
          .where(eq(brokerConnectionsTable.id, conn.id));

        if (liveStatus === "connected" && conn.status !== "connected") {
          syncBrokerTrades({ ...conn, status: "connected" }).catch((err) => {
            logger.error({ err, connectionId: conn.id }, "Initial broker sync failed");
          });
        }
      }
    } catch {
      // keep stored status on error
    }
  }

  res.json({
    connection: {
      ...formatConnection(conn, metaapiState),
      status: liveStatus,
    },
  });
});

router.post("/broker/sync", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;

  const [conn] = await db.select()
    .from(brokerConnectionsTable)
    .where(eq(brokerConnectionsTable.userId, userId));

  if (!conn) {
    res.status(404).json({ error: "No broker connection found" });
    return;
  }

  if (conn.status === "pending" || conn.status === "error") {
    // Re-check live MetaApi status — a prior error may have been transient
    const newStatus = await checkAndUpdateConnectionStatus(conn);
    if (newStatus === "pending") {
      res.status(409).json({ error: "Broker is not yet connected. Please wait for the connection to be established." });
      return;
    }
    await syncBrokerTrades({ ...conn, status: newStatus as "pending" | "connected" | "error" });
  } else if (conn.status === "connected") {
    await syncBrokerTrades(conn);
  } else {
    res.status(409).json({ error: "Broker is in an unknown state. Please disconnect and reconnect." });
    return;
  }

  res.json({ success: true });
});

router.delete("/broker/disconnect", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;

  const [conn] = await db.select()
    .from(brokerConnectionsTable)
    .where(eq(brokerConnectionsTable.userId, userId));

  if (!conn) {
    res.status(404).json({ error: "No broker connection found" });
    return;
  }

  if (conn.metaapiAccountId) {
    try {
      await deleteMetaApiAccount(conn.metaapiAccountId);
    } catch (err) {
      logger.warn({ err, connectionId: conn.id }, "MetaApi deleteAccount failed during disconnect");
    }
  }

  await db.delete(brokerConnectionsTable)
    .where(and(eq(brokerConnectionsTable.id, conn.id), eq(brokerConnectionsTable.userId, userId)));

  res.sendStatus(204);
});

export default router;
