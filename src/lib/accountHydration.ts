// Account hydration — promotes the first manual account_size + risk_per_trade
// captured during a trade log into the user's persistent profile so the SSOT
// can compute live equity and converted analytics. Idempotent: never
// overwrites an existing starting_balance — only edits via settings can.

import { supabase } from "@/integrations/supabase/client";
import { JOURNAL_EVENT } from "@/lib/tradingJournal";

export async function hydrateAccountFromTrade(input: {
  accountSize: number | null;
  riskPercent: number | null;
}): Promise<void> {
  if (input.accountSize == null && input.riskPercent == null) return;
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return;

  const { data: prof } = await supabase
    .from("profiles")
    .select("account_balance,risk_per_trade")
    .eq("id", uid)
    .maybeSingle();

  const patch: {
    account_balance?: number;
    balance_source?: string;
    balance_updated_at?: string;
    risk_per_trade?: number;
  } = {};
  // Compute risk in BASE currency: account_size * (risk_percent / 100).
  if (input.accountSize != null && Number.isFinite(input.accountSize) && input.accountSize > 0) {
    if (prof?.account_balance == null) {
      patch.account_balance = input.accountSize;
      patch.balance_source = "manual";
      patch.balance_updated_at = new Date().toISOString();
    }
    if (
      prof?.risk_per_trade == null &&
      input.riskPercent != null &&
      Number.isFinite(input.riskPercent) &&
      input.riskPercent > 0
    ) {
      patch.risk_per_trade = input.accountSize * (input.riskPercent / 100);
    }
  }

  if (Object.keys(patch).length === 0) return;
  await supabase.from("profiles").update(patch).eq("id", uid);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(JOURNAL_EVENT));
  }
}
