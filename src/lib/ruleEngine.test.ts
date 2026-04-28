// Deterministic engine self-test. Run with: bun src/lib/ruleEngine.test.ts
// Pure assertions, no test framework required — keeps the engine verifiable
// without adding a dev dependency.
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

let failures = 0;
function assert(label: string, cond: unknown) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.error(`  ✗ ${label}`);
  }
}

const rule = (
  id: string,
  type: StructuredRule["type"],
  result: boolean,
  condition = "x",
): StructuredRule => ({ id, type, condition, evaluation_type: "boolean", result });

console.log("scoring");
{
  const all = [
    rule("e", "entry", true),
    rule("x", "exit", true),
    rule("r", "risk", true),
    rule("b", "behavior", true),
  ];
  assert("100 when all pass", computeScore(all) === 100);
  assert("A+ tier", computeTier(all) === "A+");
  assert("fully disciplined", classifyDiscipline(100) === "fully_disciplined");

  const oneFail = [...all.slice(0, 3), rule("b", "behavior", false)];
  assert("75 when one fails", computeScore(oneFail) === 75);
  assert("B+ tier", computeTier(oneFail) === "B+");
  assert("mostly disciplined", classifyDiscipline(75) === "mostly_disciplined");

  const twoFail = [
    rule("e", "entry", true),
    rule("x", "exit", true),
    rule("r", "risk", false),
    rule("b", "behavior", false),
  ];
  assert("50 when two fail", computeScore(twoFail) === 50);
  assert("C tier", computeTier(twoFail) === "C");
  assert("undisciplined", classifyDiscipline(50) === "undisciplined");
}

console.log("validation");
{
  const out = validateTrade([
    rule("e", "entry", true, "BOS confirmed"),
    rule("x", "exit", false, "Closed at TP"),
    rule("r", "risk", true, "Risk <= 1%"),
    rule("b", "behavior", true, "No revenge"),
  ]);
  assert("invalid when any violation", out.valid === false);
  assert("score 75", out.score === 75);
  assert("violations contains exit", out.violations[0]?.startsWith("exit:"));

  let threw = false;
  try {
    validateTrade([{ ...rule("e", "entry", true), result: undefined as unknown as boolean }]);
  } catch {
    threw = true;
  }
  assert("throws on non-boolean result (failsafe)", threw);
}

console.log("completeness + checklist");
{
  assert("blocks empty rules", checkCompleteness([]).length === 1);
  const checklist = buildChecklist([
    { id: "e", type: "entry", condition: "BOS", evaluation_type: "boolean" },
  ]);
  assert("checklist starts false", checklist.every((r) => r.result === false));
  const applied = applyConfirmations(checklist, { e: true });
  assert("applies confirmations", applied[0].result === true);
}

if (failures > 0) {
  console.error(`\n${failures} failed`);
  process.exit(1);
} else {
  console.log("\nall passed");
}
