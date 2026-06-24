import { logger } from "./logger.js";

const PROVISIONING_BASE = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";

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

// Cache the client API domain (valid for 10 minutes).
// The provisioning API returns e.g. { domain: "agiliumtrade.ai" }.
let _clientApiDomainCache: { domain: string; expiresAt: number } | null = null;

async function getClientApiDomain(): Promise<string> {
  if (_clientApiDomainCache && Date.now() < _clientApiDomainCache.expiresAt) {
    return _clientApiDomainCache.domain;
  }
  try {
    const res = await fetch(
      `${PROVISIONING_BASE}/users/current/servers/mt-client-api`,
      { headers: authHeaders() }
    );
    if (res.ok) {
      const data = await res.json() as { domain?: string };
      const domain = data.domain ?? "agiliumtrade.ai";
      _clientApiDomainCache = { domain, expiresAt: Date.now() + 10 * 60 * 1000 };
      return domain;
    }
  } catch (err) {
    logger.warn({ err }, "Failed to fetch MetaApi client domain; using fallback");
  }
  return "agiliumtrade.ai";
}

export interface MetaApiAccountInfo {
  _id: string;
  login: string;
  name: string;
  server: string;
  region?: string;
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

  const data = await res.json() as Record<string, unknown>;
  // MetaApi POST /accounts returns { id: "uuid" } (no underscore).
  // GET /accounts/:id returns { _id: "uuid" }. Handle both so the
  // caller always gets a valid _id regardless of which format is returned.
  const accountId = (data["_id"] as string | undefined) || (data["id"] as string | undefined);
  if (!accountId) {
    logger.warn({ data }, "MetaApi createAccount: no account ID in response");
    throw new Error("MetaApi account creation returned no account ID");
  }

  if (data["_id"]) {
    return data as unknown as MetaApiAccountInfo;
  }
  // Response only had `id` — fetch the full account object
  return getMetaApiAccount(accountId);
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
  // Get the dynamic domain and account region.
  // The correct client API URL is https://mt-client-api-v1.{region}.{domain}
  // where domain comes from provisioning /users/current/servers/mt-client-api
  // and region comes from the account object.
  const [domain, account] = await Promise.all([
    getClientApiDomain(),
    getMetaApiAccount(accountId),
  ]);

  const region = account.region ?? "london";
  const clientBase = `https://mt-client-api-v1.${region}.${domain}`;

  const start = startTime.toISOString();
  const end = endTime.toISOString();

  const res = await fetch(
    `${clientBase}/users/current/accounts/${accountId}/history-deals/time/${encodeURIComponent(start)}/${encodeURIComponent(end)}`,
    { headers: authHeaders() }
  );

  if (!res.ok) {
    const body = await res.text();
    logger.warn({ accountId, region, domain, status: res.status, body }, "MetaApi getDeals failed");
    throw new Error(`MetaApi getDeals failed (${res.status})`);
  }

  const data = await res.json() as { deals?: MetaApiDeal[] } | MetaApiDeal[];
  if (Array.isArray(data)) return data;
  return (data as { deals?: MetaApiDeal[] }).deals ?? [];
}
