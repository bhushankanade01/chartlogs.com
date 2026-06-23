import { eq, and, sql, like } from "drizzle-orm";
import { db, tradesTable, brokerConnectionsTable } from "@workspace/db";
import type { BrokerConnection } from "@workspace/db";
import { getDeals, getMetaApiAccount } from "./metaapi.js";
import { calculatePnl, calculatePips, determineOutcome } from "./trade-calculations.js";
import { logger } from "./logger.js";

function detectSession(openTime: Date): "London" | "NewYork" | "Asian" | "Sydney" | "OffHours" {
  const hour = openTime.getUTCHours();
  if (hour >= 7 && hour < 12) return "London";
  if (hour >= 12 && hour < 21) return "NewYork";
  if (hour >= 0 && hour < 7) return "Asian";
  return "Sydney";
}

function brokerNoteKey(metaapiAccountId: string, positionId: string): string {
  return `metaapi:${metaapiAccountId}:${positionId}`;
}

interface CompleteTrade {
  positionId: string;
  symbol: string;
  type: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  positionSize: number;
  openTime: Date;
  closeTime: Date;
  pnl: number;
  fees: number;
}

function dealsToTrades(deals: ReturnType<typeof Array.prototype.filter>): CompleteTrade[] {
  type RawDeal = {
    positionId: string;
    time: string;
    type: string;
    entryType?: string;
    symbol?: string;
    volume?: number;
    price?: number;
    commission?: number;
    fee?: number;
    swap?: number;
    profit?: number;
  };

  const inDeals = new Map<string, RawDeal>();
  const results: CompleteTrade[] = [];

  for (const deal of deals as RawDeal[]) {
    const entryType = deal.entryType ?? "";
    const dealType = deal.type ?? "";

    const isIn = entryType === "DEAL_ENTRY_IN" || entryType === "DEAL_ENTRY_INOUT";
    const isOut = entryType === "DEAL_ENTRY_OUT" || entryType === "DEAL_ENTRY_OUT_BY" || entryType === "DEAL_ENTRY_INOUT";

    if (!dealType.includes("BUY") && !dealType.includes("SELL")) continue;
    if (!deal.symbol || !deal.price || !deal.volume) continue;
    if (!deal.positionId) continue;

    if (isIn && !isOut) {
      inDeals.set(deal.positionId, deal);
      continue;
    }

    if (isOut) {
      const inDeal = inDeals.get(deal.positionId);

      const tradeType = inDeal
        ? (inDeal.type.includes("BUY") ? "long" : "short")
        : (dealType.includes("BUY") ? "long" : "short");

      const entryPrice = inDeal?.price ?? deal.price;
      const exitPrice = deal.price;
      const openTime = new Date(inDeal?.time ?? deal.time);
      const closeTime = new Date(deal.time);
      const volume = deal.volume;

      const outFees = Math.abs(deal.commission ?? 0) + Math.abs(deal.fee ?? 0) + Math.abs(deal.swap ?? 0);
      const inFees = inDeal
        ? Math.abs(inDeal.commission ?? 0) + Math.abs(inDeal.fee ?? 0) + Math.abs(inDeal.swap ?? 0)
        : 0;
      const totalFees = outFees + inFees;

      const rawPnl = deal.profit ?? 0;
      const commAdjust = (deal.commission ?? 0) + (deal.fee ?? 0) + (deal.swap ?? 0)
        + (inDeal?.commission ?? 0) + (inDeal?.fee ?? 0) + (inDeal?.swap ?? 0);
      const pnl = rawPnl + commAdjust;

      const symbol = (deal.symbol ?? "").toUpperCase().replace(/[^A-Z0-9.]/g, "");

      results.push({
        positionId: deal.positionId,
        symbol,
        type: tradeType,
        entryPrice,
        exitPrice,
        positionSize: volume,
        openTime,
        closeTime,
        pnl,
        fees: totalFees,
      });

      if (inDeal) inDeals.delete(deal.positionId);
    }
  }

  return results;
}

export async function syncBrokerTrades(connection: BrokerConnection): Promise<void> {
  const { id: connectionId, userId, metaapiAccountId, lastSyncAt, brokerType } = connection;

  if (!metaapiAccountId) {
    logger.warn({ connectionId }, "Broker sync skipped: no metaapiAccountId");
    return;
  }

  const endTime = new Date();
  const startTime = lastSyncAt
    ? new Date(lastSyncAt.getTime() - 60 * 1000)
    : new Date(endTime.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);

  let deals;
  try {
    deals = await getDeals(metaapiAccountId, startTime, endTime);
  } catch (err) {
    logger.error({ err, connectionId, metaapiAccountId }, "MetaApi getDeals error during sync");
    await db.update(brokerConnectionsTable)
      .set({ status: "error", errorMessage: (err as Error).message, updatedAt: new Date() })
      .where(eq(brokerConnectionsTable.id, connectionId));
    return;
  }

  if (!deals.length) {
    await db.update(brokerConnectionsTable)
      .set({ lastSyncAt: endTime, updatedAt: new Date() })
      .where(eq(brokerConnectionsTable.id, connectionId));
    return;
  }

  const completeTrades = dealsToTrades(deals);

  if (!completeTrades.length) {
    await db.update(brokerConnectionsTable)
      .set({ lastSyncAt: endTime, updatedAt: new Date() })
      .where(eq(brokerConnectionsTable.id, connectionId));
    return;
  }

  const accountPrefix = `metaapi:${metaapiAccountId}:`;

  const existingRows = await db
    .select({ notes: tradesTable.notes })
    .from(tradesTable)
    .where(and(
      eq(tradesTable.userId, userId),
      like(tradesTable.notes, `${accountPrefix}%`)
    ));

  const existingPositionIds = new Set(
    existingRows
      .map((r) => r.notes?.slice(accountPrefix.length) ?? "")
      .filter(Boolean)
  );

  let imported = 0;
  let skipped = 0;

  for (const trade of completeTrades) {
    if (existingPositionIds.has(trade.positionId)) {
      skipped++;
      continue;
    }

    const pips = calculatePips(trade.type, trade.entryPrice, trade.exitPrice, trade.symbol);
    const outcome = determineOutcome(trade.pnl);
    const session = detectSession(trade.openTime);

    await db.insert(tradesTable).values({
      userId,
      symbol: trade.symbol,
      type: trade.type,
      entryPrice: String(trade.entryPrice),
      exitPrice: String(trade.exitPrice),
      positionSize: String(trade.positionSize),
      openTime: trade.openTime,
      closeTime: trade.closeTime,
      pnl: String(trade.pnl),
      pips: pips !== null ? String(pips) : null,
      fees: trade.fees > 0 ? String(trade.fees) : null,
      source: brokerType,
      outcome,
      session,
      tags: [],
      screenshots: [],
      notes: brokerNoteKey(metaapiAccountId, trade.positionId),
    });

    existingPositionIds.add(trade.positionId);
    imported++;
  }

  logger.info({ connectionId, imported, skipped }, "Broker sync completed");

  await db.update(brokerConnectionsTable)
    .set({ lastSyncAt: endTime, status: "connected", errorMessage: null, updatedAt: new Date() })
    .where(eq(brokerConnectionsTable.id, connectionId));
}

export async function checkAndUpdateConnectionStatus(connection: BrokerConnection): Promise<string> {
  if (!connection.metaapiAccountId) return "pending";

  try {
    const info = await getMetaApiAccount(connection.metaapiAccountId);
    const isConnected = info.connectionStatus === "CONNECTED";
    const newStatus = isConnected ? "connected" : info.connectionStatus === "CONNECTING" ? "pending" : "error";

    if (newStatus !== connection.status) {
      await db.update(brokerConnectionsTable)
        .set({
          status: newStatus as "pending" | "connected" | "error",
          errorMessage: isConnected ? null : `Broker status: ${info.connectionStatus}`,
          updatedAt: new Date(),
        })
        .where(eq(brokerConnectionsTable.id, connection.id));
    }

    return newStatus;
  } catch (err) {
    logger.warn({ err, connectionId: connection.id }, "Failed to check MetaApi status");
    return connection.status;
  }
}
