// Intelligence layer — turns raw journal data into actionable behavioral insight.
// Pure functions on top of DbJournalRow so every consumer (dashboard, mentor,
// banners) reads from the same source of truth.

import type { DbJournalRow } from "@/lib/dbJournal";

export const DISCIPLINE_WINDOW = 20;
export const DISCIPLINED_THRESHOLD = 75; // a trade is "disciplined" if score >= 75

export type MistakeKey = "entry" | "exit" | "risk" | "behavior";

export const MISTAKE_LABEL: Record<MistakeKey, string> = {
  entry: "Entered without confirmation",
  exit: "Exited off-plan",
  risk: "Broke risk rules",
  behavior: "Lost behavioral control (FOMO / revenge / impulse)",
};

export type MistakeTag =
  | "fomo"
  | "revenge"
  | "overleveraged"
  | "early_exit"
  | "late_entry"
  | "no_setup"
  | "emotional";

export const MISTAKE_TAG_LABEL: Record<MistakeTag, string> = {
  fomo: "FOMO",
  revenge: "Revenge trade",
  overleveraged: "Overleveraged",
  early_exit: "Early exit",
  late_entry: "Late entry",
  no_setup: "Entered without confirmation",
  emotional: "Emotional decision",
};

export type DisciplineClass = "in_control" | "unstable" | "out_of_control";

export const DISCIPLINE_CLASS_LABEL: Record<DisciplineClass, string> = {
  in_control: "In Control",
  unstable: "Unstable",
  out_of_control: "Out of Control",
};

export function classifyDiscipline(score: number | null): DisciplineClass | null {
  if (score === null) return null;
  if (score >= 80) return "in_control";
  if (score >= 50) return "unstable";
  return "out_of_control";
}

export type Intelligence = {
  // Discipline score: % of last 20 trades whose discipline_score >= 75
  // (i.e. at least 3 of 4 rules followed). Null when no trades exist yet.
  disciplineScore: number | null;
  disciplineClass: DisciplineClass | null;
  windowSize: number;

  // Most frequently broken rule across the window (objective error)
  mostCommonMistake: { key: MistakeKey; count: number; label: string } | null;

  // Most frequent self-reported behavioral mistake_tag (psychological trigger)
  mostCommonMistakeTag: { tag: MistakeTag; count: number; label: string } | null;

  // Streak of consecutive most-recent trades that count as disciplined.
  disciplineStreak: number;

  // Last two trades both broke the plan (full plan, all 4 rules)
  twoUndisciplinedInARow: boolean;

  // Strict mode: active when last 2 trades both undisciplined.
  // Exits when the next 2 trades following the slip are both disciplined.
  strictModeActive: boolean;
};

function isDisciplinedRow(r: DbJournalRow): boolean {
  return r.discipline_score >= DISCIPLINED_THRESHOLD;
}

export function computeIntelligence(rows: DbJournalRow[]): Intelligence {
  if (rows.length === 0) {
    return {
      disciplineScore: null,
      disciplineClass: null,
      windowSize: 0,
      mostCommonMistake: null,
      mostCommonMistakeTag: null,
      disciplineStreak: 0,
      twoUndisciplinedInARow: false,
      strictModeActive: false,
    };
  }

  // rows are newest-first
  const recent = rows.slice(0, DISCIPLINE_WINDOW);

  const disciplinedCount = recent.filter(isDisciplinedRow).length;
  const disciplineScore = Math.round((disciplinedCount / recent.length) * 100);

  // Mistake tally (objective rule breaks)
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

  // Tag tally (subjective behavioral trigger)
  const tagTally = new Map<MistakeTag, number>();
  for (const r of recent) {
    const tag = (r as unknown as { mistake_tag?: MistakeTag | null }).mistake_tag;
    if (tag) tagTally.set(tag, (tagTally.get(tag) ?? 0) + 1);
  }
  let topTag: { tag: MistakeTag; count: number } | null = null;
  for (const [tag, count] of tagTally) {
    if (!topTag || count > topTag.count) topTag = { tag, count };
  }
  const mostCommonMistakeTag = topTag
    ? { ...topTag, label: MISTAKE_TAG_LABEL[topTag.tag] }
    : null;

  // Streak of disciplined trades from newest backwards (uses score >= 75)
  let streak = 0;
  for (const r of rows) {
    if (isDisciplinedRow(r)) streak++;
    else break;
  }

  const twoUndisciplinedInARow =
    rows.length >= 2 && !rows[0].followedPlan && !rows[1].followedPlan;

  // Strict mode entry: 2 consecutive undisciplined trades anywhere in the
  // most recent stretch UNLESS the user has already recovered with 2+
  // consecutive disciplined trades after them.
  // Walk newest-first: if we hit 2 disciplined in a row before finding 2
  // undisciplined in a row, strict mode is OFF.
  let strictModeActive = false;
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    if (isDisciplinedRow(a) && isDisciplinedRow(b)) break; // recovered
    if (!a.followedPlan && !b.followedPlan) {
      strictModeActive = true;
      break;
    }
  }

  return {
    disciplineScore,
    disciplineClass: classifyDiscipline(disciplineScore),
    windowSize: recent.length,
    mostCommonMistake,
    mostCommonMistakeTag,
    disciplineStreak: streak,
    twoUndisciplinedInARow,
    strictModeActive,
  };
}
