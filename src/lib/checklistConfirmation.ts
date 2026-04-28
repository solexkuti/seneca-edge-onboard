// Checklist confirmation — the user's commitment record for today's plan.
// Mentor and Trade Check both reference these to enforce accountability:
// "you broke rule 2 that you confirmed at 09:14".

import { supabase } from "@/integrations/supabase/client";
import { broadcastLockChange } from "@/lib/tradeLock";

export type RuleAck = {
  id: string; // stable rule_id from the daily checklist (e.g. "entry-2")
  label: string;
  category: "entry" | "exit" | "risk" | "behavior" | "adaptive";
  confirmed: boolean;
};

export type ChecklistConfirmation = {
  id: string;
  user_id: string;
  generated_for: string; // YYYY-MM-DD
  confirmed_at: string;
  control_state: "in_control" | "at_risk" | "out_of_control";
  discipline_score: number;
  allowed_tiers: string[];
  applied_restrictions: string[];
  focus: string[];
  rule_acknowledgements: RuleAck[];
  strategy_name: string | null;
};

function todayLabel(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchTodayConfirmation(): Promise<ChecklistConfirmation | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("checklist_confirmations")
    .select(
      "id,user_id,generated_for,confirmed_at,control_state,discipline_score,allowed_tiers,applied_restrictions,focus,rule_acknowledgements,strategy_name",
    )
    .eq("user_id", uid)
    .eq("generated_for", todayLabel())
    .order("confirmed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[checklist-confirm] fetch failed:", error);
    return null;
  }
  return data ? (data as unknown as ChecklistConfirmation) : null;
}

// The most recent discipline log recorded AFTER the user locked today's
// checklist that broke the plan. This is the trade that the Mentor cites
// when calling the user out: "you broke rule X you confirmed at HH:MM".
export type PostConfirmationBreak = {
  trade_id: string;
  logged_at: string; // ISO
  followed_entry: boolean;
  followed_exit: boolean;
  followed_risk: boolean;
  followed_behavior: boolean;
  broken_categories: Array<"entry" | "exit" | "risk" | "behavior">;
  mistake_tag: string | null;
  discipline_score: number;
  market: string | null;
  direction: string | null;
  result: string | null;
};

export async function fetchPostConfirmationBreak(
  confirmedAtIso: string,
): Promise<PostConfirmationBreak | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return null;

  // Pull the most recent undisciplined log created after the confirmation.
  const { data: logs, error } = await supabase
    .from("discipline_logs")
    .select(
      "trade_id,created_at,followed_entry,followed_exit,followed_risk,followed_behavior,mistake_tag,discipline_score",
    )
    .eq("user_id", uid)
    .gte("created_at", confirmedAtIso)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error || !logs?.length) return null;

  const broken = logs.find(
    (l) =>
      !(l.followed_entry && l.followed_exit && l.followed_risk && l.followed_behavior),
  );
  if (!broken) return null;

  // Fetch the parent trade for context (market/direction/result).
  let market: string | null = null;
  let direction: string | null = null;
  let result: string | null = null;
  try {
    const { data: trade } = await supabase
      .from("trades")
      .select("market,direction,result")
      .eq("id", broken.trade_id)
      .maybeSingle();
    if (trade) {
      market = trade.market ?? null;
      direction = trade.direction ?? null;
      result = trade.result ?? null;
    }
  } catch {
    // non-fatal
  }

  const broken_categories: PostConfirmationBreak["broken_categories"] = [];
  if (!broken.followed_entry) broken_categories.push("entry");
  if (!broken.followed_exit) broken_categories.push("exit");
  if (!broken.followed_risk) broken_categories.push("risk");
  if (!broken.followed_behavior) broken_categories.push("behavior");

  return {
    trade_id: broken.trade_id,
    logged_at: broken.created_at,
    followed_entry: broken.followed_entry,
    followed_exit: broken.followed_exit,
    followed_risk: broken.followed_risk,
    followed_behavior: broken.followed_behavior,
    broken_categories,
    mistake_tag: broken.mistake_tag ?? null,
    discipline_score: broken.discipline_score ?? 0,
    market,
    direction,
    result,
  };
}

export type ConfirmationInput = {
  control_state: ChecklistConfirmation["control_state"];
  discipline_score: number;
  allowed_tiers: string[];
  applied_restrictions: string[];
  focus: string[];
  rule_acknowledgements: RuleAck[];
  strategy_name: string;
};

export async function recordConfirmation(
  input: ConfirmationInput,
): Promise<{ ok: true; row: ChecklistConfirmation } | { ok: false; error: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: "Sign in required." };

  // Require every rule to be acknowledged — confirmation is binary.
  const allConfirmed = input.rule_acknowledgements.every((r) => r.confirmed);
  if (!allConfirmed) {
    return {
      ok: false,
      error: "Every rule must be ticked before locking today's checklist.",
    };
  }

  const { data, error } = await supabase
    .from("checklist_confirmations")
    .insert({
      user_id: uid,
      generated_for: todayLabel(),
      control_state: input.control_state,
      discipline_score: input.discipline_score,
      allowed_tiers: input.allowed_tiers,
      applied_restrictions: input.applied_restrictions,
      focus: input.focus,
      rule_acknowledgements: input.rule_acknowledgements,
      strategy_name: input.strategy_name,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[checklist-confirm] insert failed:", error);
    return { ok: false, error: error?.message ?? "Could not lock checklist." };
  }
  // Tell the rest of the app that the trade lock just changed.
  broadcastLockChange();
  return { ok: true, row: data as unknown as ChecklistConfirmation };
}
