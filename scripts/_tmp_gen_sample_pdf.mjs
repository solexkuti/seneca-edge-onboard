import { writeFileSync } from "node:fs";

globalThis.atob = (s) => Buffer.from(s, "base64").toString("binary");
globalThis.btoa = (s) => Buffer.from(s, "binary").toString("base64");
globalThis.window = { atob: globalThis.atob, btoa: globalThis.btoa };
globalThis.document = {
  createElement: () => ({ getContext: () => null, style: {}, setAttribute() {}, appendChild() {}, click() {}, set href(_v){}, set download(_v){} }),
  body: { appendChild() {}, removeChild() {} },
};
globalThis.navigator = { userAgent: "node" };
globalThis.URL = class { static createObjectURL() { return "blob:x"; } static revokeObjectURL() {} };
globalThis.Blob = class { constructor(p){ this.p=p; } };

// Patch jsPDF constructor to wrap every instance's save() before strategyExport imports it.
const jspdfMod = await import("jspdf");
const RealJsPDF = jspdfMod.jsPDF;
function PatchedJsPDF(...args) {
  const inst = new RealJsPDF(...args);
  inst.save = function (filename) {
    const ab = this.output("arraybuffer");
    writeFileSync(`/tmp/${filename}`, Buffer.from(ab));
    console.log("WROTE /tmp/" + filename, "bytes=", Buffer.from(ab).length);
    return this;
  };
  return inst;
}
PatchedJsPDF.prototype = RealJsPDF.prototype;
Object.assign(PatchedJsPDF, RealJsPDF);
jspdfMod.jsPDF = PatchedJsPDF;
jspdfMod.default = PatchedJsPDF;

const { downloadPdf } = await import("../src/lib/strategyExport.ts");

const bp = {
  id: "sample-bp", user_id: "u", strategy_id: null,
  name: "London ORB — Gold Sweep Reclaim",
  account_types: ["prop", "personal"],
  risk_per_trade_pct: 0.5, daily_loss_limit_pct: 2, max_drawdown_pct: 6,
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
  ambiguity_flags: [], refinement_history: [],
  checklist: { a_plus: ["seed"], b_plus: [], c: [] },
  trading_plan: "seed",
  locked: false, locked_at: null, version: 1,
  status: "finalized", current_step: "output",
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
};

console.log("FULL  ->", downloadPdf(bp, "full"));
console.log("CHECK ->", downloadPdf(bp, "checklist"));
console.log("PLAN  ->", downloadPdf(bp, "plan"));
