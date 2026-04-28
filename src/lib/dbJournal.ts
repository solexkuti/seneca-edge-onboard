// DB-backed Trading Journal — single source of truth for behavior data.
// Reads/writes Supabase `trades` + `discipline_logs`. Falls back to legacy
// localStorage entries for unauthenticated users so the rest of the app
// (AI Mentor, Control Hub) keeps working before a session exists.

import { supabase } from "@/integrations/supabase/client";
import type { JournalEntry } from "@/lib/tradingJournal";
import { JOURNAL_EVENT, readJournal as readLocalJournal } from "@/lib/tradingJournal";
import { fetchTradeLockState, broadcastLockChange } from "@/lib/tradeLock";

export type EmotionalState =
  | "calm"
  | "fearful"
  | "frustrated"
  | "overconfident"
  | "confused";

export type TradeDirection = "long" | "short";
export type TradeResult = "win" | "loss" | "breakeven";

export type MistakeTagValue =
  | "fomo"
  | "revenge"
  | "overleveraged"
  | "early_exit"
  | "late_entry"
  | "no_setup"
  | "emotional";

export type NewJournalSubmission = {
  user_id?: string;
  executed_at?: string;
  trade: {
    market: string;
    direction: TradeDirection;
    entry_price?: number | null;
    stop_loss?: number | null;
    take_profit?: number | null;
    result?: TradeResult | null;
    rr?: number | null;
  };
  discipline: {
    followed_entry: boolean;
    followed_exit: boolean;
    followed_risk: boolean;
    followed_behavior: boolean;
  };
  emotional_state: EmotionalState;
  notes?: string;
  mistake_tag?: MistakeTagValue | null;
};

export type DbJournalRow = {
  id: string;          // discipline_log id
  trade_id: string;
  timestamp: number;   // ms — derived from trade.executed_at
  pair: string;        // trade.market — keeps existing UI compatible
  direction: TradeDirection;
  result: TradeResult | null;
  rr: number | null;
  followed_entry: boolean;
  followed_exit: boolean;
  followed_risk: boolean;
  followed_behavior: boolean;
  discipline_score: number;
  followedPlan: boolean; // all 4 rules followed
  resultR: number;       // signed R for legacy compatibility
  emotional_state: EmotionalState;
  notes: string | null;
  mistake_tag: MistakeTagValue | null;
  strategy_id: string | null;
  strategy_name: string | null;
  entry_rule: string | null;
  exit_rule: string | null;
  risk_rule: string | null;
  behavior_rule: string | null;
};

/**
 * Submit a complete journal entry atomically.
 * Strategy: insert trade → insert discipline_log. If the second fails,
 * delete the trade so we never persist a half-saved record.
 */
export async function submitJournalEntry(
  input: NewJournalSubmission,
): Promise<{ ok: true; row: DbJournalRow } | { ok: false; error: string }> {
  // 1) Confirm Supabase client + URL configured
  const supabaseUrl =
    (import.meta as any).env?.VITE_SUPABASE_URL ||
    (typeof process !== "undefined" ? process.env?.SUPABASE_URL : undefined);
  console.log("[journal] supabase url:", supabaseUrl ? "configured" : "MISSING");

  // 2) Log current authenticated user
  const { data: sessionData } = await supabase.auth.getSession();
  console.log("[journal] session:", sessionData?.session ? "active" : "none");

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  console.log("[journal] user:", userData?.user ?? null, "userErr:", userErr ?? null);

  if (userErr || !userData.user) {
    console.error("[journal] BLOCKED: not authenticated", userErr);
    return { ok: false, error: "You need to be signed in to save trades." };
  }
  const userId = userData.user.id;
  if (input.user_id && input.user_id !== userId) {
    console.error("[journal] BLOCKED: user_id mismatch", {
      payloadUserId: input.user_id,
      sessionUserId: userId,
    });
    return { ok: false, error: "Journal entry belongs to a different signed-in user." };
  }

  const payloadError = validateSubmission(input);
  if (payloadError) {
    console.error("[journal] payload validation failed:", payloadError, input);
    return { ok: false, error: payloadError };
  }

  const executedAt = input.executed_at ?? new Date().toISOString();
  if (Number.isNaN(new Date(executedAt).getTime())) {
    console.error("[journal] invalid executed_at:", input.executed_at);
    return { ok: false, error: "Trade timestamp is invalid." };
  }

  // 0a) HARD GATE — trade lock. The DB trigger will also reject locked
  // inserts, but we check here to give a precise message and avoid a
  // failed write. No bypass: skipping this check still hits the trigger.
  const lock = await fetchTradeLockState();
  if (lock.trade_lock) {
    console.warn("[journal] BLOCKED by trade lock:", lock.reason);
    return {
      ok: false,
      error: `TRADING_LOCKED: ${lock.message} Confirm today's checklist in Daily Checklist before logging trades.`,
    };
  }

  // 0b) Server-side de-dupe: if an identical trade was just inserted (same
  // market/direction/result/rr/prices within the last 2 minutes), reuse it
  // instead of writing a second row. Protects against double-tap, retries,
  // and multi-tab submissions.
  const dedupeSinceIso = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: recent } = await supabase
    .from("trades")
    .select("id, market, direction, result, rr, entry_price, stop_loss, take_profit, executed_at")
    .eq("user_id", userId)
    .eq("market", input.trade.market)
    .eq("direction", input.trade.direction)
    .gte("executed_at", dedupeSinceIso)
    .order("executed_at", { ascending: false })
    .limit(5);

  const eq = (a: number | null | undefined, b: number | null | undefined) =>
    (a ?? null) === (b ?? null);
  const duplicateTrade = (recent ?? []).find(
    (t) =>
      (t.result ?? null) === (input.trade.result ?? null) &&
      eq(Number(t.rr ?? null) || null, input.trade.rr ?? null) &&
      eq(Number(t.entry_price ?? null) || null, input.trade.entry_price ?? null) &&
      eq(Number(t.stop_loss ?? null) || null, input.trade.stop_loss ?? null) &&
      eq(Number(t.take_profit ?? null) || null, input.trade.take_profit ?? null),
  );

  if (duplicateTrade) {
    // Already saved (or saved+log written). Fetch the joined row and return ok.
    const { data: existingLog } = await supabase
      .from("discipline_logs")
      .select(
        `id, trade_id, followed_entry, followed_exit, followed_risk,
         followed_behavior, discipline_score, emotional_state, notes, mistake_tag,
         trade:trades!inner (
           id, market, direction, result, rr, executed_at, strategy_id,
           strategy:strategies ( id, name, entry_rule, exit_rule, risk_rule, behavior_rule )
         )`,
      )
      .eq("trade_id", duplicateTrade.id)
      .maybeSingle();

    if (existingLog) {
      const row = combine(existingLog.trade as any, existingLog as any);
      return { ok: true, row };
    }
    // Trade exists but log was missing — fall through to insert just the log
    // by reusing the existing trade id.
  }

  // 1) Insert trade (or reuse the duplicate's id when only the log is missing)
  let trade: { id: string } & Record<string, unknown>;
  if (duplicateTrade) {
    trade = duplicateTrade as any;
  } else {
    const tradePayload = {
      user_id: userId,
      executed_at: executedAt,
      market: input.trade.market,
      direction: input.trade.direction,
      entry_price: input.trade.entry_price ?? null,
      stop_loss: input.trade.stop_loss ?? null,
      take_profit: input.trade.take_profit ?? null,
      result: input.trade.result ?? null,
      rr: input.trade.rr ?? null,
    };
    console.log("[journal] inserting trade payload:", tradePayload);

    const { data: inserted, error: tradeError } = await supabase
      .from("trades")
      .insert(tradePayload)
      .select()
      .single();

    if (tradeError || !inserted) {
      console.error("[journal] trades insert FAILED:", {
        message: tradeError?.message,
        details: tradeError?.details,
        hint: tradeError?.hint,
        code: tradeError?.code,
        full: tradeError,
        payload: tradePayload,
      });
      return { ok: false, error: formatDbError(tradeError, "Failed to save trade.") };
    }
    console.log("[journal] trade inserted:", inserted.id);
    trade = inserted as any;
  }


  // 2) Insert discipline log
  const logPayload = {
    user_id: userId,
    trade_id: trade.id,
    followed_entry: input.discipline.followed_entry,
    followed_exit: input.discipline.followed_exit,
    followed_risk: input.discipline.followed_risk,
    followed_behavior: input.discipline.followed_behavior,
    emotional_state: input.emotional_state,
    notes: input.notes?.trim() ? input.notes.trim() : null,
    mistake_tag: input.mistake_tag ?? null,
  };
  console.log("[journal] inserting discipline_log payload:", logPayload);

  const { data: log, error: logError } = await supabase
    .from("discipline_logs")
    .insert(logPayload)
    .select()
    .single();

  if (logError || !log) {
    if (logError) {
      console.error("[journal] discipline_logs insert FAILED:", {
        message: logError.message,
        details: logError.details,
        hint: logError.hint,
        code: logError.code,
        full: logError,
        payload: logPayload,
      });
    }
    // 23505 = unique_violation on (trade_id) → a parallel submission already
    // wrote this log. Treat as success and return the existing row.
    if ((logError as any)?.code === "23505") {
      const { data: existing } = await supabase
        .from("discipline_logs")
        .select(
          `id, trade_id, followed_entry, followed_exit, followed_risk,
           followed_behavior, discipline_score, emotional_state, notes, mistake_tag,
           trade:trades!inner (
             id, market, direction, result, rr, executed_at, strategy_id,
             strategy:strategies ( id, name, entry_rule, exit_rule, risk_rule, behavior_rule )
           )`,
        )
        .eq("trade_id", trade.id)
        .maybeSingle();
      if (existing) {
        const row = combine(existing.trade as any, existing as any);
        return { ok: true, row };
      }
    }
    // Only roll back the trade if we created it on this call.
    if (!duplicateTrade) {
      await supabase.from("trades").delete().eq("id", trade.id);
    }
    return {
      ok: false,
      error: formatDbError(logError, "Failed to save behavior log."),
    };
  }

  // Notify any subscribers (Control Hub, Mentor) to refresh.
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(JOURNAL_EVENT));
    }
  } catch {
    // ignore
  }

  const row = combine(trade, log);
  return { ok: true, row };
}

/**
 * Read the user's full journal (joined trades + discipline_logs).
 * Returns newest first. Empty array when not signed in or no rows.
 */
export async function fetchJournal(): Promise<DbJournalRow[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from("discipline_logs")
    .select(
      `id, trade_id, followed_entry, followed_exit, followed_risk,
       followed_behavior, discipline_score, emotional_state, notes, mistake_tag,
       trade:trades!inner (
         id, market, direction, result, rr, executed_at, strategy_id,
         strategy:strategies ( id, name, entry_rule, exit_rule, risk_rule, behavior_rule )
       )`,
    )
    .eq("user_id", userData.user.id)
    .order("executed_at", { ascending: false, referencedTable: "trades" })
    .limit(200);

  if (error || !data) return [];

  return data.map((d: any) => combine(d.trade, d));
}

/**
 * Bridge: maps DB rows into the legacy `JournalEntry` shape used by
 * AiMentor / ControlHub helpers (computeDiscipline, detectBehaviorPattern,
 * summarizeJournal). Keeps existing logic working unchanged.
 */
export function toLegacyEntries(rows: DbJournalRow[]): JournalEntry[] {
  return rows.map((r) => ({
    id: r.id,
    timestamp: r.timestamp,
    pair: r.pair,
    resultR: r.resultR,
    followedPlan: r.followedPlan,
    notes: r.notes ?? undefined,
    emotionalState: r.emotional_state,
    disciplineScore: r.discipline_score,
    rules: {
      entry: r.followed_entry,
      exit: r.followed_exit,
      risk: r.followed_risk,
      behavior: r.followed_behavior,
    },
  }));
}

/** Snapshot helper: read DB rows AND fall back to legacy localStorage. */
export async function fetchJournalAsLegacy(): Promise<JournalEntry[]> {
  const dbRows = await fetchJournal();
  if (dbRows.length > 0) return toLegacyEntries(dbRows);
  // Pre-auth users may have older localStorage entries — keep them visible.
  return readLocalJournal();
}

// ───────── helpers ─────────

function validateSubmission(input: NewJournalSubmission): string | null {
  if (!input.trade.market.trim()) return "Market is required.";
  if (!input.trade.direction) return "Trade direction is required.";
  if (!input.trade.result) return "Trade result is required.";
  if (!input.emotional_state) return "Emotional state is required.";
  const d = input.discipline;
  if (
    typeof d.followed_entry !== "boolean" ||
    typeof d.followed_exit !== "boolean" ||
    typeof d.followed_risk !== "boolean" ||
    typeof d.followed_behavior !== "boolean"
  ) {
    return "Discipline checklist is incomplete.";
  }
  return null;
}

function formatDbError(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback;
  const e = error as { message?: string; details?: string; hint?: string; code?: string };
  return [e.message, e.details, e.hint, e.code ? `Code: ${e.code}` : null]
    .filter(Boolean)
    .join(" ") || fallback;
}

function combine(trade: any, log: any): DbJournalRow {
  const followedPlan =
    log.followed_entry &&
    log.followed_exit &&
    log.followed_risk &&
    log.followed_behavior;

  // Derive a signed R for legacy UIs:
  // - if rr present, win = +rr, loss = -rr, breakeven = 0
  // - else fall back to ±1 R
  const rr = typeof trade.rr === "number" ? trade.rr : null;
  let resultR = 0;
  if (trade.result === "win") resultR = rr ?? 1;
  else if (trade.result === "loss") resultR = -(rr ?? 1);

  const strategy = trade.strategy ?? null;
  return {
    id: log.id,
    trade_id: trade.id,
    timestamp: new Date(trade.executed_at).getTime(),
    pair: trade.market,
    direction: trade.direction,
    result: trade.result ?? null,
    rr,
    followed_entry: log.followed_entry,
    followed_exit: log.followed_exit,
    followed_risk: log.followed_risk,
    followed_behavior: log.followed_behavior,
    discipline_score: log.discipline_score,
    followedPlan,
    resultR,
    emotional_state: log.emotional_state ?? "calm",
    notes: log.notes ?? null,
    mistake_tag: (log.mistake_tag ?? null) as MistakeTagValue | null,
    strategy_id: trade.strategy_id ?? strategy?.id ?? null,
    strategy_name: strategy?.name ?? null,
    entry_rule: strategy?.entry_rule ?? null,
    exit_rule: strategy?.exit_rule ?? null,
    risk_rule: strategy?.risk_rule ?? null,
    behavior_rule: strategy?.behavior_rule ?? null,
  };
}
