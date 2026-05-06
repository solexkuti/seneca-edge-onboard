// FX Service — centralized exchange-rate engine.
// =============================================
//
// CORE PRINCIPLE
//   RR is the only permanent trading truth. Currency values are DERIVED
//   display values. Historical pnl must NEVER mutate retroactively.
//
// RESPONSIBILITIES
//   1. Fetch live FX rates from a real provider (frankfurter.app — ECB feed,
//      no API key, supports USD/EUR/GBP/NGN/JPY/CAD/AUD/CHF).
//   2. Cache rates in `public.fx_rates` keyed by (base, quote, rate_date).
//   3. Persist a close-time rate snapshot per trade so historical analytics
//      stay psychologically stable forever.
//   4. Expose pure conversion helpers (convert, formatMetric).
//
// NO component is allowed to fetch FX directly. NO component is allowed to
// recompute historical values from a live rate.

import { supabase } from "@/integrations/supabase/client";

export const SUPPORTED_FX = [
  "USD",
  "EUR",
  "GBP",
  "NGN",
  "JPY",
  "CAD",
  "AUD",
  "CHF",
] as const;
export type FxCurrency = (typeof SUPPORTED_FX)[number];

export type MetricDisplayMode = "rr_only" | "rr_plus_currency" | "currency_only";

const FRANKFURTER_BASE = "https://api.frankfurter.app";

// Frankfurter doesn't quote NGN. We fall back to exchangerate.host for any
// pair frankfurter doesn't cover (only NGN today).
const NEEDS_FALLBACK = (c: string) => c === "NGN";

const memCache = new Map<string, { rate: number; ts: number }>();
const MEM_TTL_MS = 30 * 60_000; // 30 min in-process cache

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function memKey(base: string, quote: string, date: string) {
  return `${base}:${quote}:${date}`;
}

async function fetchFromFrankfurter(base: string, quote: string, date: string): Promise<number | null> {
  // /latest or /YYYY-MM-DD for historical; both accept ?from=&to=
  const segment = date === todayUtc() ? "latest" : date;
  const url = `${FRANKFURTER_BASE}/${segment}?from=${base}&to=${quote}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as { rates?: Record<string, number> };
    const r = json?.rates?.[quote];
    return typeof r === "number" && Number.isFinite(r) ? r : null;
  } catch {
    return null;
  }
}

async function fetchFromExchangerateHost(base: string, quote: string, date: string): Promise<number | null> {
  const segment = date === todayUtc() ? "latest" : date;
  const url = `https://api.exchangerate.host/${segment}?base=${base}&symbols=${quote}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as { rates?: Record<string, number> };
    const r = json?.rates?.[quote];
    return typeof r === "number" && Number.isFinite(r) ? r : null;
  } catch {
    return null;
  }
}

async function fetchLiveRate(base: string, quote: string, date: string): Promise<number | null> {
  if (NEEDS_FALLBACK(base) || NEEDS_FALLBACK(quote)) {
    return fetchFromExchangerateHost(base, quote, date);
  }
  const r = await fetchFromFrankfurter(base, quote, date);
  if (r != null) return r;
  return fetchFromExchangerateHost(base, quote, date);
}

async function readCachedRate(base: string, quote: string, date: string): Promise<number | null> {
  const { data } = await supabase
    .from("fx_rates")
    .select("rate")
    .eq("base", base)
    .eq("quote", quote)
    .eq("rate_date", date)
    .maybeSingle();
  const r = (data as { rate?: number | string } | null)?.rate;
  if (r == null) return null;
  const n = typeof r === "string" ? Number(r) : r;
  return Number.isFinite(n) ? n : null;
}

async function persistRate(base: string, quote: string, date: string, rate: number): Promise<void> {
  await supabase
    .from("fx_rates")
    .upsert(
      { base, quote, rate_date: date, rate, source: "frankfurter" },
      { onConflict: "base,quote,rate_date" },
    );
}

/**
 * Get an exchange rate (base → quote) for the given date (YYYY-MM-DD).
 * Order: in-memory → DB cache → live provider → persist → memoize.
 * Returns null only when both providers fail.
 */
export async function getRate(
  base: string,
  quote: string,
  date: string = todayUtc(),
): Promise<number | null> {
  if (!base || !quote) return null;
  if (base === quote) return 1;

  const k = memKey(base, quote, date);
  const cached = memCache.get(k);
  if (cached && Date.now() - cached.ts < MEM_TTL_MS) return cached.rate;

  const dbRate = await readCachedRate(base, quote, date);
  if (dbRate != null) {
    memCache.set(k, { rate: dbRate, ts: Date.now() });
    return dbRate;
  }

  const live = await fetchLiveRate(base, quote, date);
  if (live == null) return null;
  memCache.set(k, { rate: live, ts: Date.now() });
  // Best-effort persist — do not block caller if RLS or network blip.
  void persistRate(base, quote, date, live);
  return live;
}

/** Convert an amount in `base` currency to `quote` using a stored or live rate.
 *  Returns null when conversion isn't derivable. */
export async function convertAmount(
  amount: number | null,
  base: string,
  quote: string,
  date: string = todayUtc(),
): Promise<number | null> {
  if (amount == null || !Number.isFinite(amount)) return null;
  if (base === quote) return amount;
  const rate = await getRate(base, quote, date);
  if (rate == null) return null;
  return amount * rate;
}

/** Pure synchronous variant when caller already has a rate. */
export function applyRate(amount: number | null, rate: number | null): number | null {
  if (amount == null || rate == null || !Number.isFinite(amount) || !Number.isFinite(rate)) return null;
  return amount * rate;
}

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  NGN: "₦",
  JPY: "¥",
  CAD: "$",
  AUD: "$",
  CHF: "CHF ",
};

export function formatCurrencyAmount(
  amount: number | null | undefined,
  currency: string = "USD",
  opts: { showSign?: boolean } = {},
): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  const sym = CURRENCY_SYMBOL[currency] ?? `${currency} `;
  const sign = amount > 0 && opts.showSign ? "+" : amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const digits = currency === "JPY" ? 0 : 2;
  return `${sign}${sym}${abs.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function formatRr(r: number | null | undefined, digits = 2): string {
  if (r == null || !Number.isFinite(r)) return "—";
  const sign = r > 0 ? "+" : "";
  return `${sign}${r.toFixed(digits)}R`;
}

/**
 * Render a metric according to the user's display mode. Currency values come
 * from STORED snapshots (immutable historical) when available, otherwise
 * derived live from R × risk_per_trade in the user's display currency.
 */
export function formatMetric(args: {
  r: number | null;
  amountInDisplayCurrency: number | null;
  displayCurrency: string;
  mode: MetricDisplayMode;
  digits?: number;
}): string {
  const { r, amountInDisplayCurrency, displayCurrency, mode, digits = 2 } = args;
  const rrStr = formatRr(r, digits);
  const moneyStr = formatCurrencyAmount(amountInDisplayCurrency, displayCurrency, { showSign: true });
  if (mode === "rr_only") return rrStr;
  if (mode === "currency_only") return amountInDisplayCurrency == null ? rrStr : moneyStr;
  // rr_plus_currency
  if (amountInDisplayCurrency == null || r == null) return rrStr;
  return `${rrStr} (${moneyStr})`;
}

/**
 * Capture FX snapshot fields for a freshly-saved trade.
 * Computes:
 *   monetary_pnl_base           = result_r * risk_per_trade  (in base currency)
 *   exchange_rate_at_close      = base→displayCurrency rate on close date
 *   monetary_pnl_converted_snapshot = monetary_pnl_base * rate
 *
 * IMMUTABLE: once persisted, historical analytics must use these stored
 * values, never re-derived from the current live rate.
 */
export async function captureTradeFxSnapshot(args: {
  resultR: number | null;
  riskPerTrade: number | null;
  baseCurrency: string;
  displayCurrency: string;
  closedAtIso: string;
}): Promise<{
  base_currency: string;
  risk_per_trade_at_open: number | null;
  monetary_pnl_base: number | null;
  exchange_rate_at_close: number | null;
  display_currency_at_close: string;
  monetary_pnl_converted_snapshot: number | null;
}> {
  const { resultR, riskPerTrade, baseCurrency, displayCurrency, closedAtIso } = args;
  const monetaryBase =
    resultR != null && riskPerTrade != null && Number.isFinite(resultR) && Number.isFinite(riskPerTrade)
      ? resultR * riskPerTrade
      : null;
  const date = (closedAtIso ? new Date(closedAtIso) : new Date()).toISOString().slice(0, 10);
  let rate: number | null = null;
  let converted: number | null = null;
  if (baseCurrency && displayCurrency) {
    rate = await getRate(baseCurrency, displayCurrency, date);
    converted = applyRate(monetaryBase, rate);
  }
  return {
    base_currency: baseCurrency,
    risk_per_trade_at_open: riskPerTrade,
    monetary_pnl_base: monetaryBase,
    exchange_rate_at_close: rate,
    display_currency_at_close: displayCurrency,
    monetary_pnl_converted_snapshot: converted,
  };
}
