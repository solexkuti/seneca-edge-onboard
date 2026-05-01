// Deriv WebSocket sync engine (server-only).
//
// Connects to wss://ws.derivws.com/websockets/v3, authorizes with a user-pasted
// API token, fetches the closed contracts (profit_table) since their last sync
// plus a balance snapshot, then writes normalized rows into `trades` using
// supabaseAdmin. broker_deal_id (the Deriv contract_id) makes re-syncs
// idempotent via the existing unique index on (user_id, source, broker_deal_id).
//
// Workers + nodejs_compat support the standard `WebSocket` global, so no extra
// dependency is needed. Each call opens a short-lived socket, drains the data,
// and closes — no persistent connection.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DERIV_WS_URL = "wss://ws.derivws.com/websockets/v3?app_id=1089";

// ---------- WebSocket request/response helper ----------

interface DerivResponse {
  msg_type: string;
  req_id?: number;
  error?: { code: string; message: string };
  [k: string]: unknown;
}

/**
 * Open a Deriv WS, run a sequence of req_id-tagged requests, return their
 * responses in order. Always closes the socket. Throws on first error.
 */
async function derivCall(
  token: string,
  requests: Array<Record<string, unknown>>,
): Promise<DerivResponse[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(DERIV_WS_URL);
    const responses: DerivResponse[] = [];
    let idx = 0;
    let settled = false;

    const finish = (err: Error | null, value?: DerivResponse[]) => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch {
        // ignore
      }
      if (err) reject(err);
      else resolve(value!);
    };

    const timeout = setTimeout(
      () => finish(new Error("Deriv WebSocket timeout")),
      30_000,
    );

    const sendNext = () => {
      const req = requests[idx];
      ws.send(JSON.stringify({ ...req, req_id: idx + 1 }));
    };

    ws.addEventListener("open", () => {
      // First call is always authorize
      ws.send(JSON.stringify({ authorize: token, req_id: 0 }));
    });

    ws.addEventListener("message", (ev) => {
      let msg: DerivResponse;
      try {
        msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
      } catch {
        return;
      }
      if (msg.req_id === 0) {
        if (msg.error) {
          clearTimeout(timeout);
          return finish(
            new Error(`Deriv auth failed: ${msg.error.message}`),
          );
        }
        // Authorized — start running queue
        if (requests.length === 0) {
          clearTimeout(timeout);
          return finish(null, [msg]);
        }
        sendNext();
        return;
      }
      // Tagged response
      if (typeof msg.req_id === "number" && msg.req_id >= 1) {
        if (msg.error) {
          clearTimeout(timeout);
          return finish(
            new Error(`Deriv ${msg.msg_type} error: ${msg.error.message}`),
          );
        }
        responses[msg.req_id - 1] = msg;
        idx += 1;
        if (idx >= requests.length) {
          clearTimeout(timeout);
          return finish(null, responses);
        }
        sendNext();
      }
    });

    ws.addEventListener("error", () => {
      clearTimeout(timeout);
      finish(new Error("Deriv WebSocket connection error"));
    });
    ws.addEventListener("close", () => {
      if (!settled) {
        clearTimeout(timeout);
        finish(new Error("Deriv WebSocket closed before completion"));
      }
    });
  });
}

// ---------- Profit table → trades ----------

interface DerivProfitRow {
  contract_id: number;
  transaction_id?: number;
  contract_type: string; // CALL, PUT, MULTUP, etc.
  buy_price: number;
  sell_price: number;
  payout: number;
  shortcode?: string;
  underlying_symbol?: string;
  symbol?: string;
  purchase_time: number; // unix seconds
  sell_time: number;
  duration_type?: string;
}

interface ProfitTableResponse extends DerivResponse {
  profit_table?: {
    transactions: DerivProfitRow[];
    count: number;
  };
}

interface AuthorizeResponse extends DerivResponse {
  authorize?: {
    loginid: string;
    currency: string;
    balance: number;
    is_virtual: 0 | 1;
    fullname?: string;
  };
}

interface BalanceResponse extends DerivResponse {
  balance?: {
    balance: number;
    currency: string;
    loginid: string;
  };
}

function sessionFromUtc(unixSec: number): "asia" | "london" | "ny" | "off" {
  const h = new Date(unixSec * 1000).getUTCHours();
  if (h >= 0 && h < 7) return "asia";
  if (h >= 7 && h < 13) return "london";
  if (h >= 13 && h < 21) return "ny";
  return "off";
}

function directionFromContractType(t: string): "long" | "short" {
  const up = t.toUpperCase();
  if (
    up.startsWith("CALL") ||
    up.startsWith("MULTUP") ||
    up.includes("UP") ||
    up.includes("HIGHER") ||
    up.includes("LONG")
  ) {
    return "long";
  }
  return "short";
}

interface SyncResult {
  rows_total: number;
  rows_imported: number;
  rows_duplicate: number;
  rows_skipped: number;
  latest_deal_at: Date | null;
  account: {
    loginid: string;
    currency: string;
    balance: number;
    is_virtual: boolean;
    fullname?: string;
  };
}

/**
 * Pull closed contracts since `since` (or last 30d if null) and balance.
 * Inserts into `trades`. Uses ON CONFLICT DO NOTHING via upsert with
 * onConflict=user_id,source,broker_deal_id.
 */
export async function syncDerivAccount(
  userId: string,
  apiToken: string,
  since: Date | null,
): Promise<SyncResult> {
  const dateFrom = since
    ? Math.floor(since.getTime() / 1000)
    : Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

  const responses = await derivCall(apiToken, [
    {
      profit_table: 1,
      description: 1,
      sort: "ASC",
      limit: 500,
      date_from: dateFrom,
    },
    { balance: 1 },
  ]);

  // Authorize response is responses-of-authorize-only path; here we got tagged
  // responses back. We need to grab the authorize info separately.
  const authResponses = await derivCall(apiToken, []);
  const auth = authResponses[0] as AuthorizeResponse;
  if (!auth.authorize) throw new Error("Deriv authorize returned no payload");

  const profit = responses[0] as ProfitTableResponse;
  const balance = responses[1] as BalanceResponse;

  const txs = profit.profit_table?.transactions ?? [];
  let imported = 0;
  let duplicate = 0;
  let skipped = 0;
  let latestDealAt: Date | null = null;

  if (txs.length > 0) {
    const rows = txs
      .map((t) => {
        if (!t.contract_id || !t.sell_time) {
          skipped += 1;
          return null;
        }
        const sellAt = new Date(t.sell_time * 1000);
        if (!latestDealAt || sellAt > latestDealAt) latestDealAt = sellAt;
        const buyAt = new Date(t.purchase_time * 1000);
        const pnl = Number(((t.sell_price ?? 0) - (t.buy_price ?? 0)).toFixed(2));
        const risk = Math.max(t.buy_price ?? 0, 0.0001);
        const rr = Number((pnl / risk).toFixed(2));
        return {
          user_id: userId,
          source: "deriv" as const,
          broker_deal_id: String(t.contract_id),
          market: t.underlying_symbol || t.symbol || "synthetic",
          market_type: "synthetic" as const,
          asset: t.underlying_symbol || t.symbol || null,
          direction: directionFromContractType(t.contract_type),
          entry_price: null,
          exit_price: null,
          stop_loss: null,
          take_profit: null,
          lot_size: t.buy_price ?? null,
          risk_r: risk,
          rr,
          pnl,
          result:
            pnl > 0 ? ("win" as const) : pnl < 0 ? ("loss" as const) : ("breakeven" as const),
          executed_at: buyAt.toISOString(),
          closed_at: sellAt.toISOString(),
          session: sessionFromUtc(t.sell_time),
          trade_type: "executed" as const,
          execution_type: "controlled" as const,
          rules_followed: [] as string[],
          rules_broken: [] as string[],
          notes: t.shortcode ? `Deriv ${t.contract_type} · ${t.shortcode}` : null,
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;

    if (rows.length > 0) {
      // Use upsert with ignoreDuplicates to leverage the unique index.
      const { data, error } = await supabaseAdmin
        .from("trades")
        .upsert(rows, {
          onConflict: "user_id,source,broker_deal_id",
          ignoreDuplicates: true,
        })
        .select("id");
      if (error) throw new Error(`trades upsert failed: ${error.message}`);
      imported = data?.length ?? 0;
      duplicate = rows.length - imported;
    }
  }

  return {
    rows_total: txs.length,
    rows_imported: imported,
    rows_duplicate: duplicate,
    rows_skipped: skipped,
    latest_deal_at: latestDealAt,
    account: {
      loginid: auth.authorize.loginid,
      currency: balance.balance?.currency ?? auth.authorize.currency,
      balance: balance.balance?.balance ?? auth.authorize.balance,
      is_virtual: Boolean(auth.authorize.is_virtual),
      fullname: auth.authorize.fullname,
    },
  };
}

/**
 * Lightweight authorize-only call used to validate the token at connect time.
 */
export async function verifyDerivToken(token: string): Promise<{
  loginid: string;
  currency: string;
  balance: number;
  is_virtual: boolean;
  fullname?: string;
}> {
  const responses = await derivCall(token, []);
  const auth = responses[0] as AuthorizeResponse;
  if (!auth.authorize) throw new Error("Token rejected by Deriv");
  return {
    loginid: auth.authorize.loginid,
    currency: auth.authorize.currency,
    balance: auth.authorize.balance,
    is_virtual: Boolean(auth.authorize.is_virtual),
    fullname: auth.authorize.fullname,
  };
}
