// FX Snapshot Persistence — patch a freshly-saved trade row with the
// canonical FX architecture fields. Called AFTER any insert that creates a
// `public.trades` row (dbJournal, BehavioralJournalFlow's mirror trigger,
// MissedTradeFlow, MT5 import). Idempotent: if the trade already has
// `monetary_pnl_base`, we leave it untouched (immutable historical).

import { supabase } from "@/integrations/supabase/client";
import { captureTradeFxSnapshot } from "@/lib/fxService";

type ProfileFxPrefs = {
  currency: string;            // base account currency
  display_currency: string;    // user-selected display currency
  risk_per_trade: number | null;
};

async function loadProfilePrefs(userId: string): Promise<ProfileFxPrefs> {
  const { data } = await supabase
    .from("profiles")
    .select("currency,display_currency,risk_per_trade")
    .eq("id", userId)
    .maybeSingle();
  const p = (data as Partial<ProfileFxPrefs> | null) ?? {};
  return {
    currency: p.currency || "USD",
    display_currency: p.display_currency || p.currency || "USD",
    risk_per_trade: p.risk_per_trade ?? null,
  };
}

/**
 * Patch the most recent un-snapped trade for this user with FX fields.
 * Pass `tradeId` to target a specific row. Otherwise we patch the newest
 * trade missing `monetary_pnl_base`.
 */
export async function attachFxSnapshotToTrade(opts: {
  tradeId?: string;
  userId?: string;
} = {}): Promise<void> {
  let userId = opts.userId;
  if (!userId) {
    const { data: auth } = await supabase.auth.getUser();
    userId = auth?.user?.id;
    if (!userId) return;
  }

  // Find target trade.
  let q = supabase
    .from("trades")
    .select("id,rr,executed_at,closed_at,monetary_pnl_base")
    .eq("user_id", userId)
    .is("monetary_pnl_base", null)
    .order("executed_at", { ascending: false })
    .limit(1);
  if (opts.tradeId) {
    q = supabase
      .from("trades")
      .select("id,rr,executed_at,closed_at,monetary_pnl_base")
      .eq("id", opts.tradeId)
      .limit(1);
  }
  const { data: rows } = await q;
  const target = (rows ?? [])[0] as
    | { id: string; rr: number | null; executed_at: string; closed_at: string | null; monetary_pnl_base: number | null }
    | undefined;
  if (!target) return;
  if (target.monetary_pnl_base != null) return; // already snapped — immutable

  const prefs = await loadProfilePrefs(userId);
  const snapshot = await captureTradeFxSnapshot({
    resultR: target.rr,
    riskPerTrade: prefs.risk_per_trade,
    baseCurrency: prefs.currency,
    displayCurrency: prefs.display_currency,
    closedAtIso: target.closed_at ?? target.executed_at,
  });

  await supabase
    .from("trades")
    .update({
      base_currency: snapshot.base_currency,
      risk_per_trade_at_open: snapshot.risk_per_trade_at_open,
      monetary_pnl_base: snapshot.monetary_pnl_base,
      exchange_rate_at_close: snapshot.exchange_rate_at_close,
      display_currency_at_close: snapshot.display_currency_at_close,
      monetary_pnl_converted_snapshot: snapshot.monetary_pnl_converted_snapshot,
    })
    .eq("id", target.id);
}
