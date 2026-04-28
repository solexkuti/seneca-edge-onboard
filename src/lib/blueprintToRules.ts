// Bridge: convert an existing StrategyBlueprint's free-text structured_rules
// into the deterministic engine's StructuredRule[] shape.
//
// The blueprint stores rules as bullet lists per category. This bridge maps
// those onto the engine's 4 fixed categories (entry / exit / risk / behavior).
// It does NOT call the AI and does NOT compute results — every rule is
// returned with `result: false` so the user must confirm each one explicitly.

import type { StrategyBlueprint, StructuredRules } from "./dbStrategyBlueprints";
import type { StructuredRule, RuleType } from "./ruleEngine";

const CATEGORY_MAP: Record<keyof StructuredRules, RuleType> = {
  entry: "entry",
  confirmation: "entry", // confirmations are entry pre-conditions
  risk: "risk",
  behavior: "behavior",
  context: "behavior", // contextual rules count as behavioral discipline
};

/**
 * Build engine-ready rules from a blueprint. Optional `exitRules` lets callers
 * inject exit rules separately (the blueprint shape doesn't carry them yet).
 */
export function blueprintToEngineRules(
  blueprint: StrategyBlueprint,
  exitRules: string[] = [],
): StructuredRule[] {
  const out: StructuredRule[] = [];
  const src = blueprint.structured_rules ?? {};
  let n = 0;

  for (const key of Object.keys(CATEGORY_MAP) as (keyof StructuredRules)[]) {
    const list = (src[key] as string[] | undefined) ?? [];
    for (const condition of list) {
      if (!condition?.trim()) continue;
      out.push({
        id: `${key}-${n++}`,
        type: CATEGORY_MAP[key],
        condition: condition.trim(),
        evaluation_type: "boolean",
        result: false,
      });
    }
  }

  for (const condition of exitRules) {
    if (!condition?.trim()) continue;
    out.push({
      id: `exit-${n++}`,
      type: "exit",
      condition: condition.trim(),
      evaluation_type: "boolean",
      result: false,
    });
  }

  return out;
}
