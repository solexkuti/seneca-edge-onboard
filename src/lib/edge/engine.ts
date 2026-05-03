// Seneca Edge — behavior engine.
//
// Pure functions. Given a user's trades + rule_violations, this module
// returns the answer to the core question:
//
//     "What is my strategy capable of vs what am I actually doing?"
//
// Nothing in here touches the network or the DOM — it's safe to unit-test
// and safe to run on the server or the client.

import {
  EdgeBlock,
  EdgeReport,
  Pattern,
  RuleViolationRow,
  SessionPerf,
  TradeRow,
  ViolationImpact,
  isExecuted,
  isMissed,
  isSystemTrade,
} from "./types";

const safeNum = (n: number | null | undefined, fallback = 0): number =>
  typeof n === "number" && Number.isFinite(n) ? n : fallback;

/** R for a single trade. Prefers `rr` (closed R-multiple); falls back to risk_r-derived pnl. */
function tradeR(t: TradeRow): number {
  if (typeof t.rr === "number" && Number.isFinite(t.rr)) return t.rr;
  if (
    typeof t.pnl === "number" &&
    typeof t.risk_r === "number" &&
    t.risk_r !== 0
  ) {
    return t.pnl / Math.abs(t.risk_r);
  }
  if (t.result === "win") return 1;
  if (t.result === "loss") return -1;
  return 0;
}

function buildEdge(trades: TradeRow[]): EdgeBlock {
  const closed = trades.filter((t) => t.result === "win" || t.result === "loss");
  const sample = closed.length;
  if (sample === 0) return { sample: 0, winRate: 0, avgR: 0, totalR: 0 };
  const wins = closed.filter((t) => t.result === "win").length;
  const totalR = closed.reduce((acc, t) => acc + tradeR(t), 0);
  return {
    sample,
    winRate: (wins / sample) * 100,
    avgR: totalR / sample,
    totalR,
  };
}

function rankViolations(violations: RuleViolationRow[]): ViolationImpact[] {
  const groups = new Map<string, ViolationImpact>();
  for (const v of violations) {
    const key = v.type || "unknown";
    const cur = groups.get(key) ?? {
      type: key,
      count: 0,
      totalImpactR: 0,
      avgImpactR: 0,
      lastOccurredAt: null as string | null,
    };
    cur.count += 1;
    cur.totalImpactR += safeNum(v.impact_r, 0);
    if (!cur.lastOccurredAt || v.occurred_at > cur.lastOccurredAt) {
      cur.lastOccurredAt = v.occurred_at;
    }
    groups.set(key, cur);
  }
  for (const v of groups.values()) v.avgImpactR = v.count ? v.totalImpactR / v.count : 0;
  // Sort by impact magnitude (most damaging first), tiebreak on count
  return Array.from(groups.values()).sort((a, b) => {
    const ai = Math.abs(a.totalImpactR);
    const bi = Math.abs(b.totalImpactR);
    if (bi !== ai) return bi - ai;
    return b.count - a.count;
  });
}

function bySession(trades: TradeRow[]): SessionPerf[] {
  const groups = new Map<string, TradeRow[]>();
  for (const t of trades) {
    if (!isExecuted(t)) continue;
    const s = (t.session ?? "unknown").toString().toLowerCase();
    const arr = groups.get(s) ?? [];
    arr.push(t);
    groups.set(s, arr);
  }
  const out: SessionPerf[] = [];
  for (const [session, arr] of groups) {
    const e = buildEdge(arr);
    out.push({
      session,
      sample: e.sample,
      winRate: e.winRate,
      avgR: e.avgR,
      totalR: e.totalR,
    });
  }
  return out.sort((a, b) => b.avgR - a.avgR);
}

/** Detect simple but actionable behavior sequences. Newest trades first in `trades`. */
function detectPatterns(
  trades: TradeRow[],
  violations: RuleViolationRow[],
): Pattern[] {
  const patterns: Pattern[] = [];
  const sortedAsc = [...trades]
    .filter(isExecuted)
    .sort((a, b) => (a.executed_at < b.executed_at ? -1 : 1));

  // 1) Revenge trade: rule break within 60 minutes of a loss
  for (let i = 1; i < sortedAsc.length; i++) {
    const prev = sortedAsc[i - 1];
    const cur = sortedAsc[i];
    if (prev.result !== "loss") continue;
    if (!cur.rules_broken || cur.rules_broken.length === 0) continue;
    const dt =
      new Date(cur.executed_at).getTime() - new Date(prev.executed_at).getTime();
    if (dt > 0 && dt <= 60 * 60 * 1000) {
      patterns.push({
        id: `revenge-${cur.id}`,
        severity: "critical",
        title: "Revenge trade after loss",
        detail: `Rule break within 60m of a losing trade (${cur.rules_broken.join(", ")}).`,
        evidenceTradeIds: [prev.id, cur.id],
      });
      if (patterns.filter((p) => p.id.startsWith("revenge-")).length >= 3) break;
    }
  }

  // 2) Skipping stops after 2 consecutive wins
  for (let i = 2; i < sortedAsc.length; i++) {
    const a = sortedAsc[i - 2];
    const b = sortedAsc[i - 1];
    const c = sortedAsc[i];
    if (a.result === "win" && b.result === "win") {
      const skipped = (c.rules_broken ?? []).some((r) =>
        /stop|sl|no_stop/i.test(r),
      );
      if (skipped) {
        patterns.push({
          id: `skip-sl-${c.id}`,
          severity: "warn",
          title: "Skipped stop after 2 wins",
          detail: "Confidence spike — stop loss removed after consecutive wins.",
          evidenceTradeIds: [a.id, b.id, c.id],
        });
      }
    }
  }

  // 3) Same rule broken 3+ times in last 10 trades
  const last10 = sortedAsc.slice(-10).map((t) => t.id);
  const recentViolations = violations.filter((v) => last10.includes(v.trade_id));
  const counts = new Map<string, number>();
  for (const v of recentViolations) counts.set(v.type, (counts.get(v.type) ?? 0) + 1);
  for (const [type, count] of counts) {
    if (count >= 3) {
      patterns.push({
        id: `repeat-${type}`,
        severity: "warn",
        title: `Repeated rule break: ${type.replace(/_/g, " ")}`,
        detail: `Broken ${count}× in the last 10 trades — this is the dominant leak.`,
        evidenceTradeIds: recentViolations
          .filter((v) => v.type === type)
          .map((v) => v.trade_id),
      });
    }
  }

  return patterns.slice(0, 8);
}

export function buildEdgeReport(
  trades: TradeRow[],
  violations: RuleViolationRow[],
): EdgeReport {
  const totalTrades = trades.length;
  if (totalTrades === 0) {
    return {
      hasData: false,
      totalTrades: 0,
      systemEdge: { sample: 0, winRate: 0, avgR: 0, totalR: 0 },
      actualEdge: { sample: 0, winRate: 0, avgR: 0, totalR: 0 },
      missedR: 0,
      executionGapR: 0,
      disciplineScore: 0,
      ruleAdherencePct: 0,
      violations: [],
      sessions: [],
      patterns: [],
      lastTradeAt: null,
    };
  }

  const executed = trades.filter(isExecuted);
  const systemTrades = executed.filter(isSystemTrade);

  const systemEdge = buildEdge(systemTrades);
  const actualEdge = buildEdge(executed);
  const missedR = trades
    .filter(isMissed)
    .reduce((acc, t) => acc + safeNum(t.missed_potential_r, 0), 0);

  const ruleBreakTrades = executed.filter(
    (t) => (t.rules_broken ?? []).length > 0,
  ).length;
  const ruleAdherencePct =
    executed.length === 0 ? 0 : ((executed.length - ruleBreakTrades) / executed.length) * 100;

  // Discipline score = adherence weighted with recent trend (last 10 vs prior).
  const sortedDesc = [...executed].sort((a, b) =>
    a.executed_at < b.executed_at ? 1 : -1,
  );
  const recent = sortedDesc.slice(0, 10);
  const recentClean = recent.filter((t) => (t.rules_broken ?? []).length === 0).length;
  const recentScore = recent.length === 0 ? 0 : (recentClean / recent.length) * 100;
  const disciplineScore = Math.round(0.6 * ruleAdherencePct + 0.4 * recentScore);

  return {
    hasData: true,
    totalTrades,
    systemEdge,
    actualEdge,
    missedR,
    executionGapR: systemEdge.totalR - actualEdge.totalR,
    disciplineScore,
    ruleAdherencePct,
    violations: rankViolations(violations),
    sessions: bySession(trades),
    patterns: detectPatterns(trades, violations),
    lastTradeAt: sortedDesc[0]?.executed_at ?? null,
  };
}
