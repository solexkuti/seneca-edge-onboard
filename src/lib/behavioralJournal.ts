// Behavioral Journal — the new source of truth for trade behavior.
//
// Single deterministic system:
//   - Each user has one running discipline_score (0..100), starts at 100.
//   - Each logged trade applies a fixed delta:
//       clean   → +2
//       minor   → -5  (1 mistake)
//       bad     → -10 (2+ mistakes)
//       severe  → -15 (any severe mistake — overrides everything)
//   - Severe mistakes (overleveraging, revenge, no_setup, ignored_sl)
//     ALWAYS classify as severe regardless of count.
//   - Multiple mistakes never stack; the worst severity wins.
//   - Streaks: clean_streak += 1 on clean (else 0); break_streak += 1 on
//     non-clean (else 0).
//
// Pure logic + Supabase IO for the journal_entries table and
// profiles.discipline_score.

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

export type Classification = "clean" | "minor" | "bad" | "severe";
export type DisciplineState = "controlled" | "drift" | "unstable" | "out_of_control";

export type MistakeDef = {
  id: MistakeId;
  label: string;
  severe: boolean;
};

export const MISTAKES: MistakeDef[] = [
  { id: "overleveraged",   label: "Overleveraged",          severe: true  },
  { id: "revenge_trade",   label: "Revenge trade",          severe: true  },
  { id: "no_setup",        label: "Entered without setup",  severe: true  },
  { id: "ignored_sl",      label: "Ignored stop loss",      severe: true  },
  { id: "early_entry",     label: "Early entry",            severe: false },
  { id: "late_entry",      label: "Late entry",             severe: false },
  { id: "moved_sl",        label: "Moved stop loss",        severe: false },
  { id: "oversized",       label: "Oversized position",     severe: false },
  { id: "fomo",            label: "FOMO entry",             severe: false },
  { id: "broke_risk_rule", label: "Broke risk rule",        severe: false },
];

export const MISTAKE_LABEL: Record<MistakeId, string> = MISTAKES.reduce(
  (acc, m) => {
    acc[m.id] = m.label;
    return acc;
  },
  {} as Record<MistakeId, string>,
);

export const SEVERE_IDS: Set<MistakeId> = new Set(
  MISTAKES.filter((m) => m.severe).map((m) => m.id),
);

export const CLEAN_DELTA = 2;
export const MINOR_DELTA = -5;
export const BAD_DELTA = -10;
export const SEVERE_DELTA = -15;
export const SCORE_MIN = 0;
export const SCORE_MAX = 100;
export const SCORE_INIT = 100;

export function classify(mistakes: MistakeId[]): {
  classification: Classification;
  delta: number;
  reasonLabel: string;
} {
  const hasSevere = mistakes.some((m) => SEVERE_IDS.has(m));
  if (hasSevere) {
    const first = mistakes.find((m) => SEVERE_IDS.has(m))!;
    return {
      classification: "severe",
      delta: SEVERE_DELTA,
      reasonLabel: MISTAKE_LABEL[first],
    };
  }
  if (mistakes.length === 0) {
    return { classification: "clean", delta: CLEAN_DELTA, reasonLabel: "Clean execution" };
  }
  if (mistakes.length === 1) {
    return {
      classification: "minor",
      delta: MINOR_DELTA,
      reasonLabel: MISTAKE_LABEL[mistakes[0]],
    };
  }
  return {
    classification: "bad",
    delta: BAD_DELTA,
    reasonLabel: mistakes.map((m) => MISTAKE_LABEL[m]).join(", "),
  };
}

export function clampScore(n: number): number {
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, Math.round(n)));
}

export function disciplineState(score: number): {
  state: DisciplineState;
  label: string;
  tone: "ok" | "drift" | "warn" | "risk";
} {
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

export async function getCurrentScore(): Promise<number> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return SCORE_INIT;
  const { data } = await supabase
    .from("profiles")
    .select("discipline_score")
    .eq("id", uid)
    .maybeSingle();
  const v = (data as { discipline_score?: number } | null)?.discipline_score;
  return typeof v === "number" ? clampScore(v) : SCORE_INIT;
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

export type LogTradeInput = {
  asset: string;
  result_r: number;
  mistakes: MistakeId[];
  note?: string | null;
  screenshotFile?: File | null;
};

export type LogTradeResult = {
  entry: JournalEntry;
  scoreBefore: number;
  scoreAfter: number;
  delta: number;
  classification: Classification;
  reasonLabel: string;
  cleanStreakAfter: number;
  breakStreakAfter: number;
};

export async function logTrade(input: LogTradeInput): Promise<LogTradeResult> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error("Not authenticated");

  // 1. Resolve current state
  const [scoreBefore, lastEntry] = await Promise.all([
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

  const { classification, delta, reasonLabel } = classify(input.mistakes);
  const scoreAfter = clampScore(scoreBefore + delta);

  const isClean = classification === "clean";
  const cleanPrev = lastEntry?.clean_streak_after ?? 0;
  const breakPrev = lastEntry?.break_streak_after ?? 0;
  const clean_streak_after = isClean ? cleanPrev + 1 : 0;
  const break_streak_after = isClean ? 0 : breakPrev + 1;

  // 2. Optional screenshot upload
  let screenshot_path: string | null = null;
  if (input.screenshotFile) {
    const ext = input.screenshotFile.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("trade-screenshots")
      .upload(path, input.screenshotFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: input.screenshotFile.type || undefined,
      });
    if (upErr) throw upErr;
    screenshot_path = path;
  }

  // 3. Insert entry
  const { data: inserted, error: insErr } = await supabase
    .from("journal_entries")
    .insert({
      user_id: uid,
      asset: input.asset.trim().toUpperCase(),
      result_r: input.result_r,
      mistakes: input.mistakes,
      classification,
      score_delta: delta,
      score_before: scoreBefore,
      score_after: scoreAfter,
      clean_streak_after,
      break_streak_after,
      note: input.note?.trim() || null,
      screenshot_path,
    })
    .select("*")
    .single();
  if (insErr) throw insErr;

  // 4. Update profile.discipline_score
  await supabase
    .from("profiles")
    .update({ discipline_score: scoreAfter })
    .eq("id", uid);

  return {
    entry: inserted as unknown as JournalEntry,
    scoreBefore,
    scoreAfter,
    delta,
    classification,
    reasonLabel,
    cleanStreakAfter: clean_streak_after,
    breakStreakAfter: break_streak_after,
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

export function nextActionFromBehavior(args: {
  entries: JournalEntry[];
  score: number;
}): { title: string; sub: string; tone: "ok" | "drift" | "warn" | "risk" } {
  const last = args.entries[0];
  if (!last) {
    return {
      title: "Log your first trade",
      sub: "Seneca needs one trade to start tracking your behavior.",
      tone: "drift",
    };
  }
  if (last.classification === "severe") {
    return {
      title: "Reduce risk. Pause trading.",
      sub: "Severe mistake on your last trade. No new trade until one clean setup is followed.",
      tone: "risk",
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
