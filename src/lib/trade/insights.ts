/**
 * Insights Engine
 *
 * Turns analysis output into human-readable observations for the user.
 * Phase 1 ships pattern-based, deterministic insights. Future iterations
 * can layer LLM-generated narratives on top of these primitives.
 */

import {
  assetBehavior,
  behaviorScore,
  executionSplit,
  ruleAdherence,
  ruleViolations,
  sessionPerformance,
  summarize,
} from "./analysis";
import type { Trade } from "./types";
import { humanizeViolation } from "@/lib/violationLabels";

export type InsightSeverity = "positive" | "neutral" | "warning" | "critical";

export interface Insight {
  id: string;
  message: string;
  severity: InsightSeverity;
  evidenceTradeIds?: string[];
}

export function generateInsights(trades: Trade[]): Insight[] {
  const out: Insight[] = [];
  const executed = trades.filter((t) => t.tradeType === "executed");
  if (!executed.length) {
    return [
      {
        id: "no-data",
        message:
          "Log a few trades to start seeing your behavior patterns surface here.",
        severity: "neutral",
      },
    ];
  }

  const summary = summarize(trades);
  const score = behaviorScore(trades);
  const adherence = ruleAdherence(trades);
  const split = executionSplit(trades);
  const sessions = sessionPerformance(trades);
  const assets = assetBehavior(trades);
  const violations = ruleViolations(trades);

  // 1. Score interpretation
  out.push({
    id: "score-summary",
    message:
      score.label === "controlled"
        ? `Behavior score ${score.score}/100 — controlled execution. Keep the system tight.`
        : score.label === "inconsistent"
        ? `Behavior score ${score.score}/100 — high inconsistency. Emotion is leading the system.`
        : `Behavior score ${score.score}/100 — slight drift. Watch your next entries.`,
    severity:
      score.label === "controlled"
        ? "positive"
        : score.label === "inconsistent"
        ? "critical"
        : "warning",
  });

  // 2. Top recurring violation
  const worst = violations[0];
  if (worst && worst.timesBroken >= 2) {
    out.push({
      id: `rule-${worst.rule}`,
      message: `"${humanizeViolation(worst.rule)}" appeared ${worst.timesBroken} times — costing ${formatR(worst.totalImpactR)}.`,
      severity: worst.totalImpactR < 0 ? "critical" : "warning",
      evidenceTradeIds: worst.trades.map((t) => t.id),
    });
  }

  // 3. Clean vs broken profitability
  const cleanTrades = executed.filter((t) => t.rulesBroken.length === 0);
  const brokenTrades = executed.filter((t) => t.rulesBroken.length > 0);
  if (cleanTrades.length && brokenTrades.length) {
    const cleanR = cleanTrades.reduce((s, t) => s + (t.resultR ?? 0), 0);
    const brokenR = brokenTrades.reduce((s, t) => s + (t.resultR ?? 0), 0);
    if (cleanR > 0 && brokenR < 0) {
      out.push({
        id: "profitable-only-clean",
        message: `You are profitable only when following rules — clean trades ${formatR(cleanR)} vs rule-broken ${formatR(brokenR)}.`,
        severity: "positive",
      });
    }
  }

  // 4. Best session
  const bestSession = [...sessions]
    .filter((s) => s.trades >= 3)
    .sort((a, b) => b.totalR - a.totalR)[0];
  if (bestSession) {
    out.push({
      id: `best-session-${bestSession.session}`,
      message: `You perform best in the ${bestSession.session} session — ${Math.round(bestSession.winRate * 100)}% win rate, ${formatR(bestSession.totalR)}.`,
      severity: "positive",
    });
  }

  // 5. Emotional asset
  const emotionalAsset = assets.find((a) => a.label === "emotional");
  if (emotionalAsset) {
    out.push({
      id: `asset-${emotionalAsset.asset}`,
      message: `${emotionalAsset.asset} is where emotion takes over — ${emotionalAsset.trades} trades, ${formatR(emotionalAsset.totalR)}.`,
      severity: "warning",
    });
  }

  // 6. Missed-trade pressure
  if (summary.missedCount >= 3) {
    out.push({
      id: "missed-pressure",
      message: `${summary.missedCount} missed trades logged — hesitation is showing up. Review the reasons.`,
      severity: "warning",
    });
  }

  // 7. Emotional execution dominance
  if (split.emotionalPct >= 0.5 && executed.length >= 5) {
    out.push({
      id: "emotional-dominance",
      message: `${Math.round(split.emotionalPct * 100)}% of your trades are emotional. The system isn't running you — you are.`,
      severity: "critical",
    });
  }

  // 8. Adherence achievement
  if (adherence.pct >= 0.85 && adherence.totalTrades >= 5) {
    out.push({
      id: "adherence-strong",
      message: `${Math.round(adherence.pct * 100)}% rule adherence over your last ${adherence.totalTrades} trades. Lock it in.`,
      severity: "positive",
    });
  }

  // 9. Behavioral loop — oversize after losses
  const chrono = [...executed].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  let lossThenOversize = 0;
  for (let i = 1; i < chrono.length; i++) {
    const prev = chrono[i - 1];
    const cur = chrono[i];
    const wasLoss = (prev.resultR ?? 0) < 0;
    const oversized = cur.rulesBroken.some((r) => /oversiz|over[_\s-]?lever/i.test(r));
    if (wasLoss && oversized) lossThenOversize++;
  }
  if (lossThenOversize >= 2) {
    out.push({
      id: "loop-oversize-after-loss",
      message: `Pattern detected — you tend to oversize after losses (${lossThenOversize}× recently). The loss is leading the next entry.`,
      severity: "critical",
    });
  }

  // 10. Behavioral loop — hesitation clustering after losses (missed trades)
  const allChrono = [...trades].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  let hesitationAfterLoss = 0;
  for (let i = 1; i < allChrono.length; i++) {
    const prev = allChrono[i - 1];
    const cur = allChrono[i];
    if (prev.tradeType === "executed" && (prev.resultR ?? 0) < 0) {
      if (cur.tradeType === "missed" && (cur.missedReason === "hesitation" || cur.missedReason === "fear")) {
        hesitationAfterLoss++;
      }
    }
  }
  if (hesitationAfterLoss >= 2) {
    out.push({
      id: "loop-hesitation-after-loss",
      message: `Hesitation frequently appears after losses (${hesitationAfterLoss}×). Fear is shaping your next decision.`,
      severity: "warning",
    });
  }

  // 11. Session concentration of violations
  const violationsBySession = new Map<string, number>();
  for (const t of executed) {
    if (t.rulesBroken.length > 0 && t.session) {
      violationsBySession.set(t.session, (violationsBySession.get(t.session) ?? 0) + t.rulesBroken.length);
    }
  }
  const totalViolations = Array.from(violationsBySession.values()).reduce((s, n) => s + n, 0);
  if (totalViolations >= 4) {
    const [topSession, topCount] = Array.from(violationsBySession.entries()).sort((a, b) => b[1] - a[1])[0];
    if (topCount / totalViolations >= 0.5) {
      out.push({
        id: `loop-session-${topSession}`,
        message: `Most violations occur during the ${topSession} session (${topCount} of ${totalViolations}). Discipline weakens there.`,
        severity: "warning",
      });
    }
  }

  return out;
}

function formatR(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}R`;
}
