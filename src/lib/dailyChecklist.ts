// ============================================================================
// Daily Checklist — Deterministic Strictness Engine
// ----------------------------------------------------------------------------
// Pure, synchronous logic. NO AI, NO network. The AI layer (in the edge
// function) consumes this output for wording only — it cannot change rules,
// restrictions, or control state.
// ============================================================================

export type ControlState = "in_control" | "at_risk" | "out_of_control";

export type BehaviorPatternKind =
  | "overtrading"
  | "early_exit"
  | "revenge"
  | "undisciplined_streak"
  | "rule_breaking_entry"
  | "rule_breaking_exit"
  | "rule_breaking_risk"
  | "rule_breaking_behavior"
  | "consecutive_losses_after_break";

export type DailyChecklistInput = {
  strategy_rules: {
    entry: string[];
    exit: string[];
    risk: string[];
    behavior: string[];
  };
  discipline_score: number; // 0–100, average of last 20 trades
  last_20_trades_count: number;
  current_streak: number; // consecutive disciplined trades
  behavior_patterns: BehaviorPatternKind[];
};

export type AdaptiveRule = {
  text: string;
  source: "behavior_pattern" | "control_state";
};

export type DailyChecklistComputed = {
  control_state: ControlState;
  discipline_score: number;
  current_streak: number;
  allowed_tiers: ("A+" | "B+" | "C")[];
  adaptive_rules: AdaptiveRule[];
  weak_categories: ("entry" | "exit" | "risk" | "behavior")[];
  pause_required: boolean;
  delay_minutes: number;
  suggest_no_trade_day: boolean;
  hard_rules: string[];
  self_check_questions: string[];
  insufficient_data: boolean;
};

export function computeControlState(score: number): ControlState {
  if (!Number.isFinite(score)) return "out_of_control";
  if (score >= 85) return "in_control";
  if (score >= 60) return "at_risk";
  return "out_of_control";
}

const PATTERN_TO_RULE: Record<BehaviorPatternKind, string> = {
  overtrading: "Maximum 2 trades today. Stop after the second, win or lose.",
  early_exit:
    "No manual exit before TP unless invalidation occurs. Define invalidation in writing.",
  revenge:
    "No re-entry after a loss without completing the full checklist from scratch.",
  undisciplined_streak:
    "You have broken your system multiple times in a row. Take only one trade today.",
  rule_breaking_entry:
    "Read your entry rule out loud before clicking. Screenshot the setup first.",
  rule_breaking_exit:
    "Exit only at predefined TP or SL. No discretionary closes.",
  rule_breaking_risk:
    "Recalculate position size before every entry. Risk must match the plan exactly.",
  rule_breaking_behavior:
    "If you feel urgency, walk away for 10 minutes before placing the order.",
  consecutive_losses_after_break:
    "Two losses already followed a rule break. Stop trading for the rest of the session.",
};

const HARD_RULES_BASE = [
  "No setup = no trade.",
  "No emotional execution. If you feel rushed, you stop.",
  "Risk must be predefined before the entry, not after.",
  "If a rule is unclear in the moment, the answer is no.",
];

const SELF_CHECK_QUESTIONS = [
  "Am I following my system, or am I improvising?",
  "Am I forcing this trade because I want action?",
  "Would I take this exact setup yesterday, with no P&L pressure?",
  "Have I confirmed my risk in dollars before clicking?",
];

export function computeDailyChecklist(
  input: DailyChecklistInput,
): DailyChecklistComputed {
  const insufficient_data = input.last_20_trades_count < 3;
  const score = Math.max(0, Math.min(100, Math.round(input.discipline_score)));
  const state = computeControlState(score);

  // Allowed tiers per state
  let allowed_tiers: ("A+" | "B+" | "C")[];
  if (state === "in_control") allowed_tiers = ["A+", "B+", "C"];
  else if (state === "at_risk") allowed_tiers = ["A+", "B+"];
  else allowed_tiers = ["A+"];

  const pause_required = state !== "in_control";
  const delay_minutes = state === "out_of_control" ? 5 : 0;

  // Weak categories from rule_breaking_* patterns
  const weak_categories: ("entry" | "exit" | "risk" | "behavior")[] = [];
  for (const p of input.behavior_patterns) {
    if (p === "rule_breaking_entry") weak_categories.push("entry");
    if (p === "rule_breaking_exit") weak_categories.push("exit");
    if (p === "rule_breaking_risk") weak_categories.push("risk");
    if (p === "rule_breaking_behavior") weak_categories.push("behavior");
  }

  // Adaptive rules — deterministic injection
  const adaptive_rules: AdaptiveRule[] = [];
  const seen = new Set<string>();
  for (const p of input.behavior_patterns) {
    const text = PATTERN_TO_RULE[p];
    if (text && !seen.has(text)) {
      adaptive_rules.push({ text, source: "behavior_pattern" });
      seen.add(text);
    }
  }
  if (state === "at_risk") {
    const t = "Pause and re-read the checklist out loud before any entry.";
    if (!seen.has(t)) {
      adaptive_rules.push({ text: t, source: "control_state" });
      seen.add(t);
    }
  }
  if (state === "out_of_control") {
    const items = [
      "Only A+ setups allowed today. Anything less is a no.",
      "Wait 5 minutes between identifying a setup and executing it.",
      "Maximum 1 trade today. Stop regardless of outcome.",
    ];
    for (const t of items) {
      if (!seen.has(t)) {
        adaptive_rules.push({ text: t, source: "control_state" });
        seen.add(t);
      }
    }
  }

  const suggest_no_trade_day =
    state === "out_of_control" &&
    input.behavior_patterns.some(
      (p) =>
        p === "consecutive_losses_after_break" || p === "undisciplined_streak",
    );

  return {
    control_state: state,
    discipline_score: score,
    current_streak: Math.max(0, Math.floor(input.current_streak || 0)),
    allowed_tiers,
    adaptive_rules,
    weak_categories: Array.from(new Set(weak_categories)),
    pause_required,
    delay_minutes,
    suggest_no_trade_day,
    hard_rules: HARD_RULES_BASE,
    self_check_questions: SELF_CHECK_QUESTIONS.slice(0, 3),
    insufficient_data,
  };
}
