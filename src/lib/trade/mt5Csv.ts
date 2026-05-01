// MT5 CSV parser.
//
// MetaTrader 5 exports its account history as a CSV (or HTML report) where
// each closed deal is a row. Brokers ship slightly different column orders
// and locales, so we accept the most common variants:
//
//   • English MT5 desktop export ("Position", "Symbol", "Type", ...)
//   • MT5 mobile / "Statement" export
//   • cTrader-style with similar columns
//
// We don't try to be exhaustive — we accept whatever rows have a
// recognisable ticket + symbol + open/close pair, and fall through silently
// for the rest. The user sees a per-row count: imported / duplicate /
// skipped.

import { type Mt5Deal } from "./normalize";

export interface ParsedMt5Csv {
  deals: Mt5Deal[];
  totalRows: number;
  skippedRows: number;
  /** Detected header label for the timestamp column, useful for error UX. */
  timeColumn: string | null;
}

/** Headers we'll accept (case-insensitive, whitespace-trimmed) for each field. */
const FIELD_ALIASES: Record<string, string[]> = {
  ticket: ["ticket", "deal", "position", "order", "deal id", "position id"],
  symbol: ["symbol", "instrument", "pair"],
  type: ["type", "side", "direction"],
  volume: ["volume", "size", "lots", "lot"],
  openPrice: ["open price", "price open", "openprice", "entry", "entry price"],
  closePrice: [
    "close price",
    "price close",
    "closeprice",
    "exit",
    "exit price",
  ],
  stopLoss: ["s/l", "sl", "stop loss", "stoploss"],
  takeProfit: ["t/p", "tp", "take profit", "takeprofit"],
  profit: ["profit", "p/l", "pnl", "net profit"],
  openTime: ["open time", "time open", "opentime", "time"],
  closeTime: ["close time", "time close", "closetime"],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function findIdx(headers: string[], aliases: string[]): number {
  const norm = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const i = norm.indexOf(alias);
    if (i !== -1) return i;
  }
  return -1;
}

/**
 * Tolerant CSV row parser — handles quoted fields with embedded commas and
 * escaped double-quotes ("").
 */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === "," || c === "\t" || c === ";") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function parseNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  // MT5 sometimes uses spaces as thousand separators and either . or , as decimal
  const cleaned = raw.replace(/\s/g, "").replace(/,(\d{1,2})$/, ".$1");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseTimestamp(raw: string | undefined): string | null {
  if (!raw) return null;
  // MT5 typical format: "2024.06.13 09:32:14" — convert dots to dashes
  const iso1 = raw.trim().replace(/^(\d{4})\.(\d{2})\.(\d{2})/, "$1-$2-$3");
  const d = new Date(iso1);
  if (Number.isFinite(d.getTime())) return d.toISOString();
  // last resort: native parse
  const d2 = new Date(raw);
  return Number.isFinite(d2.getTime()) ? d2.toISOString() : null;
}

function parseType(raw: string | undefined): "buy" | "sell" | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (t.startsWith("buy") || t === "long" || t === "b") return "buy";
  if (t.startsWith("sell") || t === "short" || t === "s") return "sell";
  return null;
}

export function parseMt5Csv(text: string): ParsedMt5Csv {
  // Normalise newlines; strip BOM
  const cleaned = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = cleaned.split("\n").filter((l) => l.trim().length > 0);
  if (!lines.length) {
    return { deals: [], totalRows: 0, skippedRows: 0, timeColumn: null };
  }

  // Find the first line that looks like a header (contains "ticket"/"symbol"/etc.)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const cells = parseCsvLine(lines[i]).map(normalizeHeader);
    if (
      cells.some((c) => FIELD_ALIASES.symbol.includes(c)) &&
      cells.some(
        (c) =>
          FIELD_ALIASES.ticket.includes(c) ||
          FIELD_ALIASES.openPrice.includes(c),
      )
    ) {
      headerIdx = i;
      break;
    }
  }

  const headers = parseCsvLine(lines[headerIdx]);
  const idx = {
    ticket: findIdx(headers, FIELD_ALIASES.ticket),
    symbol: findIdx(headers, FIELD_ALIASES.symbol),
    type: findIdx(headers, FIELD_ALIASES.type),
    volume: findIdx(headers, FIELD_ALIASES.volume),
    openPrice: findIdx(headers, FIELD_ALIASES.openPrice),
    closePrice: findIdx(headers, FIELD_ALIASES.closePrice),
    stopLoss: findIdx(headers, FIELD_ALIASES.stopLoss),
    takeProfit: findIdx(headers, FIELD_ALIASES.takeProfit),
    profit: findIdx(headers, FIELD_ALIASES.profit),
    openTime: findIdx(headers, FIELD_ALIASES.openTime),
    closeTime: findIdx(headers, FIELD_ALIASES.closeTime),
  };

  const deals: Mt5Deal[] = [];
  let skipped = 0;
  let total = 0;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    // Section dividers like "Open Positions" etc. — skip
    if (cells.length < 4) continue;
    total++;

    const ticket = cells[idx.ticket]?.trim();
    const symbol = cells[idx.symbol]?.trim();
    const type = parseType(cells[idx.type]);
    const openPrice = parseNumber(cells[idx.openPrice]);
    const openTime = parseTimestamp(cells[idx.openTime]);

    if (!ticket || !symbol || !type || openPrice == null || !openTime) {
      skipped++;
      continue;
    }

    deals.push({
      ticket,
      symbol,
      type,
      volume: parseNumber(cells[idx.volume]) ?? 0,
      openPrice,
      closePrice: parseNumber(cells[idx.closePrice]) ?? undefined,
      stopLoss: parseNumber(cells[idx.stopLoss]) ?? undefined,
      takeProfit: parseNumber(cells[idx.takeProfit]) ?? undefined,
      profit: parseNumber(cells[idx.profit]) ?? undefined,
      openTime,
      closeTime: parseTimestamp(cells[idx.closeTime]) ?? undefined,
    });
  }

  return {
    deals,
    totalRows: total,
    skippedRows: skipped,
    timeColumn:
      idx.openTime >= 0 ? headers[idx.openTime].trim() || "Open Time" : null,
  };
}
