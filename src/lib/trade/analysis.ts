/**
 * Analysis Engine
 *
 * Pure functions that take a `Trade[]` and produce structured behavioral
 * intelligence. No database access, no side effects — every UI surface
 * (dashboard, behavior breakdown, insights) consumes these outputs.
 *
 * Phase 1 ships the function signatures + working implementations against
 * the unified Trade type. Real-world tuning happens as the data grows.
 */

import type { Trade, TradeSession } from "./types";

// ---------- Summary ----------

export interface TradeSummary {
  totalTrades: number;
  executedCount: number;
  missedCount: number;
  winRate: number; // 0–1
  avgR: number;
  totalR: number;
}

export function summarize(trades: Trade[]): TradeSummary {
  const executed = trades.filter((t) => t.tradeType === "executed");
  const wins = executed.filter((t) => (t.resultR ?? 0) > 0).length;
  const totalR = executed.reduce((sum, t) => sum + (t.resultR ?? 0), 0);
  return {
    totalTrades: trades.length,
    executedCount: executed.length,
    missedCount: trades.filter((t) => t.tradeType === "missed").length,
    winRate: executed.length ? wins / executed.length : 0,
    avgR: executed.length ? totalR / executed.length : 0,
    totalR,
  };
}

// ---------- Behavior score ----------

export interface BehaviorScore {
  score: number; // 0–100
  label: "controlled" | "drifting" | "inconsistent";
  description: string;
}

export function behaviorScore(trades: Trade[]): BehaviorScore {
  const executed = trades.filter((t) => t.tradeType === "executed");
  if (!executed.length) {
    return {
      score: 0,
      label: "drifting",
      description: "Not enough trades to score yet.",
    };
  }
  // Adherence ratio + emotional ratio
  const clean = executed.filter((t) => t.rulesBroken.length === 0).length;
  const controlled = executed.filter((t) => t.executionType === "controlled").length;
  const adherence = clean / executed.length; // 0–1
  const control = controlled / executed.length; // 0–1
  const score = Math.round(adherence * 70 + control * 30);

  let label: BehaviorScore["label"] = "drifting";
  let description = "Some discipline drift — review your last violations.";
  if (score >= 80) {
    label = "controlled";
    description = "Controlled execution. System trades dominate.";
  } else if (score < 50) {
    label = "inconsistent";
    description = "High inconsistency — emotion is leading.";
  }

  return { score, label, description };
}

// ---------- Rule adherence ----------

export interface RuleAdherence {
  pct: number; // 0–1
  cleanTrades: number;
  totalTrades: number;
}

export function ruleAdherence(trades: Trade[]): RuleAdherence {
  const executed = trades.filter((t) => t.tradeType === "executed");
  const clean = executed.filter((t) => t.rulesBroken.length === 0).length;
  return {
    pct: executed.length ? clean / executed.length : 0,
    cleanTrades: clean,
    totalTrades: executed.length,
  };
}

// ---------- Rule violations ----------

export interface RuleViolationRow {
  rule: string;
  timesBroken: number;
  lastBrokenAt: string | null;
  totalImpactR: number;
  trades: Trade[];
}

export function ruleViolations(trades: Trade[]): RuleViolationRow[] {
  const map = new Map<string, RuleViolationRow>();
  for (const t of trades) {
    if (t.tradeType !== "executed") continue;
    for (const rule of t.rulesBroken) {
      const row = map.get(rule) ?? {
        rule,
        timesBroken: 0,
        lastBrokenAt: null,
        totalImpactR: 0,
        trades: [] as Trade[],
      };
      row.timesBroken += 1;
      row.totalImpactR += t.resultR ?? 0;
      if (!row.lastBrokenAt || t.createdAt > row.lastBrokenAt) {
        row.lastBrokenAt = t.createdAt;
      }
      row.trades.push(t);
      map.set(rule, row);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => a.totalImpactR - b.totalImpactR, // worst impact first (most negative)
  );
}

// ---------- Execution type split ----------

export interface ExecutionSplit {
  controlledPct: number; // 0–1
  emotionalPct: number; // 0–1
  controlledCount: number;
  emotionalCount: number;
}

export function executionSplit(trades: Trade[]): ExecutionSplit {
  const executed = trades.filter((t) => t.tradeType === "executed");
  const controlled = executed.filter((t) => t.executionType === "controlled").length;
  const emotional = executed.filter((t) => t.executionType === "emotional").length;
  const total = controlled + emotional;
  return {
    controlledPct: total ? controlled / total : 0,
    emotionalPct: total ? emotional / total : 0,
    controlledCount: controlled,
    emotionalCount: emotional,
  };
}

// ---------- Session performance ----------

export interface SessionPerformance {
  session: TradeSession;
  trades: number;
  winRate: number;
  totalR: number;
  behaviorLabel: "Controlled" | "Overtrading" | "Random";
}

export function sessionPerformance(trades: Trade[]): SessionPerformance[] {
  const sessions: TradeSession[] = ["London", "NY", "Asia"];
  return sessions.map((session) => {
    const ts = trades.filter(
      (t) => t.tradeType === "executed" && t.session === session,
    );
    const wins = ts.filter((t) => (t.resultR ?? 0) > 0).length;
    const totalR = ts.reduce((s, t) => s + (t.resultR ?? 0), 0);
    const broken = ts.filter((t) => t.rulesBroken.length > 0).length;
    const cleanRatio = ts.length ? 1 - broken / ts.length : 0;

    let behaviorLabel: SessionPerformance["behaviorLabel"] = "Random";
    if (cleanRatio >= 0.7) behaviorLabel = "Controlled";
    else if (ts.length >= 5 && cleanRatio < 0.4) behaviorLabel = "Overtrading";

    return {
      session,
      trades: ts.length,
      winRate: ts.length ? wins / ts.length : 0,
      totalR,
      behaviorLabel,
    };
  });
}

// ---------- Asset behavior ----------

export interface AssetBehavior {
  asset: string;
  trades: number;
  winRate: number;
  totalR: number;
  label: "disciplined" | "emotional" | "inconsistent";
}

export function assetBehavior(trades: Trade[]): AssetBehavior[] {
  const map = new Map<string, Trade[]>();
  for (const t of trades) {
    if (t.tradeType !== "executed") continue;
    const list = map.get(t.asset) ?? [];
    list.push(t);
    map.set(t.asset, list);
  }
  return Array.from(map.entries())
    .map(([asset, ts]) => {
      const wins = ts.filter((t) => (t.resultR ?? 0) > 0).length;
      const totalR = ts.reduce((s, t) => s + (t.resultR ?? 0), 0);
      const cleanRatio =
        ts.filter((t) => t.rulesBroken.length === 0).length / ts.length;
      const emotionalRatio =
        ts.filter((t) => t.executionType === "emotional").length / ts.length;

      let label: AssetBehavior["label"] = "inconsistent";
      if (cleanRatio >= 0.7 && emotionalRatio < 0.3) label = "disciplined";
      else if (emotionalRatio >= 0.5) label = "emotional";

      return {
        asset,
        trades: ts.length,
        winRate: wins / ts.length,
        totalR,
        label,
      };
    })
    .sort((a, b) => b.trades - a.trades);
}
