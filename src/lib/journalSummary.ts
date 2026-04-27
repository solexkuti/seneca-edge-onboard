// Build a compact, factual summary of the user's Trading Journal so the
// AI mentor can personalize answers. Returns null when there's no data.

import type { JournalEntry } from "@/lib/tradingJournal";
import { computeDiscipline } from "@/lib/tradingJournal";
import { detectBehaviorPattern } from "@/lib/behaviorPattern";

export function summarizeJournal(entries: JournalEntry[]): string | null {
  if (entries.length === 0) return null;

  const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);
  const recent = sorted.slice(0, 10);

  const total = entries.length;
  const wins = entries.filter((e) => e.resultR > 0).length;
  const losses = entries.filter((e) => e.resultR < 0).length;
  const sumR = entries.reduce((acc, e) => acc + (e.resultR || 0), 0);
  const discipline = computeDiscipline(entries);
  const pattern = detectBehaviorPattern(entries);

  // Average discipline_score from DB-backed entries (0–100)
  const scored = entries.filter(
    (e) => typeof e.disciplineScore === "number",
  );
  const avgScore =
    scored.length > 0
      ? Math.round(
          scored.reduce((acc, e) => acc + (e.disciplineScore ?? 0), 0) /
            scored.length,
        )
      : null;

  // Most common emotional state across recent trades
  const stateCount: Record<string, number> = {};
  for (const e of recent) {
    if (e.emotionalState) {
      stateCount[e.emotionalState] = (stateCount[e.emotionalState] ?? 0) + 1;
    }
  }
  const dominantState =
    Object.entries(stateCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const lines: string[] = [];
  lines.push(`Total trades: ${total} (W:${wins} / L:${losses})`);
  lines.push(`Net result: ${sumR.toFixed(2)}R`);
  if (discipline !== null) {
    lines.push(`Plan adherence: ${discipline}%`);
  }
  if (avgScore !== null) {
    lines.push(`Avg discipline score: ${avgScore}/100`);
  }
  if (dominantState) {
    lines.push(`Dominant recent emotional state: ${dominantState}`);
  }
  lines.push(`Current behavior pattern: ${pattern.kind} — ${pattern.message}`);

  lines.push("");
  lines.push(
    "Recent discipline logs (most recent first — cite by [time] when referencing):",
  );
  for (const e of recent) {
    const d = new Date(e.timestamp);
    // Friendly, citation-ready timestamp: "Apr 27, 14:32"
    const when = d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const followed =
      typeof e.followedPlan === "boolean"
        ? e.followedPlan
          ? "followed plan"
          : "BROKE plan"
        : "no plan tag";
    const broken: string[] = [];
    if (e.rules) {
      if (!e.rules.entry) broken.push("entry");
      if (!e.rules.exit) broken.push("exit");
      if (!e.rules.risk) broken.push("risk");
      if (!e.rules.behavior) broken.push("behavior");
    }
    const brokenTag = broken.length ? ` | broke: ${broken.join(", ")}` : "";
    const stateTag = e.emotionalState ? ` | ${e.emotionalState}` : "";
    const scoreTag =
      typeof e.disciplineScore === "number"
        ? ` | score ${e.disciplineScore}/100`
        : "";
    lines.push(
      `- [${when}] ${e.pair} | ${e.resultR >= 0 ? "+" : ""}${e.resultR}R | ${followed}${brokenTag}${stateTag}${scoreTag}`,
    );
  }

  return lines.join("\n");
}
