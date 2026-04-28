// Psychological Pressure Layer — deterministic friction applied before a
// trade is logged. No randomness, no AI variation. Same situation always
// produces the same intercept.
//
// Triggered when ANY of:
//   - discipline.state !== "in_control"
//   - last analyzer event is not VALID_CLEAN
//   - checklist not confirmed
//   - last 3 events include ≥ 2 INVALID/CRITICAL_INVALID
//   - user attempts trade within cooldown window (recovery active)
//
// Skipped (fast flow) when:
//   - in_control + last event VALID_CLEAN (or no events) + checklist confirmed
//
// Escalation: after 3 intercepts in a session, hold time grows from 3s → 5s.

import { supabase } from "@/integrations/supabase/client";
import type { TraderState } from "@/lib/traderState";
import { classifyEvent, type EventClass } from "@/lib/disciplineScore";
import type { RecentDecision } from "@/lib/analyzerEvents";

// ── Constants ──────────────────────────────────────────────────────────

export const BASE_HOLD_SECONDS = 3;
export const ESCALATED_HOLD_SECONDS = 5;
export const ESCALATION_THRESHOLD = 3;
const SESSION_KEY = "seneca:pressure:escalation";

// ── Types ──────────────────────────────────────────────────────────────

export type PressureTrigger =
  | "discipline_state"
  | "invalid_setup"
  | "checklist_unconfirmed"
  | "repeated_invalid"
  | "in_recovery";

export type PressureSeverity = "low" | "medium" | "high";

export type ConsequencePreview = {
  tone: "ok" | "warn" | "danger";
  headline: string;
  /** Plain-English impact range, deterministic. */
  body: string;
  /** State the user could fall into if they slip. */
  state_risk: string | null;
};

export type PressureEvaluation = {
  active: boolean;
  triggers: PressureTrigger[];
  /** Single primary trigger used for logging + headline. */
  primary: PressureTrigger | null;
  severity: PressureSeverity;
  hold_seconds: number;
  /** Forces the user to tick re-affirmation checkboxes. */
  requires_affirm: boolean;
  /** Last analyzer classification, if any (for context block). */
  last_event_klass: EventClass | null;
  last_event_reason: string | null;
  /** Already-formatted consequence block. */
  preview: ConsequencePreview;
  /** Read-only snapshot for the context block. */
  context: {
    discipline_score: number;
    discipline_state: TraderState["discipline"]["state"];
    checklist_confirmed: boolean;
  };
  /** Current escalation level (0, 1, 2…). */
  escalation_level: number;
};

// ── Session escalation counter ─────────────────────────────────────────

function readEscalation(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
  } catch {
    return 0;
  }
}

function writeEscalation(n: number): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, String(n));
  } catch {
    // ignore
  }
}

/** Bump escalation counter when an intercept is shown. */
export function bumpPressureEscalation(): number {
  const next = readEscalation() + 1;
  writeEscalation(next);
  return next;
}

export function resetPressureEscalation(): void {
  writeEscalation(0);
}

export function currentPressureEscalation(): number {
  return readEscalation();
}

// ── Classification helpers ─────────────────────────────────────────────

function classifyDecision(d: RecentDecision): EventClass | null {
  if (d.source !== "analyzer") return null;
  // RecentDecision verdict is "valid" | "weak" | "invalid"
  return classifyEvent(d.verdict, d.violations);
}

function reasonForKlass(k: EventClass): string {
  switch (k) {
    case "valid_clean":
      return "Last analysis was a clean valid setup.";
    case "valid_weak":
      return "Last analysis was valid but missing confluence.";
    case "invalid":
      return "Last analysis broke 1–2 rules.";
    case "critical_invalid":
      return "Last analysis was a critical violation (against trend / random entry).";
  }
}

// ── Core evaluation ────────────────────────────────────────────────────

export function evaluatePressure(state: TraderState): PressureEvaluation {
  const triggers: PressureTrigger[] = [];

  // 1) Discipline state
  if (state.discipline.state !== "in_control") {
    triggers.push("discipline_state");
  }

  // 2) Checklist unconfirmed
  if (!state.session.checklist_confirmed) {
    triggers.push("checklist_unconfirmed");
  }

  // 3) Recovery / cooldown
  if (state.blocks.in_recovery || state.recovery.active_session) {
    triggers.push("in_recovery");
  }

  // 4) Last analyzer event quality
  const analyzerDecisions = state.discipline.recent.filter(
    (d) => d.source === "analyzer",
  );
  const lastAnalyzer = analyzerDecisions[0];
  const lastKlass = lastAnalyzer ? classifyDecision(lastAnalyzer) : null;
  if (lastKlass && lastKlass !== "valid_clean") {
    triggers.push("invalid_setup");
  }

  // 5) Repeated invalid: ≥ 2 of last 3 analyzer events are INVALID/CRITICAL
  const last3 = analyzerDecisions.slice(0, 3);
  const last3Bad = last3.filter((d) => {
    const k = classifyDecision(d);
    return k === "invalid" || k === "critical_invalid";
  }).length;
  if (last3Bad >= 2) {
    triggers.push("repeated_invalid");
  }

  // ── Severity ─────────────────────────────────────────────────────────
  let severity: PressureSeverity = "low";
  if (triggers.includes("in_recovery")) severity = "high";
  else if (
    triggers.includes("repeated_invalid") ||
    state.discipline.state === "locked" ||
    state.discipline.state === "at_risk" ||
    lastKlass === "critical_invalid"
  ) {
    severity = "high";
  } else if (triggers.length >= 2 || lastKlass === "invalid") {
    severity = "medium";
  } else if (triggers.length >= 1) {
    severity = "low";
  }

  // ── Hold time + affirmation ──────────────────────────────────────────
  const escalation = readEscalation();
  const baseHold =
    escalation >= ESCALATION_THRESHOLD
      ? ESCALATED_HOLD_SECONDS
      : BASE_HOLD_SECONDS;
  const hold_seconds = severity === "high" ? Math.max(baseHold, 5) : baseHold;
  const requires_affirm =
    triggers.includes("invalid_setup") ||
    triggers.includes("repeated_invalid") ||
    severity === "high";

  // ── Primary trigger (priority order) ─────────────────────────────────
  const primary: PressureTrigger | null =
    triggers.find((t) => t === "in_recovery") ??
    triggers.find((t) => t === "repeated_invalid") ??
    triggers.find((t) => t === "checklist_unconfirmed") ??
    triggers.find((t) => t === "invalid_setup") ??
    triggers.find((t) => t === "discipline_state") ??
    null;

  // ── Consequence preview ──────────────────────────────────────────────
  const preview = buildPreview({
    state,
    lastKlass,
    severity,
    triggers,
  });

  return {
    active: triggers.length > 0,
    triggers,
    primary,
    severity,
    hold_seconds,
    requires_affirm,
    last_event_klass: lastKlass,
    last_event_reason: lastAnalyzer?.violations
      ? reasonForKlass(lastKlass ?? "valid_clean")
      : null,
    preview,
    context: {
      discipline_score: state.discipline.score,
      discipline_state: state.discipline.state,
      checklist_confirmed: state.session.checklist_confirmed,
    },
    escalation_level: escalation,
  };
}

// ── Consequence preview (deterministic copy) ───────────────────────────

function buildPreview(args: {
  state: TraderState;
  lastKlass: EventClass | null;
  severity: PressureSeverity;
  triggers: PressureTrigger[];
}): ConsequencePreview {
  const { state, lastKlass, severity, triggers } = args;

  if (lastKlass === "valid_clean" && severity === "low" && triggers.length === 0) {
    return {
      tone: "ok",
      headline: "Clean execution keeps you in control",
      body: "If you follow the plan, this trade has no negative impact on your discipline score.",
      state_risk: null,
    };
  }

  // Compute a deterministic "if you slip" range.
  const score = state.discipline.score;
  let penaltyMin = -5;
  let penaltyMax = -10;
  if (severity === "low") {
    penaltyMin = 0;
    penaltyMax = -5;
  }
  if (severity === "high") {
    penaltyMin = -5;
    penaltyMax = -10;
  }

  // Project worst-case state if penalty lands at the upper bound.
  let projected = score + penaltyMax * 0.4; // decision weight
  projected = Math.max(0, Math.round(projected));
  let nextState: string;
  if (projected >= 80) nextState = "IN CONTROL";
  else if (projected >= 60) nextState = "SLIPPING";
  else if (projected >= 40) nextState = "AT RISK";
  else nextState = "LOCKED";

  const headline =
    severity === "high"
      ? "High-risk decision"
      : severity === "medium"
        ? "Slow down — caution required"
        : "Confirm with intent";

  const body =
    `If this trade violates your rules, your discipline score will drop ` +
    `${penaltyMax} to ${penaltyMin} points. Projected state: ${nextState} (${projected}/100).`;

  const state_risk = nextState === state.discipline.state.toUpperCase().replace("_", " ")
    ? null
    : `May drop to ${nextState}`;

  return {
    tone: severity === "high" ? "danger" : "warn",
    headline,
    body,
    state_risk,
  };
}

// ── Logging ────────────────────────────────────────────────────────────

export type LogPressureArgs = {
  evaluation: PressureEvaluation;
  proceeded: boolean;
  surface?: string;
};

export async function logPressureEvent(args: LogPressureArgs): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return;

  const e = args.evaluation;
  const { error } = await supabase.from("pressure_events").insert({
    user_id: uid,
    surface: args.surface ?? "journal_log",
    trigger_reason: e.primary ?? "unknown",
    triggers: e.triggers,
    proceeded: args.proceeded,
    hold_seconds: e.hold_seconds,
    escalation_level: e.escalation_level,
    last_event_klass: e.last_event_klass,
    discipline_state: e.context.discipline_state,
    discipline_score: e.context.discipline_score,
  } as never);

  if (error) {
    console.error("[pressure] log failed:", error);
  }
}

// ── Trigger labels for UI ──────────────────────────────────────────────

export const TRIGGER_LABEL: Record<PressureTrigger, string> = {
  discipline_state: "Discipline state below in-control",
  invalid_setup: "Last setup was not VALID_CLEAN",
  checklist_unconfirmed: "Daily checklist not confirmed",
  repeated_invalid: "2+ invalid setups in your last 3",
  in_recovery: "Recovery cooldown still active",
};
