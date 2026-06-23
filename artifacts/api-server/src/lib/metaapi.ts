import { logger } from "./logger.js";

const PROVISIONING_BASE = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";
const CLIENT_BASE = "https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai";

function getApiKey(): string {
  const key = process.env["METAAPI_API_KEY"];
  if (!key) throw new Error("METAAPI_API_KEY is not set");
  return key;
}

function authHeaders(): Record<string, string> {
  return {
    "auth-token": getApiKey(),
    "Content-Type": "application/json",
  };
}

function randomTransactionId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 32; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export interface MetaApiAccountInfo {
  _id: string;
  login: string;
  name: string;
  server: string;
  connectionStatus: "CONNECTED" | "DISCONNECTED" | "CONNECTING" | string;
  state: "CREATED" | "DEPLOYING" | "DEPLOYED" | "UNDEPLOYING" | "UNDEPLOYED" | "DELETING" | string;
  platform?: string;
  type?: string;
}

export interface MetaApiDeal {
  id: string;
  positionId: string;
  time: string;
  brokerTime?: string;
  type: string;
  entryType?: string;
  symbol?: string;
  volume?: number;
  price?: number;
  commission?: number;
  fee?: number;
  swap?: number;
  profit?: number;
  comment?: string;
}

export async function createMetaApiAccount(
  login: string,
  password: string,
  serverName: string,
  platform: "mt4" | "mt5"
): Promise<MetaApiAccountInfo> {
  const transactionId = randomTransactionId();
  const res = await fetch(`${PROVISIONING_BASE}/users/current/accounts`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "transaction-id": transactionId,
    },
    body: JSON.stringify({
      login,
      password,
      name: `ChartLogs-${login}`,
      server: serverName,
      platform,
      magic: 0,
      type: "cloud-g2",
      manualTrades: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    logger.warn({ status: res.status, body }, "MetaApi createAccount failed");
    throw new Error(`MetaApi registration failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<MetaApiAccountInfo>;
}

export async function getMetaApiAccount(accountId: string): Promise<MetaApiAccountInfo> {
  const res = await fetch(`${PROVISIONING_BASE}/users/current/accounts/${accountId}`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    const body = await res.text();
    logger.warn({ accountId, status: res.status, body }, "MetaApi getAccount failed");
    throw new Error(`MetaApi getAccount failed (${res.status})`);
  }

  return res.json() as Promise<MetaApiAccountInfo>;
}

export async function deleteMetaApiAccount(accountId: string): Promise<void> {
  const res = await fetch(`${PROVISIONING_BASE}/users/current/accounts/${accountId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  if (!res.ok && res.status !== 404) {
    const body = await res.text();
    logger.warn({ accountId, status: res.status, body }, "MetaApi deleteAccount failed");
    throw new Error(`MetaApi deleteAccount failed (${res.status})`);
  }
}

export async function getDeals(
  accountId: string,
  startTime: Date,
  endTime: Date
): Promise<MetaApiDeal[]> {
  const start = startTime.toISOString();
  const end = endTime.toISOString();

  const res = await fetch(
    `${CLIENT_BASE}/users/current/accounts/${accountId}/history-deals/time/${encodeURIComponent(start)}/${encodeURIComponent(end)}`,
    { headers: authHeaders() }
  );

  if (!res.ok) {
    const body = await res.text();
    logger.warn({ accountId, status: res.status, body }, "MetaApi getDeals failed");
    throw new Error(`MetaApi getDeals failed (${res.status})`);
  }

  const data = await res.json() as { deals?: MetaApiDeal[] } | MetaApiDeal[];
  if (Array.isArray(data)) return data;
  return (data as { deals?: MetaApiDeal[] }).deals ?? [];
}
