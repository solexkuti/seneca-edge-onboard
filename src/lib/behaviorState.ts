// Simulated behavioral intelligence — pure conditional logic, no backend.
// Rotates messages within each state to feel alive.

export type BehaviorStateKey = "new" | "controlled" | "warning" | "danger";

export type BehaviorMetrics = {
  trades_count: number;
  rule_breaks: number;
  trades_per_hour: number;
};

export type BehaviorState = {
  key: BehaviorStateKey;
  label: string;
  tone: "neutral" | "calm" | "warning" | "danger";
  messages: string[];
  liveSignals: string[];
};

export const BEHAVIOR_STATES: Record<BehaviorStateKey, BehaviorState> = {
  new: {
    key: "new",
    label: "Awaiting first decision",
    tone: "neutral",
    messages: [
      "No data yet. Your edge starts with your first decision.",
      "You haven’t taken a trade. Clarity comes before action.",
      "The system is ready. It will learn from how you behave.",
    ],
    liveSignals: ["System idle", "Listening for behavior"],
  },
  controlled: {
    key: "controlled",
    label: "In control",
    tone: "calm",
    messages: [
      "You are following your plan. Stay consistent.",
      "Execution is clean. Maintain it.",
      "Behavior aligned with your rules. Keep the rhythm.",
    ],
    liveSignals: ["Discipline improving", "Execution clean", "Rhythm steady"],
  },
  warning: {
    key: "warning",
    label: "Slight deviation",
    tone: "warning",
    messages: [
      "You’re starting to deviate. Stay aligned with your rules.",
      "Small mistakes compound. Stay aware.",
      "Your frequency is climbing. Slow down before it costs you.",
    ],
    liveSignals: [
      "Rule deviation detected",
      "Frequency rising",
      "Awareness drop",
    ],
  },
  danger: {
    key: "danger",
    label: "Reactive behavior",
    tone: "danger",
    messages: [
      "You are trading emotionally. Pause.",
      "Right now, you are reacting. Not executing.",
      "Your behavior shows impulse. Step away from the chart.",
    ],
    liveSignals: [
      "Overtrading risk detected",
      "Impulse pattern detected",
      "Multiple rule breaks",
    ],
  },
};

export function deriveBehaviorState(m: BehaviorMetrics): BehaviorStateKey {
  if (m.trades_count <= 0) return "new";
  if (m.rule_breaks >= 3 || m.trades_per_hour >= 4) return "danger";
  if (m.rule_breaks >= 1 || m.trades_per_hour >= 2) return "warning";
  return "controlled";
}

export function pickRandom<T>(arr: T[], seed?: number): T {
  if (arr.length === 0) throw new Error("empty array");
  const i =
    seed === undefined
      ? Math.floor(Math.random() * arr.length)
      : seed % arr.length;
  return arr[i];
}

// Mock metrics — simulate a "controlled but warning-edge" trader so the UI
// feels alive on first load. Replace with real data later.
export const MOCK_METRICS: BehaviorMetrics = {
  trades_count: 6,
  rule_breaks: 1,
  trades_per_hour: 1,
};

// Rotation of feature copy variants (for Chart Analyzer)
export const CHART_DESCRIPTIONS = [
  "Upload your chart. Get a decision based on your rules.",
  "See what you missed before you enter.",
  "Your chart, your rules, clear decision.",
];
