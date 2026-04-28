// Deterministic tests for the rule engine. Run with: bunx vitest run
import { describe, it, expect } from "vitest";
import {
  validateTrade,
  computeScore,
  computeTier,
  classifyDiscipline,
  checkCompleteness,
  buildChecklist,
  applyConfirmations,
  type StructuredRule,
} from "./ruleEngine";

const rule = (
  id: string,
  type: StructuredRule["type"],
  result: boolean,
  condition = "x",
): StructuredRule => ({ id, type, condition, evaluation_type: "boolean", result });

describe("ruleEngine — scoring", () => {
  it("gives 100 when all four categories pass", () => {
    const rules = [
      rule("e", "entry", true),
      rule("x", "exit", true),
      rule("r", "risk", true),
      rule("b", "behavior", true),
    ];
    expect(computeScore(rules)).toBe(100);
    expect(computeTier(rules)).toBe("A+");
    expect(classifyDiscipline(100)).toBe("fully_disciplined");
  });

  it("gives 75 (B+) when one category fails", () => {
    const rules = [
      rule("e", "entry", true),
      rule("x", "exit", true),
      rule("r", "risk", true),
      rule("b", "behavior", false),
    ];
    expect(computeScore(rules)).toBe(75);
    expect(computeTier(rules)).toBe("B+");
    expect(classifyDiscipline(75)).toBe("mostly_disciplined");
  });

  it("gives 50 (C) when two categories fail", () => {
    const rules = [
      rule("e", "entry", true),
      rule("x", "exit", true),
      rule("r", "risk", false),
      rule("b", "behavior", false),
    ];
    expect(computeScore(rules)).toBe(50);
    expect(computeTier(rules)).toBe("C");
    expect(classifyDiscipline(50)).toBe("undisciplined");
  });

  it("category fails if ANY rule in it fails", () => {
    const rules = [
      rule("e1", "entry", true),
      rule("e2", "entry", false),
      rule("x", "exit", true),
      rule("r", "risk", true),
      rule("b", "behavior", true),
    ];
    expect(computeScore(rules)).toBe(75);
  });
});

describe("ruleEngine — validation output", () => {
  it("collects violations and a discipline class", () => {
    const rules = [
      rule("e", "entry", true, "BOS confirmed"),
      rule("x", "exit", false, "Closed at TP"),
      rule("r", "risk", true, "Risk <= 1%"),
      rule("b", "behavior", true, "No revenge"),
    ];
    const out = validateTrade(rules);
    expect(out.valid).toBe(false);
    expect(out.score).toBe(75);
    expect(out.tier).toBe("B+");
    expect(out.violations).toEqual(["exit: Closed at TP"]);
    expect(out.discipline).toBe("mostly_disciplined");
  });

  it("throws if a rule has no boolean result (failsafe)", () => {
    const bad = [{ ...rule("e", "entry", true), result: undefined as unknown as boolean }];
    expect(() => validateTrade(bad)).toThrow(/cannot infer/);
  });
});

describe("ruleEngine — completeness", () => {
  it("blocks empty rule sets", () => {
    expect(checkCompleteness([])).toHaveLength(1);
  });
  it("flags missing categories and vague conditions", () => {
    const issues = checkCompleteness([rule("e", "entry", false, "x")]);
    expect(issues.some((i) => i.area === "exit")).toBe(true);
    expect(issues.some((i) => i.reason.includes("vague"))).toBe(true);
  });
});

describe("ruleEngine — checklist + confirmations", () => {
  it("starts every rule at false and applies user confirmations", () => {
    const checklist = buildChecklist([
      { id: "e", type: "entry", condition: "BOS", evaluation_type: "boolean" },
      { id: "r", type: "risk", condition: "1%", evaluation_type: "boolean" },
    ]);
    expect(checklist.every((r) => r.result === false)).toBe(true);

    const applied = applyConfirmations(checklist, { e: true });
    expect(applied.find((r) => r.id === "e")?.result).toBe(true);
    expect(applied.find((r) => r.id === "r")?.result).toBe(false);
  });
});
