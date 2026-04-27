// DB-backed Trading Journal — single source of truth for behavior data.
// Reads/writes Supabase `trades` + `discipline_logs`. Falls back to legacy
// localStorage entries for unauthenticated users so the rest of the app
// (AI Mentor, Control Hub) keeps working before a session exists.

import { supabase } from "@/integrations/supabase/client";
import type { JournalEntry } from "@/lib/tradingJournal";
import { JOURNAL_EVENT, readJournal as readLocalJournal } from "@/lib/tradingJournal";

export type EmotionalState =
  | "calm"
  | "fearful"
  | "frustrated"
  | "overconfident"
  | "confused";

export type TradeDirection = "long" | "short";
export type TradeResult = "win" | "loss" | "breakeven";

export type NewJournalSubmission = {
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
};

/**
 * Submit a complete journal entry atomically.
 * Strategy: insert trade → insert discipline_log. If the second fails,
 * delete the trade so we never persist a half-saved record.
 */
export async function submitJournalEntry(
  input: NewJournalSubmission,
): Promise<{ ok: true; row: DbJournalRow } | { ok: false; error: string }> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return { ok: false, error: "You need to be signed in to save trades." };
  }
  const userId = userData.user.id;

  // 1) Insert trade
  const { data: trade, error: tradeError } = await supabase
    .from("trades")
    .insert({
      user_id: userId,
      market: input.trade.market,
      direction: input.trade.direction,
      entry_price: input.trade.entry_price ?? null,
      stop_loss: input.trade.stop_loss ?? null,
      take_profit: input.trade.take_profit ?? null,
      result: input.trade.result ?? null,
      rr: input.trade.rr ?? null,
    })
    .select()
    .single();

  if (tradeError || !trade) {
    return { ok: false, error: tradeError?.message ?? "Failed to save trade." };
  }

  // 2) Insert discipline log
  const { data: log, error: logError } = await supabase
    .from("discipline_logs")
    .insert({
      user_id: userId,
      trade_id: trade.id,
      followed_entry: input.discipline.followed_entry,
      followed_exit: input.discipline.followed_exit,
      followed_risk: input.discipline.followed_risk,
      followed_behavior: input.discipline.followed_behavior,
      emotional_state: input.emotional_state,
      notes: input.notes?.trim() ? input.notes.trim() : null,
    })
    .select()
    .single();

  if (logError || !log) {
    // Roll back the trade insert so state stays consistent.
    await supabase.from("trades").delete().eq("id", trade.id);
    return {
      ok: false,
      error: logError?.message ?? "Failed to save behavior log.",
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
       followed_behavior, discipline_score, emotional_state, notes,
       trade:trades!inner (
         id, market, direction, result, rr, executed_at
       )`,
    )
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false })
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
  };
}
