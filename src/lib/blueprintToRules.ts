// Bridge: convert a StrategyBlueprint into engine-ready StructuredRule[].
//
// PHASE 3: this is now a thin adapter over the canonical strategy schema.
// All rule ordering, ids, and category mapping live in src/lib/strategySchema.ts
// so UI / PDF / Analyzer outputs share one source of truth.

import type { StrategyBlueprint } from "./dbStrategyBlueprints";
import type { StructuredRule } from "./ruleEngine";
import { buildCanonicalStrategy, canonicalToEngineRules } from "./strategySchema";

/**
 * Build engine-ready rules from a blueprint. Optional `exitRules` lets callers
 * inject extra exit rules not stored on the blueprint yet.
 */
export function blueprintToEngineRules(
  blueprint: StrategyBlueprint,
  exitRules: string[] = [],
): StructuredRule[] {
  const canonical = buildCanonicalStrategy(blueprint);
  const out = canonicalToEngineRules(canonical);

  let n = out.length;
  for (const condition of exitRules) {
    if (!condition?.trim()) continue;
    out.push({
      id: `exit_extra_${String(++n).padStart(3, "0")}`,
      type: "exit",
      condition: condition.trim(),
      evaluation_type: "boolean",
      result: false,
    });
  }

  return out;
}
