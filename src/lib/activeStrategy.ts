// Lightweight read of the user's active (locked or most recent) strategy blueprint.
// Used by Chart Analyzer, Trade Check, Journal scoring, and AI Mentor so they
// all evaluate against the SAME user-defined ruleset.

import {
  getActiveBlueprint,
  type StrategyBlueprint,
  type StructuredRules,
  EMPTY_RULES,
} from "@/lib/dbStrategyBlueprints";

export type ActiveStrategyContext = {
  blueprint: StrategyBlueprint | null;
  rules: StructuredRules;
  hasLocked: boolean;
  summary: string; // one-line summary safe to show in UI / pass to AI
};

export async function loadActiveStrategyContext(): Promise<ActiveStrategyContext> {
  let blueprint: StrategyBlueprint | null = null;
  try {
    blueprint = await getActiveBlueprint();
  } catch (e) {
    console.warn("loadActiveStrategyContext failed", e);
  }
  const rules = {
    ...EMPTY_RULES,
    ...(blueprint?.structured_rules ?? {}),
  } as StructuredRules;
  const counts = (Object.keys(rules) as Array<keyof StructuredRules>).map(
    (k) => `${k}:${rules[k]?.length ?? 0}`,
  );
  return {
    blueprint,
    rules,
    hasLocked: !!blueprint?.locked,
    summary: blueprint
      ? `${blueprint.name} (${blueprint.locked ? "locked" : blueprint.status}) — ${counts.join(", ")}`
      : "No strategy defined yet.",
  };
}

export function summarizeRulesForAI(rules: StructuredRules): string {
  const lines: string[] = [];
  for (const k of Object.keys(rules) as Array<keyof StructuredRules>) {
    const items = rules[k] ?? [];
    if (items.length === 0) continue;
    lines.push(`${k.toUpperCase()}:`);
    for (const it of items) lines.push(`- ${it}`);
  }
  return lines.join("\n");
}
