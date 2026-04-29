// Generate a sample strategy PDF using the SAME canonical pipeline the app uses.
// We import the runtime modules directly (TS via bun) and invoke downloadPdf
// against a synthetic blueprint, redirecting jsPDF's save() to a real file.

import { writeFileSync } from "node:fs";

// Stub the browser globals jsPDF expects on import.
globalThis.atob = globalThis.atob ?? ((s) => Buffer.from(s, "base64").toString("binary"));
globalThis.btoa = globalThis.btoa ?? ((s) => Buffer.from(s, "binary").toString("base64"));
const winStub = { atob: globalThis.atob, btoa: globalThis.btoa };
globalThis.window = globalThis.window ?? winStub;
Object.assign(globalThis.window, winStub);
globalThis.document = globalThis.document ?? {
  createElement: () => ({ getContext: () => null, style: {}, setAttribute() {}, appendChild() {} }),
  body: { appendChild() {} },
};
globalThis.navigator = globalThis.navigator ?? { userAgent: "node" };

const { jsPDF } = await import("jspdf");
// Override save() to write to disk instead of triggering a browser download.
const origSave = jsPDF.prototype.save;
jsPDF.prototype.save = function (filename) {
  const ab = this.output("arraybuffer");
  const out = `/tmp/${filename}`;
  writeFileSync(out, Buffer.from(ab));
  console.log("WROTE", out, "bytes=", Buffer.from(ab).length);
};

const { downloadPdf } = await import("../src/lib/strategyExport.ts");

const bp = {
  id: "sample-bp",
  user_id: "u",
  strategy_id: null,
  name: "London ORB — Gold Sweep Reclaim",
  account_types: ["prop", "personal"],
  risk_per_trade_pct: 0.5,
  daily_loss_limit_pct: 2,
  max_drawdown_pct: 6,
  raw_input: null,
  tier_strictness: { a_plus: 100, b_plus: 80, c: 60 },
  tier_rules: { a_plus: "", b_plus: "", c: "" },
  structured_rules: {
    context: [
      "Trade only during London session 08:00-11:00 GMT",
      "Daily bias aligned with H4 trend direction",
      "Avoid high-impact news ±15 minutes",
    ],
    entry: [
      "Price sweeps prior session high or low on M5",
      "Reclaim of swept level with body close back inside range",
      "Entry placed at 50% of reclaim candle, max 2 attempts per session",
    ],
    confirmation: [
      "FVG on M1 forms in direction of reclaim",
      "Volume on reclaim candle > 1.5× the prior 20-bar average",
    ],
    invalidation: [
      "Price closes back beyond swept level on M5",
      "Two consecutive M5 closes against the reclaim direction",
    ],
    risk: [
      "Risk 0.5% of account per trade, fixed",
      "Stop loss placed 1 ATR(14) beyond invalidation level",
      "Take profit at 2R minimum, partial at 1R when available",
    ],
    behavior: [
      "Stop trading after 2 losses in a session",
      "No re-entries within 5 minutes of a stopped trade",
      "Journal every trade within 30 minutes of close",
    ],
  },
  ambiguity_flags: [],
  refinement_history: [],
  checklist: { a_plus: ["seed"], b_plus: [], c: [] },
  trading_plan: "seed",
  locked: false,
  locked_at: null,
  version: 1,
  status: "finalized",
  current_step: "output",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

console.log("FULL  ->", downloadPdf(bp, "full"));
console.log("CHECK ->", downloadPdf(bp, "checklist"));
console.log("PLAN  ->", downloadPdf(bp, "plan"));

jsPDF.prototype.save = origSave;
