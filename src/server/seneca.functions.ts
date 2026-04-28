// SenecaEdge centralized engine — server functions.
//
// Two endpoints:
//   - enforceTradingAccess() → checks strategy, checklist, discipline.state.
//     Throws TRADING_BLOCKED with a deterministic reason. The frontend
//     middleware/UX should call this BEFORE any trade or chart analysis.
//   - updateDiscipline() → recomputes discipline from the last 10 analyzer
//     events + last 10 discipline logs and upserts discipline_state +
//     session_state. Call AFTER any analyzer event or trade log.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computeDisciplineFromRows,
  type EventInput,
  type TradeInput,
  type DisciplineStateName,
} from "./discipline.server";

export type EnforceReason =
  | "NO_STRATEGY"
  | "CHECKLIST_REQUIRED"
  | "DISCIPLINE_LOCKED"
  | null;

export type EnforceResult = {
  allowed: boolean;
  reason: EnforceReason;
  discipline_score: number;
  discipline_state: DisciplineStateName;
  checklist_confirmed: boolean;
  has_strategy: boolean;
};

async function loadGate(supabase: any, userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const [evRes, trRes, stratRes, checklistRes, stateRes] = await Promise.all([
    supabase
      .from("analyzer_events")
      .select("verdict,violations,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("discipline_logs")
      .select("discipline_score,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("strategy_blueprints")
      .select("id")
      .eq("user_id", userId)
      .eq("locked", true)
      .limit(1),
    supabase
      .from("checklist_confirmations")
      .select("confirmed_at")
      .eq("user_id", userId)
      .eq("generated_for", today)
      .order("confirmed_at", { ascending: false })
      .limit(1),
    supabase
      .from("discipline_state")
      .select("score,state")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  return {
    events: (evRes.data ?? []) as EventInput[],
    trades: (trRes.data ?? []) as TradeInput[],
    has_strategy: (stratRes.data ?? []).length > 0,
    checklist_confirmed: (checklistRes.data ?? []).length > 0,
    cachedState: stateRes.data as
      | { score: number; state: DisciplineStateName }
      | null,
  };
}

/**
 * updateDiscipline — recompute and persist discipline_state + session_state.
 * Called after every analyzer_event insert and after every discipline_log insert.
 */
export const updateDiscipline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as {
      supabase: any;
      userId: string;
    };

    const gate = await loadGate(supabase, userId);
    const computed = computeDisciplineFromRows(gate.events, gate.trades);

    // Upsert discipline_state
    const { error: dsErr } = await supabase
      .from("discipline_state")
      .upsert(
        {
          user_id: userId,
          score: computed.score,
          state: computed.state,
          decision_score: computed.decision_score,
          execution_score: computed.execution_score,
          decision_sample: computed.decision_sample,
          execution_sample: computed.execution_sample,
        },
        { onConflict: "user_id" },
      );
    if (dsErr) console.error("[updateDiscipline] discipline_state upsert:", dsErr);

    // Derive session flags
    const trading_allowed =
      gate.has_strategy &&
      gate.checklist_confirmed &&
      computed.state !== "locked";
    const block_reason: EnforceReason = !gate.has_strategy
      ? "NO_STRATEGY"
      : !gate.checklist_confirmed
        ? "CHECKLIST_REQUIRED"
        : computed.state === "locked"
          ? "DISCIPLINE_LOCKED"
          : null;

    const { error: ssErr } = await supabase
      .from("session_state")
      .upsert(
        {
          user_id: userId,
          checklist_confirmed: gate.checklist_confirmed,
          trading_allowed,
          block_reason,
          generated_for: new Date().toISOString().slice(0, 10),
        },
        { onConflict: "user_id" },
      );
    if (ssErr) console.error("[updateDiscipline] session_state upsert:", ssErr);

    return {
      score: computed.score,
      state: computed.state,
      decision_score: computed.decision_score,
      execution_score: computed.execution_score,
      trading_allowed,
      block_reason,
    };
  });

/**
 * enforceTradingAccess — single deterministic gate for /analyze-chart and
 * /log-trade. Returns a result; callers decide whether to throw or render.
 */
export const enforceTradingAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EnforceResult> => {
    const { supabase, userId } = context as {
      supabase: any;
      userId: string;
    };

    const gate = await loadGate(supabase, userId);
    const computed = computeDisciplineFromRows(gate.events, gate.trades);

    let reason: EnforceReason = null;
    if (!gate.has_strategy) reason = "NO_STRATEGY";
    else if (!gate.checklist_confirmed) reason = "CHECKLIST_REQUIRED";
    else if (computed.state === "locked") reason = "DISCIPLINE_LOCKED";

    return {
      allowed: reason === null,
      reason,
      discipline_score: computed.score,
      discipline_state: computed.state,
      checklist_confirmed: gate.checklist_confirmed,
      has_strategy: gate.has_strategy,
    };
  });
