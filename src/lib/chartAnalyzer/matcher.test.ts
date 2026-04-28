// Pure tests for the deterministic matcher. Run with: bun src/lib/chartAnalyzer/matcher.test.ts
import { analyzeAgainstStrategy } from "./matcher";
import { buildAnalyzerStrategy } from "./schema";
import type { DualExtraction } from "./extraction";

let failures = 0;
const assert = (label: string, cond: unknown) => {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.error(`  ✗ ${label}`);
  }
};

const strategy = buildAnalyzerStrategy({
  strategyId: "s1",
  name: "Test",
  timeframes: { execution: "5m", higher: "1h" },
  entry: ["Break of structure on the 5m"],
  confirmation: ["Retrace into fibonacci golden zone"],
  risk: [],
  behavior: ["No trades after a loss"],
  maxRiskPercent: 1,
});

const fullExtraction: DualExtraction = {
  execution: {
    structure: { trend: "bullish", break_of_structure: true, liquidity_sweep: false },
    levels: { fibonacci_detected: true, fib_zone: [0.62, 0.79], key_levels: [] },
    price_action: { rejection: false, engulfing: false, consolidation: false },
  },
  higher: {
    structure: { trend: "bullish", break_of_structure: false, liquidity_sweep: false },
    levels: { fibonacci_detected: true, fib_zone: [0.62, 0.79], key_levels: [] },
    price_action: { rejection: false, engulfing: false, consolidation: false },
  },
};

console.log("matcher");
{
  const out = analyzeAgainstStrategy(strategy, fullExtraction, {
    risk_percent: 0.8,
    behavior: { "beh-1": true },
  });
  assert("score 100 when all pass", out.score === 100);
  assert("tier A", out.tier === "A");
  assert("valid", out.valid === true);
}

{
  // Behaviour unconfirmed → 1 failure → B
  const out = analyzeAgainstStrategy(strategy, fullExtraction, {
    risk_percent: 0.8,
    behavior: {},
  });
  assert("tier B with 1 failure", out.tier === "B");
  assert("score 75 with 1/4 failed", out.score === 75);
}

{
  // Risk over cap + behaviour unconfirmed → 2 failures → C
  const out = analyzeAgainstStrategy(strategy, fullExtraction, {
    risk_percent: 5,
    behavior: {},
  });
  assert("tier C with 2 failures", out.tier === "C");
  assert("warns about failures", out.warnings.some((w) => w.includes("rule(s) failed")));
}

{
  // No structure → entry+confirmation fail → invalid
  const empty: DualExtraction = {
    execution: {
      structure: { trend: "range", break_of_structure: false, liquidity_sweep: false },
      levels: { fibonacci_detected: false, fib_zone: null, key_levels: [] },
      price_action: { rejection: false, engulfing: false, consolidation: false },
    },
    higher: {
      structure: { trend: "range", break_of_structure: false, liquidity_sweep: false },
      levels: { fibonacci_detected: false, fib_zone: null, key_levels: [] },
      price_action: { rejection: false, engulfing: false, consolidation: false },
    },
  };
  const out = analyzeAgainstStrategy(strategy, empty, {
    risk_percent: 0.5,
    behavior: { "beh-1": true },
  });
  assert("score 50 when half rules fail", out.score === 50);
  assert("invalid below threshold? threshold is 50 so still valid", out.valid === true);
}

if (failures) {
  console.error(`\n${failures} failed`);
  process.exit(1);
} else console.log("\nall passed");
