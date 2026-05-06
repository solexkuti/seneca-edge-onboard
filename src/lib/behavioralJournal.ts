// Behavioral Journal — STRICT ±10 SSOT engine.
//
// SCORING MODEL (canonical, no severity weighting):
//   • Each trade starts at 100.
//   • Every violation subtracts EXACTLY 10. No severity tiers, no weights.
//   • Clean trade (no mistakes) = 100.
//   • Per-trade score = clamp(0..100, 100 - 10 * violations).
//
//   Overall discipline score is owned by SSOT (src/lib/ssot.ts) which
//   replays a +10 / -10 ledger over trades.rules_broken. This file no
//   longer computes or persists an "average" score on profiles.
//
// Classification (drives feedback tone only — never scoring):
//   • clean      — 0 violations
//   • violation  — 1+ violations
//
// Storage mapping (keeps existing journal_entries columns):
//   • score_before = 100 (per-trade base — kept for back-compat)
//   • score_after  = per-trade score (0..100)
//   • score_delta  = score_after - 100 (≤ 0)
//   • profiles.discipline_score = current rolling AVERAGE of score_after
//     across all entries. We re-compute on every insert.

import { supabase } from "@/integrations/supabase/client";

export type MistakeId =
  | "overleveraged"
  | "revenge_trade"
  | "no_setup"
  | "ignored_sl"
  | "early_entry"
  | "late_entry"
  | "moved_sl"
  | "oversized"
  | "fomo"
  | "broke_risk_rule";

export type Classification = "clean" | "violation";
export type DisciplineState = "controlled" | "drift" | "unstable" | "out_of_control" | "inactive";

export type MistakeDef = {
  id: MistakeId;
  label: string;
  /** Penalty subtracted from the per-trade base of 100. ALWAYS 10 (strict ±10 engine). */
  penalty: 10;
};

/** Strict ±10 engine — every violation has the same weight. */
export const PENALTY_PER_VIOLATION = 10 as const;

export const MISTAKES: MistakeDef[] = [
  { id: "overleveraged",   label: "Overleveraged",                  penalty: 10 },
  { id: "revenge_trade",   label: "Revenge trade",                  penalty: 10 },
  { id: "no_setup",        label: "Entered without confirmation",   penalty: 10 },
  { id: "ignored_sl",      label: "Ignored stop loss",              penalty: 10 },
  { id: "broke_risk_rule", label: "Broke risk rule",                penalty: 10 },
  { id: "oversized",       label: "Oversized position",             penalty: 10 },
  { id: "moved_sl",        label: "Moved stop loss",                penalty: 10 },
  { id: "fomo",            label: "FOMO entry",                     penalty: 10 },
  { id: "early_entry",     label: "Early entry",                    penalty: 10 },
  { id: "late_entry",      label: "Late entry",                     penalty: 10 },
];

export const MISTAKE_LABEL: Record<MistakeId, string> = MISTAKES.reduce(
  (acc, m) => {
    acc[m.id] = m.label;
    return acc;
  },
  {} as Record<MistakeId, string>,
);

export const MISTAKE_PENALTY: Record<MistakeId, 10> = MISTAKES.reduce(
  (acc, m) => {
    acc[m.id] = 10;
    return acc;
  },
  {} as Record<MistakeId, 10>,
);

export const PER_TRADE_BASE = 100;
export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

/**
 * @deprecated Legacy severity tiers were removed by the strict ±10 engine.
 * Kept as an empty set so old callers compile and behave as if no mistake
 * is "severe". Do NOT add new ids here.
 */
export const SEVERE_IDS: ReadonlySet<MistakeId> = new Set<MistakeId>();

/** @deprecated Legacy cap from the weighted engine. No longer enforced — kept for back-compat. */
export const MAX_PENALTY = 100;

/** @deprecated Legacy floor from the weighted engine. The strict engine clamps to 0. */
export const MIN_TRADE_SCORE = 0;

export type ClassifyResult = {
  classification: Classification;
  /** Raw sum of penalties (10 × number of violations). */
  rawPenalty: number;
  /** Same as rawPenalty — kept for back-compat. No capping in ±10 engine. */
  appliedPenalty: number;
  /** Final per-trade score (0..100). */
  perTradeScore: number;
  /** perTradeScore - 100 (≤ 0). */
  scoreDelta: number;
  /** Short human label used in feedback cards. */
  reasonLabel: string;
  /** Per-violation breakdown — every entry is −10. */
  breakdown: { id: MistakeId; label: string; penalty: 10 }[];
};

export function classify(mistakes: MistakeId[]): ClassifyResult {
  const breakdown = mistakes.map((id) => ({
    id,
    label: MISTAKE_LABEL[id] ?? id,
    penalty: 10 as const,
  }));
  const rawPenalty = breakdown.length * PENALTY_PER_VIOLATION;
  const appliedPenalty = rawPenalty;
  const perTradeScore = Math.max(SCORE_MIN, Math.min(SCORE_MAX, PER_TRADE_BASE - appliedPenalty));
  const scoreDelta = perTradeScore - PER_TRADE_BASE;

  const classification: Classification = mistakes.length === 0 ? "clean" : "violation";
  const reasonLabel = mistakes.length === 0
    ? "Clean execution"
    : breakdown.map((b) => b.label).join(", ");

  return {
    classification,
    rawPenalty,
    appliedPenalty,
    perTradeScore,
    scoreDelta,
    reasonLabel,
    breakdown,
  };
}

export function clampScore(n: number): number {
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, Math.round(n)));
}

/**
 * Map a 0..100 score to a behavioral state.
 * `null` (no trades) → "inactive".
 */
export function disciplineState(score: number | null): {
  state: DisciplineState;
  label: string;
  tone: "ok" | "drift" | "warn" | "risk" | "inactive";
} {
  if (score == null) return { state: "inactive", label: "Inactive", tone: "inactive" };
  if (score >= 80) return { state: "controlled", label: "Controlled", tone: "ok" };
  if (score >= 60) return { state: "drift", label: "Slight drift", tone: "drift" };
  if (score >= 40) return { state: "unstable", label: "Unstable", tone: "warn" };
  return { state: "out_of_control", label: "Out of control", tone: "risk" };
}

export type JournalEntry = {
  id: string;
  user_id: string;
  asset: string;
  result_r: number;
  mistakes: MistakeId[];
  classification: Classification;
  score_delta: number;
  score_before: number;
  score_after: number;
  clean_streak_after: number;
  break_streak_after: number;
  note: string | null;
  screenshot_path: string | null;
  created_at: string;
};

// ── IO ──────────────────────────────────────────────────────────────────

/**
 * Returns the current overall discipline score (average of per-trade scores)
 * or `null` when the user has logged 0 trades — meaning "inactive".
 *
 * Reads `profiles.discipline_score`, which is recomputed by `logTrade` on
 * every insert. We sanity-check against entry count to ensure null state is
 * accurate (e.g. after a manual reset).
 */
export async function getCurrentScore(): Promise<number | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return null;

  // Count entries — if none exist, system is inactive regardless of profile cache.
  const { count } = await supabase
    .from("journal_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid);

  if (!count || count === 0) return null;

  const { data } = await supabase
    .from("profiles")
    .select("discipline_score")
    .eq("id", uid)
    .maybeSingle();
  const v = (data as { discipline_score?: number } | null)?.discipline_score;
  return typeof v === "number" ? clampScore(v) : null;
}

export async function fetchEntries(limit = 50): Promise<JournalEntry[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as JournalEntry[];
}

/** Pull every score_after for the user — used to recompute the overall avg. */
async function fetchAllScoreAfters(uid: string): Promise<number[]> {
  const { data } = await supabase
    .from("journal_entries")
    .select("score_after")
    .eq("user_id", uid);
  return ((data ?? []) as { score_after: number }[]).map((r) => r.score_after);
}

export type LogTradeInput = {
  asset: string;
  result_r: number;
  mistakes: MistakeId[];
  note?: string | null;
  /** Primary screenshot stored on the journal entry (back-compat). */
  screenshotFile?: File | null;
  /** Additional screenshots — uploaded to storage, paths returned in the result. */
  extraScreenshotFiles?: File[];
};

export type LogTradeResult = {
  entry: JournalEntry;
  /** Overall discipline score AFTER this trade (rolling average). */
  scoreBefore: number | null;
  scoreAfter: number;
  /** Per-trade score (0..100) for THIS trade. */
  perTradeScore: number;
  /** Same as perTradeScore - 100 (≤0). Kept for UI back-compat. */
  delta: number;
  classification: Classification;
  reasonLabel: string;
  cleanStreakAfter: number;
  breakStreakAfter: number;
  /** Storage paths of any extra screenshots uploaded alongside the primary one. */
  extraScreenshotPaths: string[];
};

async function uploadScreenshot(uid: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from("trade-screenshots")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
  if (error) throw error;
  return path;
}

export async function logTrade(input: LogTradeInput): Promise<LogTradeResult> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error("Not authenticated");

  // Resolve previous overall score (for the feedback card) + last streaks.
  const [prevScore, lastEntry] = await Promise.all([
    getCurrentScore(),
    supabase
      .from("journal_entries")
      .select("clean_streak_after,break_streak_after")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((r) => r.data as { clean_streak_after: number; break_streak_after: number } | null),
  ]);

  const c = classify(input.mistakes);
  const isClean = c.classification === "clean";
  const cleanPrev = lastEntry?.clean_streak_after ?? 0;
  const breakPrev = lastEntry?.break_streak_after ?? 0;
  const clean_streak_after = isClean ? cleanPrev + 1 : 0;
  const break_streak_after = isClean ? 0 : breakPrev + 1;

  // Upload primary + extra screenshots (best-effort for extras).
  let screenshot_path: string | null = null;
  if (input.screenshotFile) {
    screenshot_path = await uploadScreenshot(uid, input.screenshotFile);
  }
  const extraPaths: string[] = [];
  if (input.extraScreenshotFiles && input.extraScreenshotFiles.length > 0) {
    for (const f of input.extraScreenshotFiles) {
      try {
        extraPaths.push(await uploadScreenshot(uid, f));
      } catch (err) {
        console.warn("[journal] extra screenshot upload failed:", err);
      }
    }
  }

  // Insert entry — score_before stores the per-trade base (100), score_after
  // stores the per-trade score, score_delta stores per-trade delta.
  const { data: inserted, error: insErr } = await supabase
    .from("journal_entries")
    .insert({
      user_id: uid,
      asset: input.asset.trim().toUpperCase(),
      result_r: input.result_r,
      mistakes: input.mistakes,
      classification: c.classification,
      score_delta: c.scoreDelta,
      score_before: PER_TRADE_BASE,
      score_after: c.perTradeScore,
      clean_streak_after,
      break_streak_after,
      note: input.note?.trim() || null,
      screenshot_path,
    })
    .select("*")
    .single();
  if (insErr) throw insErr;

  // Recompute overall average across ALL entries for this user.
  const all = await fetchAllScoreAfters(uid);
  const avg = all.length > 0
    ? clampScore(all.reduce((s, n) => s + n, 0) / all.length)
    : c.perTradeScore;

  await supabase
    .from("profiles")
    .update({ discipline_score: avg })
    .eq("id", uid);

  return {
    entry: inserted as unknown as JournalEntry,
    scoreBefore: prevScore,
    scoreAfter: avg,
    perTradeScore: c.perTradeScore,
    delta: c.scoreDelta,
    classification: c.classification,
    reasonLabel: c.reasonLabel,
    cleanStreakAfter: clean_streak_after,
    breakStreakAfter: break_streak_after,
    extraScreenshotPaths: extraPaths,
  };
}

// ── Derived helpers ────────────────────────────────────────────────────

export function lastMistakeOf(entries: JournalEntry[]): {
  label: string;
  whenMs: number;
  classification: Classification;
} | null {
  for (const e of entries) {
    if (e.classification !== "clean" && e.mistakes.length > 0) {
      return {
        label: MISTAKE_LABEL[e.mistakes[0]] ?? "Mistake",
        whenMs: new Date(e.created_at).getTime(),
        classification: e.classification,
      };
    }
  }
  return null;
}

export function mistakeFrequency(entries: JournalEntry[]): {
  id: MistakeId;
  label: string;
  count: number;
}[] {
  const counts = new Map<MistakeId, number>();
  for (const e of entries) {
    for (const m of e.mistakes) counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([id, count]) => ({ id, label: MISTAKE_LABEL[id], count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Behavior-aware next-action / insight suggestion.
 * Accepts nullable score so callers can pass the inactive state directly.
 */
export function nextActionFromBehavior(args: {
  entries: JournalEntry[];
  score: number | null;
}): { title: string; sub: string; tone: "ok" | "drift" | "warn" | "risk" | "inactive" } {
  const last = args.entries[0];
  if (!last || args.score == null) {
    return {
      title: "Log your first trade",
      sub: "Seneca needs one trade to start tracking your behavior.",
      tone: "inactive",
    };
  }
  if (last.break_streak_after >= 2) {
    return {
      title: "Pause before next entry",
      sub: "Two non-clean trades in a row. Run the next setup through the analyzer.",
      tone: "warn",
    };
  }
  if (last.clean_streak_after >= 3) {
    return {
      title: "Maintain discipline",
      sub: `${last.clean_streak_after} clean trades in a row. Keep executing the same system.`,
      tone: "ok",
    };
  }
  if (args.score < 60) {
    return {
      title: "Tighten execution",
      sub: "Discipline is drifting. Take only A+ setups for the rest of the session.",
      tone: "warn",
    };
  }
  return {
    title: "Stay in rhythm",
    sub: "Grade every entry through the analyzer before clicking buy.",
    tone: "ok",
  };
}

// Public storage URL helper (signed for private bucket).
export async function getScreenshotUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("trade-screenshots")
    .createSignedUrl(path, 60 * 60); // 1h
  if (error) return null;
  return data?.signedUrl ?? null;
}
