// Intelligence layer — turns raw journal data into actionable behavioral insight.
// Pure functions on top of DbJournalRow so every consumer (dashboard, mentor,
// banners) reads from the same source of truth.

import type { DbJournalRow } from "@/lib/dbJournal";

export const DISCIPLINE_WINDOW = 20;

export type MistakeKey = "entry" | "exit" | "risk" | "behavior";

export const MISTAKE_LABEL: Record<MistakeKey, string> = {
  entry: "Entered without a valid setup",
  exit: "Exited off-plan",
  risk: "Broke risk rules",
  behavior: "Lost behavioral control (FOMO / revenge / impulse)",
};

export type Intelligence = {
  // Discipline score: % of last 20 trades where the user followed their plan
  // (all 4 rules respected). Falls back to whatever exists when < 20.
  disciplineScore: number | null;
  windowSize: number;

  // Most frequently broken rule across the window
  mostCommonMistake: { key: MistakeKey; count: number; label: string } | null;

  // Streak of consecutive most-recent trades where plan was followed
  disciplineStreak: number;

  // Last two trades both broke the plan
  twoUndisciplinedInARow: boolean;
};

export function computeIntelligence(rows: DbJournalRow[]): Intelligence {
  if (rows.length === 0) {
    return {
      disciplineScore: null,
      windowSize: 0,
      mostCommonMistake: null,
      disciplineStreak: 0,
      twoUndisciplinedInARow: false,
    };
  }

  // rows are newest-first
  const recent = rows.slice(0, DISCIPLINE_WINDOW);

  const followed = recent.filter((r) => r.followedPlan).length;
  const disciplineScore = Math.round((followed / recent.length) * 100);

  // Mistake tally
  const tally: Record<MistakeKey, number> = {
    entry: 0,
    exit: 0,
    risk: 0,
    behavior: 0,
  };
  for (const r of recent) {
    if (!r.followed_entry) tally.entry++;
    if (!r.followed_exit) tally.exit++;
    if (!r.followed_risk) tally.risk++;
    if (!r.followed_behavior) tally.behavior++;
  }
  const ranked = (Object.keys(tally) as MistakeKey[])
    .map((k) => ({ key: k, count: tally[k] }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
  const top = ranked[0];
  const mostCommonMistake = top
    ? { key: top.key, count: top.count, label: MISTAKE_LABEL[top.key] }
    : null;

  // Streak of disciplined trades from newest backwards
  let streak = 0;
  for (const r of rows) {
    if (r.followedPlan) streak++;
    else break;
  }

  const twoUndisciplinedInARow =
    rows.length >= 2 && !rows[0].followedPlan && !rows[1].followedPlan;

  return {
    disciplineScore,
    windowSize: recent.length,
    mostCommonMistake,
    disciplineStreak: streak,
    twoUndisciplinedInARow,
  };
}
