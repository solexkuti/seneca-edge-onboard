import { writeFileSync } from "node:fs";
globalThis.atob = (s) => Buffer.from(s, "base64").toString("binary");
globalThis.btoa = (s) => Buffer.from(s, "binary").toString("base64");
globalThis.window = { atob: globalThis.atob, btoa: globalThis.btoa };
globalThis.document = { createElement: () => ({ getContext: () => null, style: {}, setAttribute() {}, appendChild() {}, click() {} }), body: { appendChild() {}, removeChild() {} } };
globalThis.navigator = { userAgent: "node" };
globalThis.URL = class { static createObjectURL() { return "blob:x"; } static revokeObjectURL() {} };
globalThis.Blob = class { constructor(p){ this.p=p; } };

const exp = await import("../src/lib/strategyExport.ts");
console.log("keys", Object.keys(exp));

// Replace downloadPdf logic by reading source intent — call generator via direct path.
// Quick patch: monkey-patch the jsPDF that strategyExport actually uses by intercepting save through Object.defineProperty on Function.prototype.
// Simpler: catch the thrown error by wrapping.
const orig = exp.downloadPdf;
try {
  const r = orig({ id:"x", user_id:"u", strategy_id:null, name:"Probe", account_types:[], risk_per_trade_pct:null, daily_loss_limit_pct:null, max_drawdown_pct:null, raw_input:null, tier_strictness:{a_plus:100,b_plus:80,c:60}, tier_rules:{a_plus:"",b_plus:"",c:""}, structured_rules:{ entry:["a"], confirmation:[], risk:["b"], behavior:[], context:[], invalidation:[] }, ambiguity_flags:[], refinement_history:[], checklist:{a_plus:["a"],b_plus:[],c:[]}, trading_plan:"x", locked:false, locked_at:null, version:1, status:"finalized", current_step:"output", created_at:"", updated_at:"" }, "full");
  console.log("ret", r);
} catch (e) { console.log("threw", e.message); }
