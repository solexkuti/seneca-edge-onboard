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

  const lines: string[] = [];
  lines.push(`Total trades: ${total} (W:${wins} / L:${losses})`);
  lines.push(`Net result: ${sumR.toFixed(2)}R`);
  if (discipline !== null) {
    lines.push(`Plan adherence: ${discipline}%`);
  }
  lines.push(`Current behavior pattern: ${pattern.kind} — ${pattern.message}`);

  lines.push("");
  lines.push("Last trades (most recent first):");
  for (const e of recent) {
    const when = new Date(e.timestamp).toISOString().slice(0, 16).replace("T", " ");
    const followed =
      typeof e.followedPlan === "boolean"
        ? e.followedPlan
          ? "followed plan"
          : "BROKE plan"
        : "no plan tag";
    lines.push(
      `- ${when} | ${e.pair} | ${e.resultR >= 0 ? "+" : ""}${e.resultR}R | ${followed}`,
    );
  }

  return lines.join("\n");
}
