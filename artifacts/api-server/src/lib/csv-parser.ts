export type CsvFormat = "mt4" | "mt5" | "csv" | "exness" | "unknown";

export interface ParsedTradeRow {
  symbol: string;
  type: "long" | "short";
  entryPrice: number;
  exitPrice: number | null;
  positionSize: number;
  openTime: string;
  closeTime: string | null;
  pnl: number | null;
  fees: number | null;
  warning?: string;
}

export interface GenericColumnMap {
  symbol: string;
  type: string;
  entryPrice: string;
  exitPrice?: string;
  positionSize?: string;
  openTime: string;
  closeTime?: string;
  pnl?: string;
  fees?: string;
}

export interface ParseResult {
  format: CsvFormat;
  rows: ParsedTradeRow[];
  rawHeaders: string[];
  rawRows: string[][];
  error?: string;
}

function parseCsvLine(line: string, delimiter = ","): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 5).join("\n");
  const commas = (sample.match(/,/g) || []).length;
  const semis = (sample.match(/;/g) || []).length;
  return semis > commas ? ";" : ",";
}

function parseDate(s: string): Date | null {
  if (!s || s === "0" || s.trim() === "") return null;
  const clean = s.trim();

  // MT4/MT5 format: "2024.01.15 09:30:05" or "2024.01.15 09:30"
  const mt4 = clean.match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (mt4) {
    const [, y, mo, d, h, mi, se] = mt4;
    const dt = new Date(`${y}-${mo}-${d}T${h}:${mi}:${se ?? "00"}Z`);
    if (!isNaN(dt.getTime())) return dt;
  }

  // ISO or other standard
  const dt = new Date(clean);
  if (!isNaN(dt.getTime())) return dt;
  return null;
}

function parseNum(s: string | undefined): number | null {
  if (!s || s.trim() === "") return null;
  const n = parseFloat(s.replace(/\s/g, "").replace(/,(?=\d{3})/g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}

function normalizeType(s: string): "long" | "short" | null {
  const lower = s.toLowerCase().trim();
  if (["buy", "long", "b", "l"].includes(lower)) return "long";
  if (["sell", "short", "s"].includes(lower)) return "short";
  return null;
}

// ─── MT4 ─────────────────────────────────────────────────────────────────────
// Headers: Ticket, Open Time, Type, Size, Item, Price, S / L, T / P,
//          Close Time, Price (close), Commission, Taxes, Swap, Profit
function detectMt4(headers: string[]): boolean {
  const h = headers.map((x) => x.toLowerCase().trim());
  return h.includes("ticket") && (h.includes("item") || h.includes("symbol")) && h.includes("open time");
}

function parseMt4(headers: string[], rows: string[][]): ParsedTradeRow[] {
  const h = headers.map((x) => x.toLowerCase().trim());

  const priceIndices = h.reduce<number[]>((acc, x, i) => {
    if (x === "price") acc.push(i);
    return acc;
  }, []);

  const idx = (name: string) => h.findIndex((x) => x === name);
  const iOpenTime = idx("open time");
  const iType = idx("type");
  const iSize = idx("size");
  const iItem = h.includes("item") ? idx("item") : idx("symbol");
  const iCloseTime = idx("close time");
  const iCommission = idx("commission");
  const iTaxes = idx("taxes");
  const iSwap = idx("swap");
  const iProfit = idx("profit");

  const results: ParsedTradeRow[] = [];

  for (const row of rows) {
    if (row.length < 4) continue;
    const rawType = row[iType] ?? "";
    const type = normalizeType(rawType);
    if (!type) continue; // balance, deposit, credit rows — definitively not trades

    const openTime = parseDate(row[iOpenTime] ?? "");
    const closeTime = iCloseTime >= 0 ? parseDate(row[iCloseTime] ?? "") : null;
    const entryPrice = priceIndices[0] !== undefined ? parseNum(row[priceIndices[0]]) : null;
    const exitPrice = priceIndices[1] !== undefined ? parseNum(row[priceIndices[1]]) : null;
    const positionSize = parseNum(row[iSize] ?? "");
    const rawSymbol = row[iItem] ?? "";
    const symbol = rawSymbol.toUpperCase().replace(/[^A-Z0-9.]/g, "");

    const warns: string[] = [];
    if (!openTime) warns.push("could not parse open time");
    if (!entryPrice) warns.push("missing entry price");
    if (!positionSize) warns.push("missing position size");
    if (!symbol) warns.push("missing symbol");

    if (warns.length > 0) {
      results.push({
        symbol: symbol || rawSymbol || "UNKNOWN",
        type,
        entryPrice: entryPrice ?? 0,
        exitPrice,
        positionSize: positionSize ?? 0,
        openTime: openTime?.toISOString() ?? new Date(0).toISOString(),
        closeTime: closeTime?.toISOString() ?? null,
        pnl: null,
        fees: null,
        warning: warns.join("; "),
      });
      continue;
    }

    const commission = iCommission >= 0 ? (parseNum(row[iCommission]) ?? 0) : 0;
    const taxes = iTaxes >= 0 ? (parseNum(row[iTaxes]) ?? 0) : 0;
    const swap = iSwap >= 0 ? (parseNum(row[iSwap]) ?? 0) : 0;
    const profit = iProfit >= 0 ? parseNum(row[iProfit]) : null;

    // In MT4, Profit already excludes commission/swap (they're listed separately).
    // Total P&L = Profit + Commission + Taxes + Swap
    const fees = Math.abs(commission) + Math.abs(taxes) + Math.abs(swap);
    const pnl = profit !== null ? profit + commission + taxes + swap : null;

    results.push({
      symbol,
      type,
      entryPrice: entryPrice!,
      exitPrice,
      positionSize: positionSize!,
      openTime: openTime!.toISOString(),
      closeTime: closeTime?.toISOString() ?? null,
      pnl,
      fees: fees > 0 ? fees : null,
    });
  }

  return results;
}

// ─── MT5 ─────────────────────────────────────────────────────────────────────
// Deals format: Deal, Order, Symbol, Type, Direction, Volume, Price,
//               Commission, Fee, Swap, Profit, Balance, Comment, Time
function detectMt5(headers: string[]): boolean {
  const h = headers.map((x) => x.toLowerCase().trim());
  if (h.includes("deal") && h.includes("direction")) return true;
  if (h.includes("position") && (h.includes("action") || h.includes("type"))) return true;
  return false;
}

interface Mt5Deal {
  order: string;
  symbol: string;
  type: "long" | "short";
  volume: number;
  price: number;
  commission: number;
  fee: number;
  swap: number;
  profit: number;
  time: Date;
}

function parseMt5(headers: string[], rows: string[][]): ParsedTradeRow[] {
  const h = headers.map((x) => x.toLowerCase().trim());
  const idx = (name: string) => h.findIndex((x) => x === name);
  const hasDirection = h.includes("direction");

  if (hasDirection) {
    // Deals format
    const iOrder = idx("order");
    const iSymbol = idx("symbol");
    const iType = idx("type");
    const iDirection = idx("direction");
    const iVolume = idx("volume");
    const iPrice = idx("price");
    const iCommission = idx("commission");
    const iFee = idx("fee");
    const iSwap = idx("swap");
    const iProfit = idx("profit");
    const iTime = idx("time");

    const inDeals = new Map<string, Mt5Deal>();
    const results: ParsedTradeRow[] = [];

    for (const row of rows) {
      const direction = (row[iDirection] ?? "").toLowerCase().trim();
      if (direction !== "in" && direction !== "out") continue;

      const type = normalizeType(row[iType] ?? "");
      const time = parseDate(row[iTime] ?? "");
      const order = row[iOrder] ?? "";
      const rawSymbol = row[iSymbol] ?? "";
      const symbol = rawSymbol.toUpperCase().replace(/[^A-Z0-9.]/g, "");

      const warns: string[] = [];
      if (!type) warns.push("unrecognized trade direction");
      if (!time) warns.push("could not parse time");
      if (!symbol) warns.push("missing symbol");

      if (warns.length > 0 && direction === "out") {
        const inDeal = inDeals.get(order);
        results.push({
          symbol: symbol || rawSymbol || "UNKNOWN",
          type: inDeal?.type ?? type ?? "long",
          entryPrice: inDeal?.price ?? 0,
          exitPrice: parseNum(row[iPrice]) ?? 0,
          positionSize: parseNum(row[iVolume]) ?? 0,
          openTime: inDeal?.time.toISOString() ?? new Date(0).toISOString(),
          closeTime: time?.toISOString() ?? null,
          pnl: null,
          fees: null,
          warning: warns.join("; "),
        });
        continue;
      }

      if (!type || !time || !symbol) continue;

      const volume = parseNum(row[iVolume]) ?? 0;
      const price = parseNum(row[iPrice]) ?? 0;
      const commission = iCommission >= 0 ? (parseNum(row[iCommission]) ?? 0) : 0;
      const fee = iFee >= 0 ? (parseNum(row[iFee]) ?? 0) : 0;
      const swap = iSwap >= 0 ? (parseNum(row[iSwap]) ?? 0) : 0;
      const profit = iProfit >= 0 ? (parseNum(row[iProfit]) ?? 0) : 0;

      const deal: Mt5Deal = { order, symbol, type, volume, price, commission, fee, swap, profit, time };

      if (direction === "in") {
        inDeals.set(order, deal);
      } else {
        const inDeal = inDeals.get(order);
        const totalFees =
          Math.abs(commission) +
          Math.abs(fee) +
          Math.abs(swap) +
          (inDeal ? Math.abs(inDeal.commission) + Math.abs(inDeal.fee) + Math.abs(inDeal.swap) : 0);

        results.push({
          symbol,
          type: inDeal?.type ?? type,
          entryPrice: inDeal?.price ?? price,
          exitPrice: price,
          positionSize: volume,
          openTime: (inDeal?.time ?? time).toISOString(),
          closeTime: time.toISOString(),
          pnl: profit + commission + fee + swap,
          fees: totalFees > 0 ? totalFees : null,
        });

        if (order) inDeals.delete(order);
      }
    }

    return results;
  } else {
    // Positions/History format — each row is a trade
    const iSymbol = h.findIndex((x) => x === "symbol");
    const iAction = h.findIndex((x) => x === "action" || x === "type");
    const iVolume = h.findIndex((x) => x === "volume");
    const iPrice = h.findIndex((x) => x === "price");
    const iProfit = h.findIndex((x) => x === "profit");
    const iTime = h.findIndex((x) => x === "time");

    const results: ParsedTradeRow[] = [];

    for (const row of rows) {
      const type = normalizeType(row[iAction] ?? "");
      const openTime = parseDate(row[iTime] ?? "");
      const rawSymbol = row[iSymbol] ?? "";
      const symbol = rawSymbol.toUpperCase().replace(/[^A-Z0-9.]/g, "");
      const entryPrice = parseNum(row[iPrice]);
      const volume = parseNum(row[iVolume]);

      const warns: string[] = [];
      if (!type) warns.push("unrecognized trade type");
      if (!openTime) warns.push("could not parse time");
      if (!symbol) warns.push("missing symbol");
      if (!entryPrice) warns.push("missing entry price");
      if (!volume) warns.push("missing volume");

      if (warns.length > 0) {
        results.push({
          symbol: symbol || rawSymbol || "UNKNOWN",
          type: type ?? "long",
          entryPrice: entryPrice ?? 0,
          exitPrice: null,
          positionSize: volume ?? 0,
          openTime: openTime?.toISOString() ?? new Date(0).toISOString(),
          closeTime: null,
          pnl: null,
          fees: null,
          warning: warns.join("; "),
        });
        continue;
      }

      results.push({
        symbol,
        type: type!,
        entryPrice: entryPrice!,
        exitPrice: null,
        positionSize: volume!,
        openTime: openTime!.toISOString(),
        closeTime: null,
        pnl: iProfit >= 0 ? parseNum(row[iProfit]) : null,
        fees: null,
      });
    }

    return results;
  }
}

// ─── Generic CSV ──────────────────────────────────────────────────────────────
export function parseGenericCsv(
  headers: string[],
  rows: string[][],
  columnMap: GenericColumnMap
): ParsedTradeRow[] {
  const idx = (name: string | undefined) =>
    name ? headers.findIndex((h) => h === name) : -1;

  const iSymbol = idx(columnMap.symbol);
  const iType = idx(columnMap.type);
  const iEntry = idx(columnMap.entryPrice);
  const iExit = idx(columnMap.exitPrice);
  const iSize = idx(columnMap.positionSize);
  const iOpenTime = idx(columnMap.openTime);
  const iCloseTime = idx(columnMap.closeTime);
  const iPnl = idx(columnMap.pnl);
  const iFees = idx(columnMap.fees);

  const results: ParsedTradeRow[] = [];

  for (const row of rows) {
    const rawSymbol = iSymbol >= 0 ? (row[iSymbol] ?? "") : "";
    const symbol = rawSymbol.toUpperCase().trim();
    const type = normalizeType(iType >= 0 ? (row[iType] ?? "") : "");
    const entryPrice = iEntry >= 0 ? parseNum(row[iEntry]) : null;
    const openTime = iOpenTime >= 0 ? parseDate(row[iOpenTime] ?? "") : null;

    const warns: string[] = [];
    if (!symbol) warns.push("missing symbol");
    if (!type) warns.push("unrecognized trade type");
    if (!entryPrice) warns.push("missing entry price");
    if (!openTime) warns.push("could not parse open time");

    if (warns.length > 0) {
      results.push({
        symbol: symbol || rawSymbol || "UNKNOWN",
        type: type ?? "long",
        entryPrice: entryPrice ?? 0,
        exitPrice: iExit >= 0 ? parseNum(row[iExit]) : null,
        positionSize: (iSize >= 0 ? parseNum(row[iSize]) : null) ?? 1,
        openTime: openTime?.toISOString() ?? new Date(0).toISOString(),
        closeTime: iCloseTime >= 0 ? (parseDate(row[iCloseTime] ?? "")?.toISOString() ?? null) : null,
        pnl: iPnl >= 0 ? parseNum(row[iPnl]) : null,
        fees: iFees >= 0 ? parseNum(row[iFees]) : null,
        warning: warns.join("; "),
      });
      continue;
    }

    results.push({
      symbol,
      type: type!,
      entryPrice: entryPrice!,
      exitPrice: iExit >= 0 ? parseNum(row[iExit]) : null,
      positionSize: (iSize >= 0 ? parseNum(row[iSize]) : null) ?? 1,
      openTime: openTime!.toISOString(),
      closeTime: iCloseTime >= 0 ? (parseDate(row[iCloseTime] ?? "")?.toISOString() ?? null) : null,
      pnl: iPnl >= 0 ? parseNum(row[iPnl]) : null,
      fees: iFees >= 0 ? parseNum(row[iFees]) : null,
    });
  }

  return results;
}

// ─── Exness ───────────────────────────────────────────────────────────────────
// Headers: ticket, opening_time_utc, closing_time_utc, type, lots,
//          original_position_size, symbol, opening_price, closing_price,
//          stop_loss, take_profit, commission, swap, profit, equity,
//          margin_level, close_reason
function detectExness(headers: string[]): boolean {
  const h = headers.map((x) => x.toLowerCase().trim());
  return h.includes("opening_time_utc") && h.includes("opening_price");
}

function parseExness(headers: string[], rows: string[][]): ParsedTradeRow[] {
  const h = headers.map((x) => x.toLowerCase().trim());
  const idx = (name: string) => h.findIndex((x) => x === name);

  const iType = idx("type");
  const iLots = idx("lots");
  const iSymbol = idx("symbol");
  const iOpenTime = idx("opening_time_utc");
  const iCloseTime = idx("closing_time_utc");
  const iOpenPrice = idx("opening_price");
  const iClosePrice = idx("closing_price");
  const iCommission = idx("commission");
  const iSwap = idx("swap");
  const iProfit = idx("profit");

  const results: ParsedTradeRow[] = [];

  for (const row of rows) {
    if (row.length < 4) continue;

    const rawType = row[iType] ?? "";
    const type = normalizeType(rawType);
    if (!type) continue; // skip non-trade rows (balance, credit, etc.)

    const openTime = parseDate(row[iOpenTime] ?? "");
    const closeTime = iCloseTime >= 0 ? parseDate(row[iCloseTime] ?? "") : null;
    const entryPrice = parseNum(row[iOpenPrice] ?? "");
    const exitPrice = iClosePrice >= 0 ? parseNum(row[iClosePrice] ?? "") : null;
    const positionSize = parseNum(row[iLots] ?? "");
    const rawSymbol = row[iSymbol] ?? "";
    const symbol = rawSymbol.toUpperCase().replace(/[^A-Z0-9.]/g, "");

    const warns: string[] = [];
    if (!openTime) warns.push("could not parse open time");
    if (!entryPrice) warns.push("missing entry price");
    if (!positionSize) warns.push("missing position size");
    if (!symbol) warns.push("missing symbol");

    if (warns.length > 0) {
      results.push({
        symbol: symbol || rawSymbol || "UNKNOWN",
        type,
        entryPrice: entryPrice ?? 0,
        exitPrice,
        positionSize: positionSize ?? 0,
        openTime: openTime?.toISOString() ?? new Date(0).toISOString(),
        closeTime: closeTime?.toISOString() ?? null,
        pnl: null,
        fees: null,
        warning: warns.join("; "),
      });
      continue;
    }

    const commission = iCommission >= 0 ? (parseNum(row[iCommission]) ?? 0) : 0;
    const swap = iSwap >= 0 ? (parseNum(row[iSwap]) ?? 0) : 0;
    const profit = iProfit >= 0 ? parseNum(row[iProfit]) : null;

    // Exness: profit is gross P&L; commission and swap are listed separately.
    // Net P&L = profit + commission + swap (commission is already negative).
    const fees = Math.abs(commission) + Math.abs(swap);
    const pnl = profit !== null ? profit + commission + swap : null;

    results.push({
      symbol,
      type,
      entryPrice: entryPrice!,
      exitPrice,
      positionSize: positionSize!,
      openTime: openTime!.toISOString(),
      closeTime: closeTime?.toISOString() ?? null,
      pnl,
      fees: fees > 0 ? fees : null,
    });
  }

  return results;
}

// ─── Main entry ───────────────────────────────────────────────────────────────
export function parseTradesCsv(content: string, columnMap?: GenericColumnMap): ParseResult {
  const lines = content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim() !== "");

  if (lines.length < 2) {
    return {
      format: "unknown",
      rows: [],
      rawHeaders: [],
      rawRows: [],
      error: "File is empty or has no data rows",
    };
  }

  const delimiter = detectDelimiter(lines);
  const rawHeaders = parseCsvLine(lines[0], delimiter);
  const rawRows = lines
    .slice(1)
    .map((l) => parseCsvLine(l, delimiter))
    .filter((r) => r.some((c) => c !== ""));

  let format: CsvFormat = "unknown";
  let rows: ParsedTradeRow[] = [];

  if (detectExness(rawHeaders)) {
    format = "exness";
    rows = parseExness(rawHeaders, rawRows);
  } else if (detectMt4(rawHeaders)) {
    format = "mt4";
    rows = parseMt4(rawHeaders, rawRows);
  } else if (detectMt5(rawHeaders)) {
    format = "mt5";
    rows = parseMt5(rawHeaders, rawRows);
  } else if (columnMap) {
    format = "csv";
    rows = parseGenericCsv(rawHeaders, rawRows, columnMap);
  } else {
    format = "unknown";
  }

  return { format, rows, rawHeaders, rawRows };
}
