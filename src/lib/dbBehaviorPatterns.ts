// Behavior pattern detection + persistence.
// Runs after each new journal entry to detect repeated/concerning patterns
// and stores them in the `behavior_patterns` table for the dashboard + mentor.

import { supabase } from "@/integrations/supabase/client";
import type { DbJournalRow } from "@/lib/dbJournal";

export type BehaviorPatternKind =
  | "emotional_repetition"
  | "consecutive_losses_after_break"
  | "undisciplined_streak"
  | "rule_breaking"
  | "revenge"
  | "overtrading";

export type DbBehaviorPattern = {
  id: string;
  kind: BehaviorPatternKind;
  message: string;
  severity: number;
  trade_ids: string[];
  meta: Record<string, unknown>;
  detected_at: string;
};

const REVENGE_WINDOW_MS = 15 * 60 * 1000;

type Detected = {
  kind: BehaviorPatternKind;
  message: string;
  severity: number;
  trade_ids: string[];
  meta: Record<string, unknown>;
};

/**
 * Inspects the latest trades and returns any patterns that are firing right now.
 * `rows` must be newest-first (matches fetchJournal output).
 */
export function detectPatterns(rows: DbJournalRow[]): Detected[] {
  const out: Detected[] = [];
  if (rows.length === 0) return out;

  const last5 = rows.slice(0, 5);

  // 1. Emotional repetition — same non-calm state on 3+ of last 5
  const stateCounts: Record<string, string[]> = {};
  for (const r of last5) {
    if (!r.emotional_state || r.emotional_state === "calm") continue;
    (stateCounts[r.emotional_state] ??= []).push(r.trade_id);
  }
  for (const [state, ids] of Object.entries(stateCounts)) {
    if (ids.length >= 3) {
      out.push({
        kind: "emotional_repetition",
        message: `Repeated ${state} trades — last ${ids.length} of 5 carried the same emotional state.`,
        severity: 2,
        trade_ids: ids,
        meta: { state, count: ids.length },
      });
      break;
    }
  }

  // 2. Consecutive losses after rule break — a broken-plan trade followed
  //    immediately by 2+ losses (in chronological order)
  const chrono = [...last5].reverse(); // oldest -> newest
  for (let i = 0; i < chrono.length - 2; i++) {
    const trigger = chrono[i];
    if (trigger.followedPlan) continue;
    const next1 = chrono[i + 1];
    const next2 = chrono[i + 2];
    if (next1.resultR < 0 && next2.resultR < 0) {
      out.push({
        kind: "consecutive_losses_after_break",
        message:
          "Two losses followed a rule break — the slip cascaded. Stop and reset before the next entry.",
        severity: 3,
        trade_ids: [trigger.trade_id, next1.trade_id, next2.trade_id],
        meta: {},
      });
      break;
    }
  }

  // 3. Undisciplined streak — last 2+ trades both broke the plan
  if (rows.length >= 2 && !rows[0].followedPlan && !rows[1].followedPlan) {
    const ids = [rows[0].trade_id, rows[1].trade_id];
    if (rows.length >= 3 && !rows[2].followedPlan) ids.push(rows[2].trade_id);
    out.push({
      kind: "undisciplined_streak",
      message:
        ids.length >= 3
          ? "Three undisciplined trades in a row — system is breaking down."
          : "Two undisciplined trades in a row — slow down before the next entry.",
      severity: ids.length >= 3 ? 3 : 2,
      trade_ids: ids,
      meta: { count: ids.length },
    });
  }

  // 4. Revenge — a loss immediately followed by another trade within 15 min
  for (let i = 0; i < chrono.length - 1; i++) {
    const prev = chrono[i];
    const next = chrono[i + 1];
    if (prev.resultR < 0 && next.timestamp - prev.timestamp <= REVENGE_WINDOW_MS) {
      out.push({
        kind: "revenge",
        message: "Re-entered within 15 minutes of a loss — likely revenge trade.",
        severity: 2,
        trade_ids: [prev.trade_id, next.trade_id],
        meta: { gap_ms: next.timestamp - prev.timestamp },
      });
      break;
    }
  }

  return out;
}

/**
 * Detect + persist patterns after a journal entry. Avoids duplicates by
 * skipping patterns whose `kind` was already recorded for the same set of
 * trade_ids in the last 24h.
 */
export async function detectAndStorePatterns(
  rows: DbJournalRow[],
): Promise<DbBehaviorPattern[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  const candidates = detectPatterns(rows);
  if (candidates.length === 0) return [];

  // Pull recent patterns to avoid re-inserting the same one back-to-back
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("behavior_patterns")
    .select("id, kind, trade_ids, message, severity, meta, detected_at")
    .eq("user_id", userData.user.id)
    .gte("detected_at", sinceIso)
    .order("detected_at", { ascending: false });

  const sameSig = (kind: string, ids: string[]) =>
    (recent ?? []).some(
      (r) =>
        r.kind === kind &&
        Array.isArray(r.trade_ids) &&
        r.trade_ids.length === ids.length &&
        r.trade_ids.every((id: string) => ids.includes(id)),
    );

  const fresh = candidates.filter((c) => !sameSig(c.kind, c.trade_ids));
  if (fresh.length === 0) return [];

  const { data: inserted, error } = await supabase
    .from("behavior_patterns")
    .insert(
      fresh.map((p) => ({
        user_id: userData.user!.id,
        kind: p.kind,
        message: p.message,
        severity: p.severity,
        trade_ids: p.trade_ids,
        meta: p.meta as any,
      })),
    )
    .select("id, kind, message, severity, trade_ids, meta, detected_at");

  if (error) {
    console.error("[behavior_patterns] insert failed", error);
    return [];
  }
  return (inserted ?? []) as DbBehaviorPattern[];
}

export async function fetchRecentPatterns(
  limit = 3,
): Promise<DbBehaviorPattern[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from("behavior_patterns")
    .select("id, kind, message, severity, trade_ids, meta, detected_at")
    .eq("user_id", userData.user.id)
    .order("detected_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as DbBehaviorPattern[];
}

export const PATTERN_LABEL: Record<BehaviorPatternKind, string> = {
  emotional_repetition: "Emotional repetition",
  consecutive_losses_after_break: "Cascade after rule break",
  undisciplined_streak: "Undisciplined streak",
  rule_breaking: "Rule breaking",
  revenge: "Revenge trade",
  overtrading: "Overtrading",
};
