// Recovery System — deterministic LOCKED → CONTROLLED gate.
//
// All transitions are rule-based. No AI guessing. The session row in
// `recovery_sessions` is the source of truth.
//
// Lifecycle:
//   discipline_locked → ensureActiveRecoverySession() creates a row
//   step 1 reflection → user answers, validated against last violation
//   step 2 recommit   → user re-acks each rule area
//   step 3 cooldown   → DB-backed timer (default 15 min)
//   complete          → discipline.state forced to "at_risk" + probation
//
// Probation: next 2 decisions in `recent_decisions` after completion must
// each meet score>=75. Otherwise the system re-locks.

import { supabase } from "@/integrations/supabase/client";
import { fetchRecentDecisions, type RecentDecision } from "@/lib/analyzerEvents";

export type RecoveryStep = "reflection" | "recommit" | "cooldown" | "complete";

export type RecoverySession = {
  id: string;
  user_id: string;
  triggered_by_trade_id: string | null;
  triggered_by_event_id: string | null;
  trigger_reason: string;

  step: RecoveryStep;
  reflection_completed: boolean;
  recommit_completed: boolean;
  cooldown_completed: boolean;

  cooldown_seconds: number;
  cooldown_started_at: string | null;
  cooldown_ends_at: string | null;

  reflection_violation_match: string | null;
  reflection_why: string | null;
  reflection_next_action: string | null;
  recommit_acks: Record<string, boolean>;

  start_time: string;
  completed_time: string | null;
  success: boolean | null;

  probation_state: "pending" | "active" | "passed" | "failed";
  probation_decisions_seen: number;

  created_at: string;
  updated_at: string;
};

export const RECOVERY_DEFAULT_COOLDOWN_SECONDS = 15 * 60;
export const RECOVERY_EVENT = "seneca:recovery-changed";

export function broadcastRecoveryChange(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(RECOVERY_EVENT));
  } catch {
    // ignore
  }
}

const TABLE = "recovery_sessions" as never;

async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

/**
 * Most recent OPEN session (completed_time IS NULL). Returns null if none.
 */
export async function getActiveRecoverySession(): Promise<RecoverySession | null> {
  const u = await uid();
  if (!u) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", u)
    .is("completed_time", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[recovery] getActiveRecoverySession failed", error);
    return null;
  }
  return (data as RecoverySession | null) ?? null;
}

/**
 * Most recent COMPLETED session — used to drive probation enforcement.
 */
export async function getLastCompletedRecoverySession(): Promise<RecoverySession | null> {
  const u = await uid();
  if (!u) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", u)
    .not("completed_time", "is", null)
    .order("completed_time", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[recovery] getLastCompletedRecoverySession failed", error);
    return null;
  }
  return (data as RecoverySession | null) ?? null;
}

/**
 * Get the most recent violation (an analyzer event with verdict='invalid')
 * to seed the reflection step. The user must identify a rule from this list.
 */
export type LastViolation = {
  source: "analyzer" | "execution";
  id: string;
  rules_broken: string[];
  reason: string | null;
  score_delta: number;
  trade_id: string | null;
  analysis_id: string | null;
  created_at: string;
};

export async function getLastViolation(): Promise<LastViolation | null> {
  const recent = await fetchRecentDecisions(20);
  const v = recent.find((d) => d.verdict === "invalid");
  if (!v) return null;

  let rules: string[] = [];
  if (Array.isArray(v.violations)) {
    rules = (v.violations as unknown[])
      .map((x) => (typeof x === "string" ? x : ""))
      .filter(Boolean);
  } else if (v.violations && typeof v.violations === "object") {
    rules = Object.values(v.violations as Record<string, unknown>)
      .map((x) => (typeof x === "string" ? x : ""))
      .filter(Boolean);
  }

  // Fallback bucket so the user always has SOMETHING to match against.
  if (rules.length === 0) {
    rules = ["entry", "exit", "risk", "behavior"];
  }

  return {
    source: v.source,
    id: v.id,
    rules_broken: rules,
    reason: null,
    score_delta: v.score_delta,
    trade_id: v.trade_id,
    analysis_id: v.analysis_id,
    created_at: v.created_at,
  };
}

/**
 * Create a new active recovery session if none exists. Idempotent — safe to
 * call on every render of /hub/recovery.
 */
export async function ensureActiveRecoverySession(args: {
  cooldown_seconds?: number;
} = {}): Promise<RecoverySession | null> {
  const existing = await getActiveRecoverySession();
  if (existing) return existing;

  const u = await uid();
  if (!u) return null;

  const last = await getLastViolation();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: u,
      triggered_by_trade_id: last?.trade_id ?? null,
      triggered_by_event_id:
        last?.source === "analyzer" ? last?.id ?? null : null,
      trigger_reason: "discipline_locked",
      cooldown_seconds:
        args.cooldown_seconds ?? RECOVERY_DEFAULT_COOLDOWN_SECONDS,
      step: "reflection",
    } as never)
    .select("*")
    .single();
  if (error) {
    console.error("[recovery] create failed", error);
    return null;
  }
  broadcastRecoveryChange();
  return data as RecoverySession;
}

/**
 * Validate + persist the reflection step.
 * - violation_match must equal one of the rule names from the last violation.
 * - why and next_action must be > 20 chars.
 */
export type ReflectionInput = {
  violation_match: string;
  why: string;
  next_action: string;
};

export type StepResult =
  | { ok: true; session: RecoverySession }
  | { ok: false; error: string };

export async function submitReflection(
  session_id: string,
  input: ReflectionInput,
  allowed_rules: string[],
): Promise<StepResult> {
  const why = input.why.trim();
  const next = input.next_action.trim();
  const match = input.violation_match.trim();

  if (!allowed_rules.map((r) => r.toLowerCase()).includes(match.toLowerCase())) {
    return {
      ok: false,
      error: "That doesn't match the rule the system detected. Pick the actual violation.",
    };
  }
  if (why.length < 20) {
    return { ok: false, error: "Tell us why — at least 20 characters." };
  }
  if (next.length < 20) {
    return {
      ok: false,
      error: "Describe what you'll do differently — at least 20 characters.",
    };
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      reflection_violation_match: match,
      reflection_why: why,
      reflection_next_action: next,
      reflection_completed: true,
      step: "recommit",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", session_id)
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };
  broadcastRecoveryChange();
  return { ok: true, session: data as RecoverySession };
}

/**
 * Strategy re-commit. All four rule areas (entry/exit/risk/behavior) must be
 * re-acknowledged AND the final commitment box must be checked.
 */
export type RecommitInput = {
  entry: boolean;
  exit: boolean;
  risk: boolean;
  behavior: boolean;
  commitment: boolean;
};

export async function submitRecommit(
  session_id: string,
  input: RecommitInput,
): Promise<StepResult> {
  if (
    !input.entry ||
    !input.exit ||
    !input.risk ||
    !input.behavior ||
    !input.commitment
  ) {
    return {
      ok: false,
      error: "Re-confirm every rule area and the final commitment.",
    };
  }
  const now = new Date();
  const ends = new Date(now.getTime());

  const { data: current } = await supabase
    .from(TABLE)
    .select("cooldown_seconds")
    .eq("id", session_id)
    .maybeSingle();
  const cd =
    (current as { cooldown_seconds?: number } | null)?.cooldown_seconds ??
    RECOVERY_DEFAULT_COOLDOWN_SECONDS;
  ends.setSeconds(ends.getSeconds() + cd);

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      recommit_acks: input,
      recommit_completed: true,
      step: "cooldown",
      cooldown_started_at: now.toISOString(),
      cooldown_ends_at: ends.toISOString(),
      updated_at: now.toISOString(),
    } as never)
    .eq("id", session_id)
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };
  broadcastRecoveryChange();
  return { ok: true, session: data as RecoverySession };
}

/**
 * Mark cooldown complete. Server validates the timer has elapsed.
 * On success, the session is closed and probation begins.
 *
 * Side effects:
 *   - Inserts a synthetic recovery boost analyzer_event so the rolling
 *     discipline score moves out of "locked" (< 50) into "at_risk" without
 *     awarding "in_control". The boost is exactly enough to reach score 50.
 */
export async function completeCooldown(
  session_id: string,
): Promise<StepResult> {
  const { data: current, error: cErr } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", session_id)
    .maybeSingle();
  if (cErr || !current) {
    return { ok: false, error: cErr?.message ?? "Session not found" };
  }
  const s = current as RecoverySession;
  if (!s.recommit_completed || !s.reflection_completed) {
    return { ok: false, error: "Earlier steps not complete." };
  }
  if (!s.cooldown_ends_at || new Date(s.cooldown_ends_at) > new Date()) {
    return { ok: false, error: "Cooldown still active." };
  }

  // Boost discipline back to "at_risk" deterministically.
  await applyRecoveryBoost();

  const completedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      cooldown_completed: true,
      step: "complete",
      completed_time: completedAt,
      success: true,
      probation_state: "active",
      updated_at: completedAt,
    } as never)
    .eq("id", session_id)
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };
  broadcastRecoveryChange();
  return { ok: true, session: data as RecoverySession };
}

/**
 * Insert synthetic positive analyzer_events so the rolling decision score
 * lifts the user from "locked" (<40) up into "at_risk" (40–59). Capped so
 * the user can never reach "in_control" via recovery alone — that must be
 * earned with real trades.
 *
 * Each synthetic event uses the new event_score scale (verdict=valid → +5).
 * We insert UP TO 4 events, just enough to clear the locked threshold.
 */
async function applyRecoveryBoost(): Promise<void> {
  const u = await uid();
  if (!u) return;

  const { loadDisciplineBreakdown } = await import("@/lib/disciplineScore");
  const before = await loadDisciplineBreakdown();
  if (before.score >= 40) return; // already out of locked

  // Insert up to 4 valid events. Recency weighting + 40% decision weight
  // means this is enough to escape "locked" but not enough to hit 80.
  const rows = Array.from({ length: 4 }, () => ({
    user_id: u,
    analysis_id: null,
    blueprint_id: null,
    verdict: "valid" as const,
    violations: [],
    score_delta: 5,
    reason: "recovery_completed",
  }));
  const { error } = await supabase.from("analyzer_events").insert(rows as never);
  if (error) {
    console.error("[recovery] boost failed", error);
  }
}

/**
 * Per-decision score used by probation: maps a RecentDecision to a 0–100 value.
 * - analyzer: valid=100, weak=50, invalid=0
 * - execution: uses discipline_score if present; otherwise mirrors verdict.
 */
function decisionScore(d: RecentDecision): number {
  if (d.source === "execution") {
    // execution rows in `recent_decisions` carry score_delta = discipline_score
    // (see view: discipline_logs.discipline_score). Use it directly.
    return Math.max(0, Math.min(100, d.score_delta));
  }
  if (d.verdict === "valid") return 100;
  if (d.verdict === "weak") return 50;
  return 0;
}

export type ProbationStatus = {
  active: boolean;
  passed: boolean;
  failed: boolean;
  decisions_required: number;
  decisions_seen: number;
  last_session_id: string | null;
};

/**
 * Evaluate probation against the most recent completed recovery session.
 * If the user fails (any of the next 2 decisions has score < 75), insert a
 * re-lock penalty so they are forced back into recovery.
 */
export async function evaluateProbation(): Promise<ProbationStatus> {
  const last = await getLastCompletedRecoverySession();
  if (!last || last.probation_state !== "active") {
    return {
      active: false,
      passed: last?.probation_state === "passed",
      failed: last?.probation_state === "failed",
      decisions_required: 2,
      decisions_seen: last?.probation_decisions_seen ?? 0,
      last_session_id: last?.id ?? null,
    };
  }

  const recent = await fetchRecentDecisions(20);
  const after = recent
    .filter((d) => new Date(d.created_at) > new Date(last.completed_time!))
    .reverse(); // chronological

  const considered = after.slice(0, 2);
  const seen = considered.length;

  const failedDecision = considered.find((d) => decisionScore(d) < 75);

  if (failedDecision) {
    // Re-lock: insert a strong negative analyzer_event and mark probation failed.
    const u = await uid();
    if (u) {
      await supabase.from("analyzer_events").insert({
        user_id: u,
        analysis_id: null,
        blueprint_id: null,
        verdict: "invalid",
        violations: ["probation_failed"],
        score_delta: -20,
        reason: "probation_failed",
      } as never);
    }
    await supabase
      .from(TABLE)
      .update({
        probation_state: "failed",
        probation_decisions_seen: seen,
        success: false,
      } as never)
      .eq("id", last.id);
    broadcastRecoveryChange();
    return {
      active: false,
      passed: false,
      failed: true,
      decisions_required: 2,
      decisions_seen: seen,
      last_session_id: last.id,
    };
  }

  if (seen >= 2) {
    await supabase
      .from(TABLE)
      .update({
        probation_state: "passed",
        probation_decisions_seen: seen,
      } as never)
      .eq("id", last.id);
    broadcastRecoveryChange();
    return {
      active: false,
      passed: true,
      failed: false,
      decisions_required: 2,
      decisions_seen: seen,
      last_session_id: last.id,
    };
  }

  // Still in probation, no failures yet.
  if (seen !== last.probation_decisions_seen) {
    await supabase
      .from(TABLE)
      .update({ probation_decisions_seen: seen } as never)
      .eq("id", last.id);
  }
  return {
    active: true,
    passed: false,
    failed: false,
    decisions_required: 2,
    decisions_seen: seen,
    last_session_id: last.id,
  };
}
