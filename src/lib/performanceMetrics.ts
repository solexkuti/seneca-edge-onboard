// performanceMetrics — pure helpers that derive the dashboard's
// Performance Snapshot and "Your Edge" panel from journal rows.
// All math is local; no API calls. Safe with empty inputs.

import type { DbJournalRow } from "@/lib/dbJournal";

export type PerfSnapshot = {
  pnlDayR: number;
  pnlWeekR: number;
  winRate: number;        // 0..1 over last 30 closed
  profitFactor: number;   // sumWins / |sumLosses|
  avgRR: number;          // avg |R| of decided trades
  bestStreak: number;     // longest consecutive clean trades
  worstStreak: number;    // longest consecutive rule-break trades
  cleanStreak: number;    // current clean-trade streak
  sample: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function rOf(row: DbJournalRow): number {
  // rr is signed in this codebase via resultR; if missing, derive from rr+result.
  if (typeof row.resultR === "number" && !Number.isNaN(row.resultR))
    return row.resultR;
  const rr = row.rr ?? 0;
  if (row.result === "loss") return -Math.abs(rr || 1);
  if (row.result === "win") return Math.abs(rr || 1);
  return 0;
}

export function computePerformance(rows: DbJournalRow[]): PerfSnapshot {
  if (rows.length === 0) {
    return {
      pnlDayR: 0, pnlWeekR: 0, winRate: 0, profitFactor: 0,
      avgRR: 0, bestStreak: 0, worstStreak: 0, cleanStreak: 0, sample: 0,
    };
  }

  const now = Date.now();
  const dayCutoff = now - DAY_MS;
  const weekCutoff = now - 7 * DAY_MS;

  let pnlDayR = 0;
  let pnlWeekR = 0;
  let wins = 0;
  let losses = 0;
  let sumWinR = 0;
  let sumLossR = 0;
  let absSum = 0;
  let absCount = 0;

  for (const r of rows) {
    const R = rOf(r);
    if (r.timestamp >= dayCutoff) pnlDayR += R;
    if (r.timestamp >= weekCutoff) pnlWeekR += R;
    if (r.result === "win") { wins++; sumWinR += R; }
    if (r.result === "loss") { losses++; sumLossR += R; }
    if (R !== 0) { absSum += Math.abs(R); absCount++; }
  }

  const decided = wins + losses;
  const winRate = decided === 0 ? 0 : wins / decided;
  const lossAbs = Math.abs(sumLossR);
  const profitFactor = lossAbs === 0 ? (sumWinR > 0 ? Infinity : 0) : sumWinR / lossAbs;
  const avgRR = absCount === 0 ? 0 : absSum / absCount;

  // Streaks — chronological order
  const chrono = [...rows].sort((a, b) => a.timestamp - b.timestamp);
  let bestStreak = 0;
  let worstStreak = 0;
  let runClean = 0;
  let runBreak = 0;
  for (const r of chrono) {
    if (r.followedPlan) {
      runClean += 1;
      runBreak = 0;
      if (runClean > bestStreak) bestStreak = runClean;
    } else {
      runBreak += 1;
      runClean = 0;
      if (runBreak > worstStreak) worstStreak = runBreak;
    }
  }

  // Current clean streak (from most recent backwards)
  let cleanStreak = 0;
  const newestFirst = [...rows].sort((a, b) => b.timestamp - a.timestamp);
  for (const r of newestFirst) {
    if (r.followedPlan) cleanStreak += 1;
    else break;
  }

  return {
    pnlDayR, pnlWeekR, winRate, profitFactor, avgRR,
    bestStreak, worstStreak, cleanStreak, sample: rows.length,
  };
}

export type EdgeInsight = {
  headline: string;
  detail: string | null;
};

/**
 * Identify the user's emerging edge from journal rows.
 * Picks the most discriminating dimension: direction, weekday, or
 * clean-vs-broken plan execution. Calm, observational copy.
 */
export function detectEdge(rows: DbJournalRow[]): EdgeInsight {
  if (rows.length < 4) {
    return {
      headline: "Your edge will appear after a few more trades.",
      detail: null,
    };
  }

  const decided = rows.filter((r) => r.result === "win" || r.result === "loss");
  if (decided.length < 4) {
    return {
      headline: "Log a few more closed trades to surface your edge.",
      detail: null,
    };
  }

  // 1) Plan-followed vs broken — usually the strongest signal
  const followed = decided.filter((r) => r.followedPlan);
  const broken = decided.filter((r) => !r.followedPlan);
  const fw = followed.filter((r) => r.result === "win").length;
  const bw = broken.filter((r) => r.result === "win").length;
  const fwRate = followed.length ? fw / followed.length : 0;
  const bwRate = broken.length ? bw / broken.length : 0;
  if (followed.length >= 3 && broken.length >= 2 && fwRate - bwRate >= 0.25) {
    return {
      headline: "Your edge appears when you trade your own plan.",
      detail: `Win rate ${(fwRate * 100).toFixed(0)}% on followed trades vs ${(bwRate * 100).toFixed(0)}% when you improvise.`,
    };
  }

  // 2) Direction edge
  const longs = decided.filter((r) => r.direction === "long");
  const shorts = decided.filter((r) => r.direction === "short");
  const lr = longs.length ? longs.filter((r) => r.result === "win").length / longs.length : 0;
  const sr = shorts.length ? shorts.filter((r) => r.result === "win").length / shorts.length : 0;
  if (longs.length >= 3 && lr - sr >= 0.2) {
    return {
      headline: "Your edge is forming on long setups.",
      detail: `${(lr * 100).toFixed(0)}% win rate going long.`,
    };
  }
  if (shorts.length >= 3 && sr - lr >= 0.2) {
    return {
      headline: "Your edge is forming on short setups.",
      detail: `${(sr * 100).toFixed(0)}% win rate going short.`,
    };
  }

  // 3) Best-pair edge
  const byPair = new Map<string, { w: number; n: number }>();
  for (const r of decided) {
    const k = r.pair;
    const e = byPair.get(k) ?? { w: 0, n: 0 };
    e.n += 1;
    if (r.result === "win") e.w += 1;
    byPair.set(k, e);
  }
  let bestPair: { pair: string; rate: number; n: number } | null = null;
  for (const [pair, e] of byPair) {
    if (e.n >= 3) {
      const rate = e.w / e.n;
      if (!bestPair || rate > bestPair.rate) bestPair = { pair, rate, n: e.n };
    }
  }
  if (bestPair && bestPair.rate >= 0.6) {
    return {
      headline: `Your strongest market right now is ${bestPair.pair}.`,
      detail: `${(bestPair.rate * 100).toFixed(0)}% win rate across ${bestPair.n} trades.`,
    };
  }

  return {
    headline: "Your edge is still forming — keep executing your system.",
    detail: null,
  };
}
