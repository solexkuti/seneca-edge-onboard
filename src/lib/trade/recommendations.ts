/**
 * Recommendations Engine
 *
 * Turns top rule violations into specific, actionable next steps the
 * user can commit to. Pure intelligence — never blocks, never enforces.
 *
 *   ruleViolations(trades) → Recommendation[]
 *
 * Each recommendation is deterministic and stable across renders so the
 * UI can persist a "focus" flag against `recommendation.id` in localStorage.
 */

import { ruleViolations, type RuleViolationRow } from "./analysis";
import type { Trade } from "./types";

export type RecommendationCategory =
  | "risk"
  | "entry"
  | "exit"
  | "behavior"
  | "discipline";

export type RecommendationPriority = "critical" | "high" | "medium" | "low";

export interface Recommendation {
  /** Stable id derived from the rule text — safe to persist. */
  id: string;
  /** Original rule text from the violation. */
  rule: string;
  /** Short imperative title (≤ 60 chars). */
  title: string;
  /** Detailed action the user should take next. */
  action: string;
  /** Why this matters — grounded in their own data. */
  why: string;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  timesBroken: number;
  totalImpactR: number;
  evidenceTradeIds: string[];
}

const SLUG_RE = /[^a-z0-9]+/g;

function slugify(s: string): string {
  return s.toLowerCase().replace(SLUG_RE, "-").replace(/^-|-$/g, "");
}

function categorize(rule: string): RecommendationCategory {
  const r = rule.toLowerCase();
  if (/(risk|size|lot|leverage|exposure|account)/.test(r)) return "risk";
  if (/(stop|sl|tp|target|exit|trail|breakeven|partial)/.test(r)) return "exit";
  if (/(entry|setup|confirm|trigger|signal|wait|chase|fomo)/.test(r))
    return "entry";
  if (/(revenge|tilt|emotion|impulse|overtrad|fomo|patience)/.test(r))
    return "behavior";
  return "discipline";
}

function priorityFor(row: RuleViolationRow): RecommendationPriority {
  // Critical: high frequency AND meaningful R drag.
  if (row.timesBroken >= 4 && row.totalImpactR <= -2) return "critical";
  if (row.timesBroken >= 3 || row.totalImpactR <= -2) return "high";
  if (row.timesBroken >= 2 || row.totalImpactR < 0) return "medium";
  return "low";
}

function buildAction(rule: string, category: RecommendationCategory): string {
  switch (category) {
    case "risk":
      return `Before your next entry, write down your risk in R and confirm it matches the plan. If it doesn't, the trade does not get taken.`;
    case "exit":
      return `Pre-define stop-loss and take-profit before entry — no exceptions. If you can't define them, the setup isn't ready.`;
    case "entry":
      return `Wait for full confirmation. If you find yourself entering without it, close the chart for 10 minutes and re-evaluate.`;
    case "behavior":
      return `Add a 2-minute cooldown between trades. If the urge to re-enter is emotional, that pause will expose it.`;
    default:
      return `Re-read this rule out loud before your next session and acknowledge it in your daily checklist.`;
  }
}

function buildTitle(rule: string, category: RecommendationCategory): string {
  const base = rule.length <= 56 ? rule : `${rule.slice(0, 53)}…`;
  switch (category) {
    case "risk":
      return `Re-anchor risk: ${base}`;
    case "exit":
      return `Pre-define exit: ${base}`;
    case "entry":
      return `Wait for confirmation: ${base}`;
    case "behavior":
      return `Cool the trigger: ${base}`;
    default:
      return `Re-commit: ${base}`;
  }
}

function buildWhy(row: RuleViolationRow): string {
  const r = row.totalImpactR;
  const sign = r > 0 ? "+" : "";
  const impact = `${sign}${r.toFixed(1)}R`;
  if (row.timesBroken === 1) {
    return `Broken once for ${impact}. One slip is the signal — patch it before it becomes a pattern.`;
  }
  return `Broken ${row.timesBroken} times for ${impact}. This is the single biggest leak in your edge right now.`;
}

export function generateRecommendations(trades: Trade[]): Recommendation[] {
  const rows = ruleViolations(trades);
  // Only the violations that actually cost something or repeat.
  const meaningful = rows.filter(
    (r) => r.timesBroken >= 1 && (r.timesBroken >= 2 || r.totalImpactR < 0),
  );
  return meaningful.slice(0, 6).map((row) => {
    const category = categorize(row.rule);
    return {
      id: `rec-${slugify(row.rule)}`,
      rule: row.rule,
      title: buildTitle(row.rule, category),
      action: buildAction(row.rule, category),
      why: buildWhy(row),
      category,
      priority: priorityFor(row),
      timesBroken: row.timesBroken,
      totalImpactR: row.totalImpactR,
      evidenceTradeIds: row.trades.map((t) => t.id),
    };
  });
}
